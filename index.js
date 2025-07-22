// PlanGenie-LLM - Main Application Logic
require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(express.static('public'));

let plans = [];

async function fetchPlansFromGitHub() {
  const url = "https://raw.githubusercontent.com/nh652/TelcoPlans/main/telecom_plans_improved.json";
  try {
    const res = await fetch(url);
    const data = await res.json();
    plans = Array.isArray(data) ? data : [];
    console.log("✅ Telecom plans loaded from GitHub");
  } catch (err) {
    console.error("❌ Failed to fetch plans:", err.message);
    plans = []; // Ensure plans is always an array
  }
}

async function extractFiltersViaLLM(userInput) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "HTTP-Referer": "https://your-replit-url.repl.co/",  // use your Replit domain
      "X-Title": "PlanGenie LLM"
    },
    body: JSON.stringify({
      model: "openai/gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are a smart filter extractor for a telecom plan search assistant.

From the user's sentence, extract these filters as JSON:
- operator (like jio, airtel, vi)
- budget (number only, in rupees)
- validity (e.g., 28 days)
- type (data, voice, combo)

Respond ONLY with JSON, like:
{"operator":"jio","budget":200,"validity":"28 days","type":"combo"}

If a field is missing in the user's sentence, return it as null. Do not write anything else.`
        },
        { role: "user", content: userInput }
      ]
    })
  });

  const data = await response.json();
  console.log("🔍 Full API response:", JSON.stringify(data, null, 2));
  const raw = data.choices?.[0]?.message?.content?.trim();
  console.log("🧠 LLM raw reply:", raw);

  try {
    return JSON.parse(raw);
  } catch (e) {
    console.warn("⚠️ GPT returned non-JSON:", raw);
    return {
      operator: null,
      budget: null,
      validity: null,
      type: null
    };
  }
}

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'PlanGenie-LLM API is running!' });
});

app.get('/api/plans', (req, res) => {
  res.json(plans);
});

app.post("/query", async (req, res) => {
  try {
    const userInput = req.body.text;
    const filters = await extractFiltersViaLLM(userInput);

    console.log("🔎 Extracted filters:", filters);

    if (!Array.isArray(plans)) {
      return res.status(500).json({ error: "Plans data is not loaded." });
    }

    const matched = plans.filter(plan => {
      if (filters.operator && plan.operator.toLowerCase() !== filters.operator.toLowerCase()) return false;
      if (filters.budget && Number(plan.price) > Number(filters.budget)) return false;
      if (filters.validity && !plan.validity.toLowerCase().includes(filters.validity.toLowerCase())) return false;
      if (filters.type && plan.type && plan.type.toLowerCase() !== filters.type.toLowerCase()) return false;
      return true;
    });

    // Format chatbot-style response
    let reply = "";
    if (matched.length === 0) {
      reply = `🙁 Sorry, I couldn't find any ${filters.operator || ""} plans under ₹${filters.budget || "your budget"}. Try changing your query!`;
    } else {
      reply = `✅ Found ${matched.length} ${filters.operator || ""} plan${matched.length > 1 ? "s" : ""} under ₹${filters.budget || ""}:\n\n`;
      matched.slice(0, 5).forEach((plan, i) => {
        reply += `🔹 ₹${plan.price} - ${plan.validity}, ${plan.type}\n📄 ${plan.description}\n\n`;
      });
    }

    res.json({
      filters,
      count: matched.length,
      reply,          // 🧠 New: human-friendly message
      plans: matched  // 🔍 Still includes raw data
    });

  } catch (err) {
    console.error("❌ LLM error:", err.message);
    res.status(500).json({ error: "Failed to process request" });
  }
});

// Start server
fetchPlansFromGitHub();
app.listen(PORT, '0.0.0.0', () => {
  console.log(`PlanGenie-LLM server running on port ${PORT}`);
});
