
require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(bodyParser.json());

// Authentication constants
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_here_change_in_production';

// In-memory stores (replace with database in production)
const users = {}; // { "user@email.com": { password: "<hashed>" } }
const otps = {}; // { "destination": { code: "123456", expires: <timestamp> } }

const PORT = process.env.PORT || 5000;
const GITHUB_JSON_URL = 'https://raw.githubusercontent.com/nh652/TelcoPlans/main/telecom_plans_improved.json';

let cachedPlans = null, lastPlanFetch = 0;
const PLAN_CACHE_TTL = 60 * 60 * 1000; // 1 hour

const requests = new Map();
const REQ_RATE_LIMIT = 30;
const REQ_WINDOW = 60 * 1000; // 1 minute
const responseCache = new Map();
const RESPONSE_CACHE_TTL = 5 * 60 * 1000; // 5 min

const OPERATORS = ['jio', 'airtel', 'vi'];
const OPERATOR_CORRECTIONS = { geo:'jio', artel:'airtel', 'vodafone idea': 'vi', vodaphone:'vi', idea:'vi' };
const MONTH_MAPPINGS = {
  '1 month': 28,    'one month': 28,   'a month': 28,
  '2 month': 56,    'two month': 56,   '2 months': 56,   'two months': 56,
  '3 month': 84,    'three month': 84, '3 months': 84,   'three months': 84
};
const MAX_PAGE = 3;

function log(...args){ return process.env.NODE_ENV !== 'test' && console.log(...args); }
function pickRandom(arr) { return arr[Math.floor(Math.random()*arr.length)]; }

function correctOperatorName(text) {
  if (!text) return null;
  const normalized = text.toLowerCase();
  if (OPERATOR_CORRECTIONS[normalized]) return OPERATOR_CORRECTIONS[normalized];
  if (normalized.includes('jio') || normalized.includes('geo')) return 'jio';
  if (normalized.includes('airtel') || normalized.includes('artel')) return 'airtel';
  if (normalized.includes('vi') || normalized.includes('vodafone') || normalized.includes('idea')) return 'vi';
  return null;
}
function parseValidity(val) {
  if (typeof val === 'number') return val;
  if (!val) return null;
  const s = val.toString().toLowerCase();
  if (MONTH_MAPPINGS[s]) return MONTH_MAPPINGS[s];
  if (s.includes('month')) { const m = s.match(/(\d+)/); if(m) return parseInt(m[1])*30; }
  if (s.includes('week'))  { const m = s.match(/(\d+)/); if(m) return parseInt(m[1])*7; }
  if (s.includes('year'))  { const m = s.match(/(\d+)/); if(m) return parseInt(m[1])*365; }
  if (s.includes('day'))   { const m = s.match(/(\d+)/); if(m) return parseInt(m[1]); }
  const m = s.match(/(\d+)/);
  return m ? parseInt(m[1]) : null;
}
function parseDataAllowance(dataStr){
  if (!dataStr) return null;
  if (dataStr.toLowerCase().includes('unlimited')) return Infinity;
  const g = dataStr.match(/(\d+(\.\d+)?)\s*GB/i); if(g) return +g[1];
  const m = dataStr.match(/(\d+)\s*MB/i); if(m) return +m[1]/1024;
  return null;
}
async function fetchAndCachePlans(retries=2){
  const now = Date.now();
  if (!cachedPlans || (now - lastPlanFetch) > PLAN_CACHE_TTL) {
    for (let i=0; i <= retries; i++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(GITHUB_JSON_URL, { headers: {'User-Agent':'PlanGenie/2.0'}, signal:controller.signal });
        clearTimeout(timeout);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        cachedPlans = await response.json();
        lastPlanFetch = now;
        log('✅ Plans re-fetched');
        break;
      } catch(e){
        log('❌ Plans fetch error (try',i+1,'):',e.message);
        await new Promise(r=>setTimeout(r,1000*(i+1)));
      }
    }
  }
  if (!cachedPlans) throw new Error('Failed to load plan data');
  return cachedPlans;
}
function flattenPlans(data) {
  let flat = [];
  for (const op in data.telecom_providers) {
    const prov = data.telecom_providers[op];
    for (const type of ['prepaid','postpaid']) {
      const group = prov.plans?.[type]; 
      if (!group) continue;
      if (Array.isArray(group)) flat.push(...group.map(p=>({...p,operator:op,type})));
      else for (const k of Object.keys(group)) flat.push(...group[k].map(p=>({...p,operator:op,type})));
    }
  }
  return flat;
}

