require("dotenv").config();
const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
const admin = require("firebase-admin");
const cors = require("cors");
const path = require("path");

console.log("🚀 Starting PlanGenie Server...");

// --- Firebase Admin Setup with Base64 Decoding ---
try {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_BASE64 secret is not set.");
  }
  const decoded = Buffer.from(
    process.env.FIREBASE_SERVICE_ACCOUNT_BASE64,
    "base64"
  ).toString("utf8");
  const serviceAccount = JSON.parse(decoded);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log("✅ Firebase Admin SDK initialized successfully.");
} catch (error) {
  console.error("🔥 FATAL ERROR: Firebase Admin SDK initialization failed.", error.message);
  process.exit(1);
}


const app = express();
app.use(cors());
app.use(bodyParser.json());

// --- Serve the static frontend build files ---
app.use(express.static(path.join(__dirname, 'plangenie-frontend', 'build')));

const GITHUB_JSON_URL = "https://raw.githubusercontent.com/nh652/TelcoPlans/main/telecom_plans_improved.json";
const responseCache = new Map();
const RESPONSE_CACHE_TTL = 5 * 60 * 1000;
let cachedPlans = null;
let lastPlanFetch = 0;
const PLAN_CACHE_TTL = 60 * 60 * 1000;

function log(...args) {
  return process.env.NODE_ENV !== "test" && console.log(...args);
}

async function fetchAndCachePlans(retries = 2) {
    const now = Date.now();
    if (!cachedPlans || now - lastPlanFetch > PLAN_CACHE_TTL) {
        log("Cache miss or expired. Fetching new plans...");
        for (let i = 0; i <= retries; i++) {
            try {
                const response = await axios.get(GITHUB_JSON_URL, {
                    headers: { "User-Agent": "PlanGenie/5.0" },
                    timeout: 7000
                });
                cachedPlans = response.data;
                lastPlanFetch = now;
                log("✅ Plans re-fetched and cached successfully.");
                break;
            } catch (e) {
                log(`❌ Plans fetch error (attempt ${i + 1}):`, e.message);
                if (i < retries) {
                    await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
                }
            }
        }
    } else {
        log("✅ Serving plans from cache.");
    }
    if (!cachedPlans) {
        log("❌ Critical Error: Failed to load plan data after all retries.");
        throw new Error("Failed to load plan data.");
    }
    return cachedPlans;
}

async function getAIResponse(userQuery, chatHistory = [], planData) {
  const systemPrompt = `You are "Plan Genie," a friendly, expert AI assistant for finding mobile recharge plans in India. Your personality is helpful, smart, and conversational.

    **Core Instructions:**
    1.  **Be Conversational:** If the user says "hi" or "thanks," respond naturally.
    2.  **Answer Direct Questions First:** If the user asks a direct question (like "how are you?"), you MUST answer it naturally first before guiding the conversation back to mobile plans.
    3.  **Reason and Recommend:** Do not just list plans. Explain WHY you are recommending them and compare options if asked.
    4.  **Ask Clarifying Questions:** If a query is vague, ask for more details.

    **Indian Telecom Rules (CRITICAL):**
    - A "1 month" plan is 28 days.
    - A "2 month" plan is 56 days.
    - A "3 month" plan is 84 days.
    - For "voice only" or "minimum SMS" queries, prioritize the cheapest plans with minimal data.

    You are now in a conversation. The user's latest message is: "${userQuery}".
    The entire plan database is provided below. Use it to form your response.
    `;

  const messages = [
    { role: "system", content: systemPrompt },
    ...chatHistory,
    { role: "user", content: `User Query: "${userQuery}"\n\nPlan Data (JSON): ${JSON.stringify(planData)}`},
  ];

  try {
    const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
        model: "openai/gpt-3.5-turbo",
        messages: messages,
    }, {
        headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
        }
    });
    return response.data.choices?.[0]?.message?.content || "Sorry, I couldn't think of a response.";
  } catch (err) {
    log("❌ AI Response Generation Error:", err.message);
    return "I'm having a little trouble thinking right now. Please try again in a moment.";
  }
}

async function verifyFirebaseToken(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }
  const idToken = header.split("Bearer ")[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error("🔥 Firebase Auth Error:", error);
    return res.status(403).json({ error: "Unauthorized: Invalid token" });
  }
}

// --- Default Route ---
app.get("/", (req, res) => {
  res.send("✅ PlanGenie backend is running!");
});

// --- API Routes ---
app.post("/api/query", verifyFirebaseToken, async (req, res) => {
  const userText = (req.body.text || "").trim();
  const chatHistory = req.body.history || [];

  if (!userText) {
    return res.status(400).json({ error: "Query text is required" });
  }

  const cacheKey = JSON.stringify({ query: userText, history: chatHistory });
  if (responseCache.has(cacheKey)) {
      const cached = responseCache.get(cacheKey);
      if (Date.now() - cached.timestamp < RESPONSE_CACHE_TTL) {
          log("✅ Serving response from cache.");
          return res.json({ reply: cached.reply });
      }
  }

  try {
    const planData = await fetchAndCachePlans();
    const aiReply = await getAIResponse(userText, chatHistory, planData);
    responseCache.set(cacheKey, { reply: aiReply, timestamp: Date.now() });
    res.json({ reply: aiReply });
  } catch (e) {
    log("❌ Query processing error:", e.message);
    res.status(500).json({ error: "Sorry, a server error occurred." });
  }
});


// --- Catch-all route to serve the frontend's index.html ---
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'plangenie-frontend', 'build', 'index.html'));
});

// UPDATED PORT CONFIGURATION
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server is listening on port ${PORT}`);
}).on('error', (err) => {
    console.error("🔥 Server startup error:", err);
});
