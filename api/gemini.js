// Vercel serverless proxy for the Gemini API.
// Keeps GEMINI_API_KEY on the server — it is never sent to the browser.
const ALLOWED_MODELS = new Set([
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash-tts',
]);
const MAX_BODY_CHARS = 4_000_000;      // Vercel's body limit is ~4.5 MB
const MAX_OUTPUT_TOKENS = 1500;
const RATE_LIMIT = { windowMs: 60_000, max: 20 };   // per IP, best-effort (per warm instance)
const hits = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => now - t < RATE_LIMIT.windowMs);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > RATE_LIMIT.max;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server' });

  // Same-origin only: stops other websites from spending your quota.
  const origin = req.headers.origin;
  if (origin) {
    try {
      if (new URL(origin).host !== req.headers.host) return res.status(403).json({ error: 'Forbidden origin' });
    } catch (e) {
      return res.status(403).json({ error: 'Forbidden origin' });
    }
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (rateLimited(ip)) return res.status(429).json({ error: 'Too many requests — please slow down' });

  let body = req.body;
  try { if (typeof body === 'string') body = JSON.parse(body); } catch (e) { return res.status(400).json({ error: 'Invalid JSON' }); }
  const { model, payload } = body || {};
  if (!ALLOWED_MODELS.has(model)) return res.status(400).json({ error: 'Model not allowed' });
  if (!payload || typeof payload !== 'object') return res.status(400).json({ error: 'Missing payload' });
  if (JSON.stringify(payload).length > MAX_BODY_CHARS) return res.status(413).json({ error: 'Payload too large' });

  if (!model.includes('tts')) {
    const gc = payload.generationConfig || {};
    payload.generationConfig = { ...gc, maxOutputTokens: Math.min(gc.maxOutputTokens || MAX_OUTPUT_TOKENS, MAX_OUTPUT_TOKENS) };
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25_000);
  try {
    const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', 'application/json');
    res.send(text);
  } catch (e) {
    res.status(502).json({ error: e.name === 'AbortError' ? 'Upstream timeout' : 'Upstream error' });
  } finally {
    clearTimeout(timer);
  }
};