async function extractFiltersViaLLM(userText) {
  const prompt = `Extract operator, budget (₹), validity (days), plan type, and feature list (like "ott", "international roaming", "voice only", "data only") from this: "${userText}". Respond as: {"operator":...,"budget":...,"validity":...,"type":...,"features":...}`;
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'openai/gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You extract structured filters from user queries.' },
          { role: 'user', content: prompt }
        ]
      })
    });
    const data = await res.json();
    return JSON.parse(data.choices?.[0]?.message?.content || '{}');
  } catch (err) {
    log('❌ LLM extraction error:', err.message);
    return {};
  }
}
function inferSimpleIntent(text){
  const s = text.trim().toLowerCase();
  if (["hi","hello","hey"].includes(s)) return { greeting:true };
  if (s.includes('thank')) return { thanks:true };
  if (s.includes('bye') || s.includes('goodbye')) return { bye:true };
  if (s.includes('how are you')) return { howareyou:true };
  if (s.includes('show more') || s.includes('more plans') || s === 'more') return { showmore:true };
  if (s.includes('feedback') || s.includes('helpful') || ['👍','👎'].some(e=>s.includes(e))) return { feedback:true };
  return {};
}

function filterAndRankPlans(plans, filter, pageOffset=0, pageSize=MAX_PAGE) {
  let set = plans;
  if (filter.operator) set = set.filter(p => p.operator === filter.operator);
  if (filter.type)     set = set.filter(p => (p.type||'').toLowerCase() === filter.type.toLowerCase());
  if (filter.budget)   set = set.filter(p => Number(p.price) <= filter.budget);
  if (filter.validity) set = set.filter(p => parseValidity(p.validity) && parseValidity(p.validity) >= filter.validity);
  if (filter.features && filter.features.length)
    for (const f of filter.features)
      set = set.filter(p => [p.benefits,p.additional_benefits,p.description].filter(Boolean).join(' ').toLowerCase().includes(f.toLowerCase()));
  if (filter.features && filter.features.includes("voice only")) set = set.filter(p =>
    (!parseDataAllowance(p.data) || parseDataAllowance(p.data) < 0.05)
  );
  if (filter.features && filter.features.includes("data only")) set = set.filter(p =>
    parseDataAllowance(p.data) && !/voice|call/i.test([p.benefits, p.description, p.additional_benefits].join(" "))
  );
  set = set.sort((a, b) => Number(a.price) - Number(b.price));
  return { total: set.length, plans: set.slice(pageOffset, pageOffset + pageSize) };
}

// Main conversational LLM-powered reply
async function generateDynamicReplyLLM(userText, filters, plans, total, pageOffset) {
  if (!plans || plans.length === 0) return null;
  // Compose plan summaries for the prompt
  const startNum = pageOffset+1;
  const planList = plans.map((p, i) => 
    `${startNum+i}. ₹${p.price}, ${p.data||''}, ${p.validity} days${p.benefits?`, Features: ${p.benefits}`:''}${p.additional_benefits?`, Extra: ${p.additional_benefits}`:''}`
  ).join('\n');
  // Build a system prompt that enforces friendliness and conciseness
  const prompt = `
You're a helpful, friendly telecom plan expert chatting with a user.
The user said: "${userText}"
Here are the matching plans to show (out of ${total} total):
${planList}

Please:
- Greet the user by name if possible, else say 'Hi' or 'Hey there'.
- Briefly summarize what you found.
- Highlight any good/best value or standout plans (mention plan number).
- Point out differences useful to the user's query (OTT, validity, price, data).
- Suggest a next action (e.g., "ask for more plans", "change budget", etc.).
Keep your reply concise, conversational and natural—like a smart human, not a robot!
`;

  try {
    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'openai/gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'Talk like a helpful telecom plan expert.' },
          { role: 'user', content: prompt }
        ]
      }),
      timeout: 3500
    });
    const data = await resp.json();
    if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
      return data.choices[0].message.content.trim();
    }
    return null;
  } catch (err) {
    log('[LLM-output] LLM failed:', err.message);
    return null;
  }
}

