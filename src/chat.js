// Chat with Bugsy (opens when you click the docked Bugsy in the corner).
// Scripted answers always work (no server). With <html data-ai-url> set, typed messages go to
// AI Bugsy (Groq via the Cloudflare Worker in worker/), falling back to the script on any failure.
import { matchTemplate, TEMPLATES } from './tools/skill-templates.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const launch = document.getElementById('chat-launch');
const chat = document.getElementById('chat');

if (launch && chat) {
  const log = chat.querySelector('.chat-log');
  const form = chat.querySelector('form');
  const input = form.querySelector('input');
  const chips = chat.querySelector('.chat-chips');
  const IG_DM = 'https://ig.me/m/bytebuddydev';
  const issueUrl = (text) =>
    `https://github.com/bytebuddy-dev/resources/issues/new?title=${encodeURIComponent('Message from bytebuddydev.com')}&body=${encodeURIComponent(text)}`;
  let lastUserText = '';

  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };
  const scroll = () => (log.scrollTop = log.scrollHeight);
  const bot = (html, delay = 380) =>
    new Promise((res) => {
      const typing = el('div', 'msg bot typing', '<span></span><span></span><span></span>');
      log.appendChild(typing);
      scroll();
      setTimeout(() => {
        typing.remove();
        log.appendChild(el('div', 'msg bot', html));
        scroll();
        res();
      }, delay);
    });
  const user = (text) => {
    const m = el('div', 'msg user');
    m.textContent = text;
    log.appendChild(m);
    scroll();
  };
  const setChips = (list) => {
    chips.replaceChildren(
      ...list.map(([label, action]) => {
        const b = el('button', 'chip');
        b.type = 'button';
        b.textContent = label;
        b.addEventListener('click', () => {
          user(label);
          action();
        });
        return b;
      }),
    );
  };

  const contactButtons = (text) =>
    `<div class="chat-actions"><a class="chip" href="${IG_DM}" target="_blank" rel="noopener">📸 Instagram DM</a><a class="chip" href="${issueUrl(text || 'Hi Byte Buddy!')}" target="_blank" rel="noopener">🐙 GitHub message</a></div>`;

  const JOKES = [
    'Why do programmers prefer dark mode? Because light attracts bugs. 🐛',
    "It's not a bug, it's an undocumented feature.",
    'I would tell you a UDP joke, but you might not get it.',
    '99 little bugs in the code… patch one, compile again… 127 little bugs in the code.',
  ];

  const ANSWERS = {
    hello: () => bot("Hey! 👋 I'm Bugsy. Ask me where to find something, or send a message to the human who makes the videos."),
    who: () =>
      bot('I\'m Bugsy, a junior dev who ships fast and fixes things… eventually. I host <strong>Byte Buddy</strong>: AI coding tools, free dev resources and how tech works. <a href="/about/">More about us →</a>'),
    links: () =>
      bot(
        'Every link from our videos lives here:<br>• <a href="/skills/">10 Claude Skills repos</a><br>• <a href="/repos/">30 GitHub repos (parts 1–3)</a><br>• <a href="/gta/">GTA portfolio: video, code, prompts</a><br>Missing one? Tell me which video and I\'ll pass it on.',
      ),
    skills: () => bot('Here you go: <a href="/skills/">10 Claude Skills repos that feel illegal to know</a>, each with its install command. 🧠'),
    gta: () => bot('The 5 prompts (with copy buttons) are on the <a href="/gta/#prompts">GTA portfolio page</a>. The live site and code are there too. 🎮'),
    repos: () => bot('All 30 are on the <a href="/repos/">GitHub repos page</a>, split into parts 1–3.'),
    youtube: () =>
      bot(
        'Subscribe on <a href="https://www.youtube.com/@bytebuddydev" target="_blank" rel="noopener">YouTube @bytebuddydev</a> 🔔 We\'re also on <a href="https://www.instagram.com/bytebuddydev/" target="_blank" rel="noopener">Instagram</a> and <a href="https://www.tiktok.com/@bytebuddydev" target="_blank" rel="noopener">TikTok</a>.',
      ),
    contact: async (typed) => {
      await bot(
        typed
          ? "Got it! I can't send messages myself (I'm a bug, not a mail server 😅), so send it with one tap. On GitHub your text is already filled in:"
          : "Sure! I can't send messages myself yet (I'm a bug, not a mail server 😅). Type your message below, or pick how to reach the creator:",
      );
      await bot(contactButtons(typed || lastUserText), 200);
    },
    // "make me a skill for X": match a ready-made template, else start a draft from their words
    makeskill: async (typed) => {
      const text = typed || '';
      const subject = (text.match(/skills?\s+(?:for|to|that|which|about|on|so)\s+(.+)/i)?.[1] ?? text.replace(/.*?\bskills?\b/i, ''))
        .replace(/[?.!]+$/, '')
        .trim();
      const tpl = matchTemplate(text);
      const GEN = '/tools/skill-md-generator/';
      if (tpl) {
        await bot(`On it! 🛠️ I have a ready-made <strong>${esc(tpl.title)}</strong> skill. It's filled in and ready to download:`);
        await bot(
          `<div class="chat-actions"><a class="chip on" href="${GEN}?t=${tpl.name}">${tpl.icon} Open my SKILL.md →</a>${subject ? `<a class="chip" href="${GEN}?idea=${encodeURIComponent(subject)}">Start a custom one instead</a>` : ''}</div>`,
          200,
        );
      } else if (subject.length > 2) {
        await bot(`I don't have a template for "${esc(subject)}" yet, so I started a draft from your idea. Add the steps and it's ready. (The AI version of me will write the whole thing soon 🤖)`);
        await bot(`<div class="chat-actions"><a class="chip on" href="${GEN}?idea=${encodeURIComponent(subject)}">🛠️ Open my draft →</a></div>`, 200);
      } else {
        await bot('Sure! What should the skill do? Type something like "a skill for code reviews", or pick one:');
        setChips(
          TEMPLATES.slice(0, 6).map((t) => [`${t.icon} ${t.title}`, () => answer('makeskill', `skill for ${t.title}`)]),
        );
        return 'keep-chips';
      }
    },
    // "write me a CLAUDE.md for my Django app" → the generator, with the stack picked
    agentsmd: async (typed) => {
      const t = (typed || '').toLowerCase();
      // order matters: "next.js" before "node"
      const STACK_WORDS = [['monorepo', /monorepo|turbo/], ['nextjs', /next\.?js|\bnext\b/], ['react-vite', /\breact\b|\bvite\b/], ['fastapi', /fastapi/], ['django', /django/], ['node-api', /\bnode(\.?js)?\b|express|fastify/], ['go', /\bgo\b|golang/], ['rust', /\brust\b|cargo/], ['flutter', /flutter|\bdart\b/], ['laravel', /laravel|\bphp\b/], ['spring', /spring|\bjava\b/], ['dotnet', /\.net\b|dotnet|c#/]];
      const stack = STACK_WORDS.find(([, re]) => re.test(t))?.[0];
      const url = '/tools/agents-md-generator/' + (stack ? '?stack=' + stack : '');
      await bot(stack ? "On it! 🤖 I've picked your stack. Tick your rules and download both files:" : 'Pick your stack, tick your rules, and you get an AGENTS.md and a CLAUDE.md that every coding agent can read:');
      await bot(`<div class="chat-actions"><a class="chip on" href="${url}">📄 Open the generator →</a><a class="chip" href="/tools/agents-md-generator/#checker">Check my existing file</a></div>`, 200);
    },
    // "set up the github mcp in cursor" → the MCP generator with the app and servers picked
    mcp: async (typed) => {
      const t = (typed || '').toLowerCase();
      // order matters: "claude desktop" before "claude", "vs code" before "code"
      const APP_WORDS = [['claude-desktop', /claude[ _-]?desktop/], ['cursor', /cursor/], ['vscode', /vs ?code|visual studio code/], ['copilot', /copilot/], ['windsurf', /windsurf/], ['codex', /codex/], ['antigravity', /antigravity/], ['gemini', /gemini/], ['zed', /\bzed\b/], ['claude-code', /claude/]];
      const SERVER_IDS = ['github', 'playwright', 'chrome-devtools', 'context7', 'filesystem', 'git', 'fetch', 'memory', 'sequential-thinking', 'brave-search', 'exa', 'firecrawl', 'sentry', 'linear', 'notion', 'atlassian', 'figma', 'supabase', 'stripe', 'vercel', 'cloudflare', 'postgres'];
      const app = APP_WORDS.find(([, re]) => re.test(t))?.[0];
      // whole words: "github" must not also pick "git"
      const servers = SERVER_IDS.filter((id) => new RegExp(`\\b${id.replace('-', '[ -]?')}\\b`).test(t) || (id === 'atlassian' && /jira|confluence/.test(t)) || (id === 'chrome-devtools' && /devtools/.test(t)));
      const q = new URLSearchParams();
      if (app) q.set('app', app);
      if (servers.length) q.set('servers', servers.join(','));
      const url = '/tools/mcp-config-generator/' + (q.size ? '?' + q : '');
      await bot(app || servers.length ? "Done! 🔌 I've set it up for you. Check the options, then copy the config:" : 'Pick your app and your MCP servers, and you get the exact config file, the terminal command and where to save it:');
      await bot(`<div class="chat-actions"><a class="chip on" href="${url}">🔌 Open the MCP generator →</a><a class="chip" href="/tools/mcp-config-generator/#converter">Convert or check my config</a></div>`, 200);
    },
    ai: () => bot("Not yet! For now I'm a simple bot that knows this site. A real AI version of me is on the roadmap. 🤖"),
    joke: () => bot(JOKES[Math.floor(Math.random() * JOKES.length)]),
  };

  const INTENTS = [
    // first: "hi, can you make me a skill to fix errors" is a skill request, not a greeting or a message
    // before skills/makeskill: "make a claude.md" is about instruction files, not skills
    ['mcp', /\bmcp\b|model context protocol|claude_desktop_config|mcp_servers/],
    ['agentsmd', /\b(agents?|claude)[ .]?md\b|\binstructions? file\b/],
    ['makeskill', /\b(create|make|generate|build|write|need|want|give)\b.*\bskills?\b|\bskills?\s+(for|to|that)\b/],
    ['hello', /^(hi|hey|hello|yo|salam|assalam|sup)\b/],
    // contact first: "collab on a video" is a message, not a request for links
    ['contact', /\b(contact|message|email|mail|collab|sponsor|business|mistake|wrong|error|idea|suggest|hire|dm)/],
    ['gta', /\b(gta|prompt|cheat|portfolio|hesoyam)/],
    ['skills', /\b(skill|claude)/],
    ['repos', /\b(repo|github|list)/],
    ['links', /\b(link|where|find|resource|video)/],
    ['youtube', /\b(youtube|subscribe|follow|instagram|tiktok|channel)/],
    ['ai', /\b(ai|gpt|chatbot)\b|are you (a )?(bot|real|human)/],
    ['joke', /\b(joke|funny|laugh)/],
    ['who', /(who|what) are you|bugsy|\babout\b/],
  ];

  const MAIN = () => [
    ['🛠️ Make me a skill', () => answer('makeskill')],
    ['🔗 Links from a video', () => answer('links')],
    ['💬 Message the creator', () => answer('contact')],
    ['🧠 Claude Skills', () => answer('skills')],
    ['🎮 GTA prompts', () => answer('gta')],
    ['😂 Tell me a joke', () => answer('joke')],
  ];
  const answer = async (key, typed) => {
    const r = await ANSWERS[key](typed);
    if (r !== 'keep-chips') setChips(MAIN());
  };
  // ---------- AI Bugsy (Groq via our Cloudflare Worker) ----------
  // Enabled when the page has <html data-ai-url="…">. Any failure falls back to the scripted answers above.
  const AI_URL = document.documentElement.dataset.aiUrl || '';
  const history = []; // [{ role, content }] for the AI's context
  const SOCIAL = /^https:\/\/(www\.)?(youtube\.com\/@bytebuddydev|instagram\.com\/bytebuddydev|tiktok\.com\/@bytebuddydev|github\.com\/bytebuddy-dev)([/?#]|$)/;
  // Our own pages only: "/path". Browsers read "/\evil.com" and "//evil.com" as another website, so no second slash or backslash.
  const OWN = /^\/(?![/\\])[^\\\s]*$/;
  /** AI text → safe HTML: escaped, with **bold** and [links](…) only to our pages or our channels. */
  const aiHtml = (s) =>
    esc(s)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => {
        const url = u.replace(/&amp;/g, '&');
        if (OWN.test(url)) return `<a href="${esc(url)}">${t}</a>`;
        if (SOCIAL.test(url)) return `<a href="${esc(url)}" target="_blank" rel="noopener">${t}</a>`;
        return t;
      })
      .replace(/\n/g, '<br>');
  const askAI = async (text) => {
    if (!AI_URL) return null;
    const typing = el('div', 'msg bot typing', '<span></span><span></span><span></span>');
    log.appendChild(typing);
    scroll();
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 20000);
      const res = await fetch(AI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...history, { role: 'user', content: text }].slice(-10) }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      const data = res.ok ? await res.json() : null;
      if (!data || data.fallback || !data.reply) return null;
      return data;
    } catch {
      return null;
    } finally {
      typing.remove();
    }
  };
  const showAI = async (text, data) => {
    history.push({ role: 'user', content: text }, { role: 'assistant', content: data.reply });
    await bot(aiHtml(data.reply), 0);
    if (data.action === 'contact') await bot(contactButtons(text), 150);
    if (data.action === 'skill' && data.skill_md) {
      const { validateSkill } = await import('./tools/skill-rules.js');
      const errors = validateSkill(data.skill_md).filter((r) => r.level === 'error');
      if (errors.length) {
        // never hand out a broken file: send them to the generator with their idea instead
        await bot(`Hmm, my draft didn't pass the official checks (${esc(errors[0].text)}). Let's build it in the generator instead:`, 150);
        await bot(`<div class="chat-actions"><a class="chip on" href="/tools/skill-md-generator/?idea=${encodeURIComponent(text.slice(0, 120))}">🛠️ Open the generator →</a></div>`, 100);
      } else {
        const id = 'sk' + Date.now();
        await bot(
          `<details class="skill-preview"><summary>📄 Preview SKILL.md</summary><pre>${esc(data.skill_md)}</pre></details><div class="chat-actions"><button type="button" class="chip on" data-dl="${id}">⬇️ Download SKILL.md</button><a class="chip" href="/tools/skill-md-generator/?from=chat#validator" data-open="${id}">Check it in the validator</a></div>`,
          150,
        );
        const md = data.skill_md;
        log.querySelector(`[data-dl="${id}"]`)?.addEventListener('click', () => {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }));
          a.download = 'SKILL.md';
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        });
        log.querySelector(`[data-open="${id}"]`)?.addEventListener('click', () => {
          try {
            sessionStorage.setItem('bb-chat-skill', md);
          } catch {
            /* private mode: the validator just opens empty */
          }
        });
      }
    }
    setChips(MAIN());
  };

  const reply = async (text) => {
    const t = text.toLowerCase();
    const hit = INTENTS.find(([, re]) => re.test(t));
    // Instant local answers first: contact handover and ready-made skill templates.
    if (hit?.[0] === 'contact' || hit?.[0] === 'agentsmd' || hit?.[0] === 'mcp') return answer(hit[0], text);
    // With AI on, only a strong template match (e.g. "code review", not just "broken") skips the AI.
    const m = matchTemplate(text, { withScore: true });
    if (hit?.[0] === 'makeskill' && (!AI_URL || m.score >= 10)) return answer('makeskill', text);
    // Everything else: AI Bugsy, if it's switched on and answering.
    const data = await askAI(text);
    if (data) return showAI(text, data);
    if (hit) return answer(hit[0], hit[0] === 'makeskill' ? text : undefined);
    // Anything else is treated as a message for the creator.
    await bot("I'm a simple bot, so I'll pass that to the human. Send it with one tap (on GitHub your text is already filled in):");
    await bot(contactButtons(text), 200);
    setChips(MAIN());
  };

  if (AI_URL) chat.querySelector('header small').textContent = 'AI Bugsy · can make mistakes';

  let opened = false;
  const open = () => {
    chat.hidden = false;
    launch.setAttribute('aria-expanded', 'true');
    document.documentElement.classList.add('chat-open');
    dispatchEvent(new CustomEvent('bugsy:mood', { detail: 'wave' }));
    if (!opened) {
      opened = true;
      bot("Hi! I'm Bugsy 🐝 What can I help you find?", 250).then(() => setChips(MAIN()));
    }
    if (matchMedia('(pointer: fine)').matches) setTimeout(() => input.focus({ preventScroll: true }), 60);
  };
  const close = () => {
    chat.hidden = true;
    launch.setAttribute('aria-expanded', 'false');
    document.documentElement.classList.remove('chat-open');
    launch.focus({ preventScroll: true });
  };
  launch.addEventListener('click', () => (chat.hidden ? open() : close()));
  chat.querySelector('.chat-close').addEventListener('click', close);
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !chat.hidden) close();
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    lastUserText = text;
    user(text);
    reply(text);
  });

  // No WebGL (or 3D still not running after a while): show a picture of Bugsy on the launcher instead.
  setTimeout(() => {
    if (!document.documentElement.classList.contains('bugsy-ready')) document.documentElement.classList.add('no3d');
  }, 4000);
}
