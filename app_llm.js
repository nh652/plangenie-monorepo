// PlanGenie-LLM - Main Application Logic
const express = require('express');
const fetch = require("node-fetch");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(express.static('public'));

let plans = [];

async function fetchPlansFromGitHub() {
  const url = "https://raw.githubusercontent.com/nh652/TelcoPlans/main/telecom_plans_improved.json";
  try {
    const res = await fetch(url);
    plans = await res.json();
    console.log("✅ Telecom plans loaded from GitHub");
  } catch (err) {
    console.error("❌ Failed to fetch plans:", err.message);
  }
}

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'PlanGenie-LLM API is running!' });
});

app.get('/api/plans', (req, res) => {
  res.json(plans);
});

// Start server
fetchPlansFromGitHub();
app.listen(PORT, '0.0.0.0', () => {
  console.log(`PlanGenie-LLM server running on port ${PORT}`);
});