// Fallback/static formatter
function formatResponse({ plans, total }, filter, { pageOffset }) {
  if (plans.length === 0) {
    return `🙁 No ${filter.operator||''} plans under ₹${filter.budget||''}${filter.validity?` with at least ${filter.validity} days validity`:''}${filter.type?` (${filter.type})`:''} found. Try changing your filters!`;
  }
  let s = `📦 Showing ${plans.length} ${filter.operator||''} ${filter.type||''} plans${filter.budget ? ` under ₹${filter.budget}` : ''}${filter.validity ? ` (≥${filter.validity} days)` : ''}:\n\n`;
  s += plans.map((p,i)=> {
    const validity = typeof p.validity === 'number' ? p.validity+" days" : p.validity;
    return `${pageOffset+1+i}. ₹${p.price}: ${p.data||''}, ${validity||''}${p.benefits?` (${p.benefits})`:''}${p.additional_benefits?', '+p.additional_benefits:''}`;
  }).join('\n');
  s += `\n\n(Showing ${pageOffset+1}-${pageOffset+plans.length} of ${total})`;
  if (total > pageOffset+plans.length) s += "\nAsk for 'more' for additional plans.";
  return s.trim();
}

// Authentication middleware
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  const token = header && header.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Please log in' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Rate limiting middleware
app.use((req, res, next) => {
  const ip = req.ip;
  const now = Date.now();
  if (!requests.has(ip)) requests.set(ip, { count:0, next:now+REQ_WINDOW });
  const reqInfo = requests.get(ip);
  if (now>reqInfo.next) { reqInfo.count=0; reqInfo.next=now+REQ_WINDOW; }
  if (reqInfo.count++ > REQ_RATE_LIMIT) return res.status(429).json({ error:"Rate limit exceeded. Please wait." });
  next();
});

// Routes
app.get('/', (req, res) => res.send('📡 PlanGenie-LLM v3 (GPT-powered human-like replies) is live!'));

// Authentication Routes
app.post('/signup', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email & password required' });
  if (users[email]) return res.status(400).json({ error: 'User already exists' });

  const hash = await bcrypt.hash(password, 10);
  users[email] = { password: hash };
  res.json({ message: 'Signup successful' });
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = users[email];
  if (!user) return res.status(400).json({ error: 'User not found' });
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).json({ error: 'Wrong password' });

  const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '6h' });
  res.json({ token });
});

// OTP Routes
app.post('/otp/request', (req, res) => {
  const { to } = req.body;
  if (!to) return res.status(400).json({ error: 'Phone/email required' });
  
  const code = String(Math.floor(100000 + Math.random() * 900000));
  otps[to] = { code, expires: Date.now() + 3 * 60 * 1000 }; // 3 minutes
  console.log(`OTP for ${to}: ${code}`); // In production, send via SMS/email
  res.json({ message: 'OTP sent' });
});

app.post('/otp/verify', (req, res) => {
  const { to, code } = req.body;
  const sent = otps[to];
  if (!sent || sent.code !== code || Date.now() > sent.expires) {
    return res.status(400).json({ error: 'Invalid or expired OTP' });
  }
  delete otps[to];
  const token = jwt.sign({ email: to }, JWT_SECRET, { expiresIn: '6h' });
  res.json({ token });
});

