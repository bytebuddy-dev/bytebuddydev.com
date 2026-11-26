// Bugsy AI: a Cloudflare Worker between the website chat and the Groq API.
// The Groq key lives here as a secret (never in the website's code).
//
// POST /chat  { messages: [{ role: 'user' | 'assistant', content }] }
//   → { reply, action: 'none' | 'skill' | 'contact', skill_md }
//   → { fallback: true } when Groq is unavailable or the quota is used up (the site then uses scripted Bugsy)
//
// Guards: allowed origins only, ≤ 8 requests/minute per IP and ≤ 60/minute in total (Cloudflare rate limiting),
// ≤ 10 messages of ≤ 600 characters, short answers (max_completion_tokens).

import { SYSTEM_PROMPT } from './prompt.js';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-oss-20b';
const ALLOWED_ORIGINS = ['https://bytebuddydev.com', 'https://www.bytebuddydev.com', 'http://localhost:4321'];
const PER_MINUTE = 8;
const MAX_MESSAGES = 10;
const MAX_CHARS = 600;

// The reply shape Groq must return (strict JSON schema: all fields required, nothing extra).
const RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: 'bugsy_reply',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['reply', 'action', 'skill_md'],
      properties: {
        reply: { type: 'string', description: 'What Bugsy says. Short, friendly, plain text with optional [text](/path) links.' },
        action: { type: 'string', enum: ['none', 'skill', 'contact'] },
        skill_md: { type: 'string', description: 'A complete SKILL.md when action is "skill", otherwise an empty string.' },
      },
    },
  },
};

const hits = new Map(); // ip → [timestamps]
const limited = (ip) => {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear(); // keep memory bounded
  return recent.length > PER_MINUTE;
};

// Cloudflare's rate limiter counts across all its servers (an in-memory count only sees one).
// PER_IP: one visitor. ALL: everyone together, so a spread-out attack can't drain the Groq quota quickly.
// Falls back to the in-memory count when the bindings are missing (local tests).
const overLimit = async (env, ip) => {
  if (!env.PER_IP || !env.ALL) return limited(ip);
  const [one, all] = await Promise.all([env.PER_IP.limit({ key: ip }), env.ALL.limit({ key: 'all' })]);
  return !one.success || !all.success;
};

const cors = (origin) => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
  Vary: 'Origin',
});
const json = (body, status, origin) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors(origin) } });

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = ALLOWED_ORIGINS.includes(origin);
    const url = new URL(request.url);
    if (url.pathname !== '/chat') return new Response('Not found', { status: 404 });
    if (request.method === 'OPTIONS') return allowed ? new Response(null, { status: 204, headers: cors(origin) }) : new Response(null, { status: 403 });
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    if (!allowed) return new Response('Forbidden', { status: 403 });

    const ip = request.headers.get('CF-Connecting-IP') || 'local';
    if (await overLimit(env, ip)) return json({ reply: "Whoa, that's a lot of messages! Give me a minute to catch my breath 🐝", action: 'none', skill_md: '' }, 200, origin);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'bad json' }, 400, origin);
    }
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    const clean = messages
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-MAX_MESSAGES)
      .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
    if (!clean.length || clean[clean.length - 1].role !== 'user') return json({ error: 'no user message' }, 400, origin);
    if (!env.GROQ_API_KEY) return json({ fallback: true }, 200, origin);

    try {
      const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: env.GROQ_MODEL || DEFAULT_MODEL,
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...clean],
          response_format: RESPONSE_FORMAT,
          max_completion_tokens: 1800,
          temperature: 0.5,
        }),
      });
      if (!res.ok) {
        // 429 = quota used up; anything else = Groq problem. Either way the site falls back to scripted Bugsy.
        console.log('groq status', res.status);
        return json({ fallback: true }, 200, origin);
      }
      const data = await res.json();
      const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');
      const action = ['none', 'skill', 'contact'].includes(parsed.action) ? parsed.action : 'none';
      return json(
        {
          reply: String(parsed.reply || '').slice(0, 1500),
          action,
          skill_md: action === 'skill' ? String(parsed.skill_md || '').slice(0, 12000) : '',
        },
        200,
        origin,
      );
    } catch (e) {
      console.log('groq error', e?.message);
      return json({ fallback: true }, 200, origin);
    }
  },
};
