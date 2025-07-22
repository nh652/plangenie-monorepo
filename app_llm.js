
// PlanGenie-LLM - Main Application Logic
const express = require('express');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Load telecom plans
let plans = [];
try {
  const plansData = fs.readFileSync('plans.json', 'utf8');
  plans = JSON.parse(plansData);
} catch (error) {
  console.error('Error loading plans.json:', error.message);
  plans = [];
}

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'PlanGenie-LLM API is running!' });
});

app.get('/api/plans', (req, res) => {
  res.json(plans);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`PlanGenie-LLM server running on port ${PORT}`);
});
