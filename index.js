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
          content: `You are a filter extractor for a telecom plan chatbot. From user input, extract these:
- operator (like jio, airtel, vi)
- budget (₹)
- validity (e.g., 28 days)
- type (data, voice, combo)

If anything is missing, use null. Output only valid JSON like:
{"operator":"jio","budget":300,"validity":"28 days","type":"combo"}`
        },
        { role: "user", content: userInput }
      ]
    })
  });

  const data = await response.json();
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
  const userInput = req.body.text || req.body.message || "";

  try {
    const filters = await extractFiltersViaLLM(userInput);

    if (!Array.isArray(plans)) {
      console.error("❌ Plans is not an array:", plans);
      return res.status(500).json({ error: "Plan data is corrupted or unavailable" });
    }

    const matched = plans.filter(plan => {
      if (filters.operator && !plan.operator.toLowerCase().includes(filters.operator.toLowerCase())) return false;
      if (filters.budget && plan.price > filters.budget) return false;
      if (filters.validity && !plan.validity.toLowerCase().includes(filters.validity.toLowerCase())) return false;
      if (filters.type && !plan.type.toLowerCase().includes(filters.type.toLowerCase())) return false;
      return true;
    });

    res.json({
      filters,
      count: matched.length,
      plans: matched
    });

  } catch (err) {
    console.error("❌ LLM error:", err);
    res.status(500).json({ error: "Failed to process request" });
  }
});

// Start server
fetchPlansFromGitHub();
app.listen(PORT, '0.0.0.0', () => {
  console.log(`PlanGenie-LLM server running on port ${PORT}`);
});