// Profile endpoint
app.get('/profile', requireAuth, (req, res) => {
  const user = users[req.user.email];
  res.json({ email: req.user.email, registered: !!user });
});

app.get('/health', async (req, res) => {
  const start = Date.now();
  try {
    await fetchAndCachePlans();
    return res.json({
      status: 'healthy', uptime: process.uptime(),
      lastFetched: new Date(lastPlanFetch).toISOString(),
      loadMs: Date.now()-start
    });
  } catch(e){
    return res.status(503).json({ status:"unhealthy", error:e.message });
  }
});

app.post('/query', requireAuth, async (req, res) => {
  const userText = (req.body.text || '').trim();
  if (!userText) return res.status(400).json({ error: 'Query text is required' });

  // Check intent for meta-chat
  const simpleIntent = inferSimpleIntent(userText);
  if (simpleIntent.greeting) return res.json({ reply: pickRandom([
    "Hello! 😊 How can I help you find the right mobile plan today?",
    "Hi there! Ask me for any prepaid or postpaid plan details."
  ]) });
  if (simpleIntent.thanks)   return res.json({ reply: pickRandom([
    "You're welcome! Let me know if you want to explore more plans.",
    "Glad to help! Ask anytime. 👍"
  ])});
  if (simpleIntent.bye)      return res.json({ reply: pickRandom([
    "Goodbye! Hope you get the perfect plan.",
    "Take care! Come back if you need more help later."
  ]) });

  let pageOffset = 0, lastFilters = {};
  if (simpleIntent.showmore) {
    lastFilters = req.body.lastFilters || {};
    pageOffset = (req.body.lastOffset || 0) + MAX_PAGE;
  }

  // Cache lookup
  const cacheKey = JSON.stringify({ userText, pageOffset, ...(lastFilters||{}) });
  if (responseCache.has(cacheKey)) {
    const c = responseCache.get(cacheKey);
    if (Date.now()-c.ts < RESPONSE_CACHE_TTL) {
      log('✅ CacheHit');
      return res.json(c.data);
    }
  }

  try {
    await fetchAndCachePlans();
    const plansFlat = flattenPlans(cachedPlans);

    // LLM extraction only for fresh queries
    let filters = lastFilters;
    if (!simpleIntent.showmore) {
      filters = await extractFiltersViaLLM(userText);
      filters = filters || {};
      if (filters.operator) filters.operator = correctOperatorName(filters.operator) || filters.operator;
      if (filters.type)    filters.type = filters.type.toLowerCase();
      if (filters.features && typeof(filters.features)==="string") filters.features = filters.features.split(",").map(f=>f.trim());
      else if (!filters.features) filters.features = [];
    }
    // Get plans
    const { total, plans } = filterAndRankPlans(plansFlat, filters, pageOffset, MAX_PAGE);

    // AI-generated human-like reply!
    let reply = await generateDynamicReplyLLM(userText, filters, plans, total, pageOffset);
    if (!reply) reply = formatResponse({plans,total}, filters, {pageOffset}); // fallback

    // Compose output
    const out = {
      filters, count: plans.length, total,
      offset: pageOffset,
      reply,
      plans,
      nextOffset: (pageOffset+plans.length<total) ? pageOffset+MAX_PAGE : null,
    };
    responseCache.set(cacheKey, { ts: Date.now(), data: out });
    return res.json(out);
  } catch(e){
    log('❌ Query processing error:', e.message);
    return res.status(500).json({ error: e.message });
  }
});

// Error handler
app.use((err, req, res, _next)=>{
  log('Global error:', err.message, err.stack);
  res.status(500).json({ error:'Sorry, a server error occurred.' });
});

app.listen(PORT, '0.0.0.0', ()=>log(`🚀 PlanGenie-LLM (with authentication!) running at ${PORT}`));
