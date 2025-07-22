// PlanGenie-LLM - Main Application Logic
require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENROUTER_API_KEY });

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(express.static('public'));

let plans = [];

const operatorMap = {
  jio: 'jio',
  airtel: 'airtel',
  vi: 'vi',
  vodafone: 'vi',
};

const keywordsForVoiceOnly = ['voice only', 'calling only', 'call only'];
const durationAliases = {
  '28': 1, '30': 1, '56': 2, '60': 2,
  '84': 3, '90': 3, '336': 12, '365': 12
};

function normalizeDuration(days) {
  const val = String(days);
  return durationAliases[val] || null;
}

function flattenPlansNested(nested) {
  const result = [];
  for (const category in nested) {
    if (Array.isArray(nested[category])) {
      result.push(...nested[category]);
    } else {
      result.push(...flattenPlansNested(nested[category]));
    }
  }
  return result;
}

function paginate(arr, page = 1, pageSize = 8) {
  const start = (page - 1) * pageSize;
  return arr.slice(start, start + pageSize);
}

function flattenPlans(data) {
  const flat = [];

  const providers = data.telecom_providers;

  for (const [operator, operatorData] of Object.entries(providers)) {
    const planSections = operatorData.plans;

    for (const planType of Object.values(planSections)) {
      if (Array.isArray(planType)) {
        // e.g., postpaid: []
        for (const plan of planType) {
          flat.push({ ...plan, operator });
        }
      } else if (typeof planType === 'object') {
        // e.g., prepaid: { monthly_plans: [], voice_only_plans: [] }
        for (const planGroup of Object.values(planType)) {
          if (Array.isArray(planGroup)) {
            for (const plan of planGroup) {
              flat.push({ ...plan, operator });
            }
          }
        }
      }
    }
  }

  return flat;
}

async function fetchPlansFromGitHub() {
  const url = "https://raw.githubusercontent.com/nh652/TelcoPlans/main/telecom_plans_improved.json";
  try {
    const res = await fetch(url);
    const data = await res.json();
    plans = data; // Store raw nested data for new logic
    console.log(`✅ Loaded plans data from GitHub`);
  } catch (err) {
    console.error("❌ Failed to fetch plans:", err.message);
  }
}

async function extractFiltersViaLLM(message) {
  const prompt = `
Extract operator (jio, airtel, vi), budget (₹ amount), validity (in days), and plan type (voice only, data only, postpaid, prepaid, etc) from the following user message. Respond in strict JSON like:
{"operator":"jio","budget":200,"validity":28,"type":"prepaid"}

User message: "${message}"
`;
  try {
    const response = await openai.chat.completions.create({
      model: 'openchat/openchat-3.5-1210',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    });

    const jsonStart = response.choices[0].message.content.indexOf('{');
    const jsonRaw = response.choices[0].message.content.slice(jsonStart).trim();
    return JSON.parse(jsonRaw);
  } catch (err) {
    console.error('❌ LLM error:', err.message);
    return null;
  }
}

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'PlanGenie-LLM API is running!' });
});

app.get('/api/plans', (req, res) => {
  res.json(plans);
});

app.post('/query', async (req, res) => {
  const userMessage = req.body.text || '';
  const filters = await extractFiltersViaLLM(userMessage);
  if (!filters) {
    return res.status(500).json({ error: 'LLM extraction failed' });
  }

  const { operator, budget, validity, type } = filters;
  let matchedPlans = [];

  const opKey = operatorMap[operator?.toLowerCase()];
  if (!opKey || !plans.telecom_providers[opKey]) {
    return res.json({
      filters,
      count: 0,
      reply: `🙁 I couldn't find any plans for "${operator}". Try again.`,
      plans: [],
    });
  }

  // Flatten all nested plans
  const flatPlans = flattenPlansNested(plans.telecom_providers[opKey].plans);
  matchedPlans = flatPlans.filter(plan => {
    const priceMatch = budget ? plan.price <= budget : true;
    const validityMatch = validity ? normalizeDuration(plan.validity) === normalizeDuration(validity) : true;

    const typeMatch = type
      ? (type.toLowerCase().includes('voice') && (plan.category?.toLowerCase().includes('voice') || plan.data === '0GB')) ||
        (type.toLowerCase().includes('data') && plan.data !== '0GB')
      : true;

    return priceMatch && validityMatch && typeMatch;
  });

  const reply =
    matchedPlans.length === 0
      ? `🙁 Sorry, I couldn't find any ${operator} plans${budget ? ` under ₹${budget}` : ''}. Try changing your query!`
      : `✅ Found ${matchedPlans.length} ${operator} plan${matchedPlans.length > 1 ? 's' : ''}${
          budget ? ` under ₹${budget}` : ''
        }:\n\n` +
        paginate(matchedPlans, 1)
          .map(
            p =>
              `🔹 ₹${p.price} – ${p.validity} days, ${p.type || 'prepaid'}\n📄 ${p.benefits}${
                p.additional_benefits ? `\n✨ ${p.additional_benefits}` : ''
              }`
          )
          .join('\n\n');

  res.json({
    filters,
    count: matchedPlans.length,
    reply,
    plans: paginate(matchedPlans, 1),
  });
});

// Start server
fetchPlansFromGitHub();
app.listen(PORT, '0.0.0.0', () => {
  console.log(`PlanGenie-LLM server running on port ${PORT}`);
});
