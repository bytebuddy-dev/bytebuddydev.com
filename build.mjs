// npm run build → docs/ (GitHub Pages: Settings → Pages → Deploy from branch → main /docs).
// Every page is plain HTML (fast, fully crawlable); the 3D Bugsy is an extra layer loaded after the page.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { build } from 'esbuild';
import { marked } from 'marked';
import { SERVERS as MCP_SERVERS, CHECKED as MCP_CHECKED } from './src/tools/mcp-servers.js';
import { CHECKED as HOOKS_CHECKED } from './src/tools/hooks-recipes.js';
const SERVER_COUNT = MCP_SERVERS.length;

const ORIGIN = 'https://bytebuddydev.com';
// AI Bugsy: the deployed Worker's /chat URL (public; the Groq key is a Worker secret). BUGSY_AI_URL=http://localhost:8787/chat to test locally.
const AI_URL = process.env.BUGSY_AI_URL ?? 'https://bugsy-ai.bugsy-ai.workers.dev/chat'; // BUGSY_AI_URL= (empty) for scripted Bugsy only
const OUT = 'docs';
const TODAY = new Date().toISOString().slice(0, 10);
const SOCIAL = {
  youtube: 'https://www.youtube.com/@bytebuddydev',
  instagram: 'https://www.instagram.com/bytebuddydev/',
  tiktok: 'https://www.tiktok.com/@bytebuddydev',
  github: 'https://github.com/bytebuddy-dev',
};
const read = (f) => fs.readFileSync(f, 'utf8');
const json = (f) => JSON.parse(read(f));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** Tiny inline markdown: `code`, **bold**, [text](url). */
const md = (s) =>
  esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, u) => `<a href="${u}"${u.startsWith('http') ? ' rel="noopener"' : ''}>${t}</a>`);

const SEARCH_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
const ICONS = {
  youtube: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="1" y="4.5" width="22" height="15" rx="4.5" fill="#ff0033"/><path d="M10 8.6v6.8l5.8-3.4z" fill="#fff"/></svg>',
  instagram: '<svg viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="ig" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#feda75"/><stop offset=".35" stop-color="#fa7e1e"/><stop offset=".6" stop-color="#d62976"/><stop offset="1" stop-color="#4f5bd5"/></linearGradient></defs><rect x="1" y="1" width="22" height="22" rx="6.5" fill="url(#ig)"/><rect x="5.5" y="5.5" width="13" height="13" rx="4" fill="none" stroke="#fff" stroke-width="1.8"/><circle cx="12" cy="12" r="3.1" fill="none" stroke="#fff" stroke-width="1.8"/></svg>',
  tiktok: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="1" y="1" width="22" height="22" rx="6" fill="#000"/><path d="M13.6 5h2.3c.2 1.6 1.4 2.9 3 3.1v2.4a5.6 5.6 0 0 1-3-1v5.2a4.3 4.3 0 1 1-4.3-4.3l.6.05v2.5a1.9 1.9 0 1 0 1.4 1.8z" fill="#fff"/></svg>',
  github: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .5a11.5 11.5 0 0 0-3.6 22.4c.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A11.5 11.5 0 0 0 12 .5z"/></svg>',
};
const PLAY = '<svg viewBox="0 0 68 48" aria-hidden="true"><path d="M66.5 7.7a8.6 8.6 0 0 0-6-6C55.2.3 34 .3 34 .3s-21.2 0-26.5 1.4a8.6 8.6 0 0 0-6 6C.1 13 .1 24 .1 24s0 11 1.4 16.3a8.6 8.6 0 0 0 6 6C12.8 47.7 34 47.7 34 47.7s21.2 0 26.5-1.4a8.6 8.6 0 0 0 6-6C67.9 35 67.9 24 67.9 24s0-11-1.4-16.3z" fill="#ff0033"/><path d="M27 34.3 44.6 24 27 13.7z" fill="#fff"/></svg>';
const socials = () =>
  `<div class="follow">${[
    ['youtube', 'YouTube'],
    ['instagram', 'Instagram'],
    ['tiktok', 'TikTok'],
    ['github', 'GitHub'],
  ]
    .map(([k, label]) => `<a class="social" href="${SOCIAL[k]}" rel="noopener me">${ICONS[k]} ${label}</a>`)
    .join('')}</div>`;

const ORG = {
  '@type': 'Organization',
  '@id': `${ORIGIN}/#org`,
  name: 'Byte Buddy',
  url: `${ORIGIN}/`,
  logo: `${ORIGIN}/img/icon-192.png`,
  sameAs: Object.values(SOCIAL),
};

const NAV = [
  ['/', 'Home', 'hide-sm'],
  ['/tools/', 'Tools', ''],
  ['/skills/', 'Skills', 'hide-xs'],
  ['/repos/', 'Repos', 'hide-sm'],
  ['/blog/', 'Blog', ''],
  ['/gta/', 'GTA Portfolio', 'hide-sm'],
  ['/about/', 'About', 'hide-xs'],
];

// Content Security Policy: the browser only runs our own scripts and only talks to the services listed here,
// so even a bug that let someone inject HTML couldn't load or send anything elsewhere. The one inline script
// (theme before first paint) is allowed by its hash. GitHub Pages can't send headers, so this is a <meta> tag.
const THEME_JS = "try{var t=localStorage.getItem('bb-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}";
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'sha256-${createHash('sha256').update(THEME_JS).digest('base64')}'`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  `connect-src 'self'${AI_URL ? ' ' + new URL(AI_URL).origin : ''}`,
  'frame-src https://www.youtube-nocookie.com',
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ') + ';'; // trailing ; so anything appended later (some antivirus tools do) stays a separate rule

/** Full HTML page. `scripts` = extra page scripts in /assets (e.g. a tool). */
const layout = ({ url, title, description, image = '/img/og.jpg', body, schema = [], type = 'website', scripts = [] }) => `<!doctype html>
<html lang="en"${AI_URL ? ` data-ai-url="${esc(AI_URL)}"` : ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<meta name="referrer" content="strict-origin-when-cross-origin">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${ORIGIN}${url}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="color-scheme" content="dark light">
<meta name="theme-color" content="#0b0814" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#faf8f4" media="(prefers-color-scheme: light)">
<script>${THEME_JS}</script>
<meta property="og:site_name" content="Byte Buddy">
<meta property="og:type" content="${type}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${ORIGIN}${url}">
<meta property="og:image" content="${ORIGIN}${image}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/img/favicon-48.png" sizes="48x48" type="image/png">
<link rel="apple-touch-icon" href="/img/icon-192.png">
<link rel="alternate" type="application/rss+xml" title="Byte Buddy Blog" href="/blog/rss.xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600..800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;700&display=swap">
<link rel="stylesheet" href="/assets/site.css?v=${STAMP}">
${schema.length ? `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': schema })}</script>` : ''}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site-header"><div class="wrap">
<a class="brand" href="/"><img src="/img/icon-192.png" alt="" width="36" height="36">Byte<span>Buddy</span></a>
<nav class="nav" aria-label="Main">${NAV.map(([h, l, c]) => `<a href="${h}"${c ? ` class="${c}"` : ''}${h === url ? ' aria-current="page"' : ''}>${l}</a>`).join('')}</nav>
<button class="search-btn" type="button" aria-label="Search the site" aria-keyshortcuts="Control+K"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><span>Search</span><kbd>Ctrl K</kbd></button>
<button class="theme-btn" type="button" aria-label="Switch colour theme"><svg class="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg><svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></svg></button>
</div></header>
<main id="main">
${body}
</main>
<footer class="site-footer"><div class="wrap">
<div class="foot-grid">
<div class="foot-brand"><a class="brand" href="/"><img src="/img/icon-192.png" alt="" width="34" height="34" loading="lazy">Byte<span>Buddy</span></a><p>Practical tech for developers, hosted by a bug. Free tools and guides, checked against the official docs.</p></div>
<div><p class="foot-h">Free tools</p><nav aria-label="Tools">${TOOLS.map((t) => `<a href="${t.url}">${esc(t.short)}</a>`).join('')}<a href="/tools/">All tools</a></nav></div>
<div><p class="foot-h">Guides</p><nav aria-label="Guides"><a href="/blog/">Blog</a><a href="/skills/">Claude Skills repos</a><a href="/repos/">30 GitHub repos</a><a href="/gta/">GTA 6-style portfolio</a></nav></div>
<div><p class="foot-h">Byte Buddy</p><nav aria-label="Byte Buddy"><a href="/about/">About</a><a href="/contact/">Contact</a><a href="/privacy/">Privacy</a><a href="${SOCIAL.youtube}" rel="noopener">YouTube</a><a href="${SOCIAL.github}" rel="noopener">GitHub</a></nav></div>
</div>
<div class="foot-base"><span>© ${new Date().getFullYear()} Byte Buddy</span><span>Free, no sign-up. Nothing you type in our tools leaves your browser.</span></div>
</div></footer>
<dialog id="palette" aria-label="Search the site"><form method="dialog"><div class="pal-in">${SEARCH_ICON}<label class="sr" for="pal-q">Search</label><input id="pal-q" type="search" autocomplete="off" spellcheck="false" placeholder="Search tools, guides, repos…" role="combobox" aria-expanded="true" aria-controls="pal-list"><kbd>Esc</kbd></div><ul id="pal-list" role="listbox"></ul><p class="pal-foot"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>Enter</kbd> open</span></p></form></dialog>
<canvas id="bugsy-canvas" aria-hidden="true"></canvas>
<div id="bugsy-bubble" role="status" aria-live="polite"></div>
<button id="chat-launch" type="button" aria-label="Chat with Bugsy" aria-expanded="false" aria-controls="chat"><span class="chat-tip">Chat with me!</span></button>
<section id="chat" aria-label="Chat with Bugsy" hidden>
  <header><img src="/img/icon-192.png" alt="" width="34" height="34"><div><strong>Bugsy</strong><small>Replies instantly · I'm a bot</small></div><button class="chat-close" type="button" aria-label="Close chat">✕</button></header>
  <div class="chat-log" aria-live="polite"></div>
  <div class="chat-chips"></div>
  <form><label class="sr" for="chat-input">Message</label><input id="chat-input" autocomplete="off" maxlength="500" placeholder="Ask Bugsy or leave a message…"><button type="submit" aria-label="Send">➤</button></form>
</section>
<script type="module" src="/assets/site.js?v=${STAMP}"></script>
<script type="module" src="/assets/chat.js?v=${STAMP}"></script>
${scripts.map((s) => `<script type="module" src="/assets/${s}?v=${STAMP}"></script>`).join('\n')}
</body>
</html>
`;

const crumbs = (items) =>
  `<nav class="crumbs" aria-label="Breadcrumb">${items.map(([u, l], i) => (i < items.length - 1 ? `<a href="${u}">${esc(l)}</a> / ` : esc(l))).join('')}</nav>`;
const crumbSchema = (items) => ({
  '@type': 'BreadcrumbList',
  itemListElement: items.map(([u, l], i) => ({ '@type': 'ListItem', position: i + 1, name: l, item: `${ORIGIN}${u}` })),
});
const ytBox = (id, title, thumb) =>
  `<div class="yt" data-id="${id}" data-title="${esc(title)}"><img src="${thumb}" alt="${esc(title)}" width="1280" height="720" loading="lazy"><button type="button" aria-label="Play: ${esc(title)}">${PLAY}</button></div>`;

// ---------------- content ----------------
const skills = json('content/skills.json');
// owner-repo: repo names alone clash (anthropics/skills, remotion-dev/skills)
const skillId = (s) => s.repo.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const repoParts = json('content/repos.json');
const GTA = {
  id: 'hEl5TOqYgd0',
  title: 'I Built a GTA 6 Style Portfolio with Claude Code',
  uploaded: '2026-11-21T12:16:25-08:00',
  seconds: 462,
  demo: 'https://bytebuddy-dev.github.io/gta6-style-portfolio/',
  code: 'https://github.com/bytebuddy-dev/gta6-style-portfolio',
};

// Each tool: a page with the tool, then a real written guide (what Google ranks, what AdSense counts).
const TOOLS = [
  {
    url: '/tools/skill-md-generator/',
    name: 'SKILL.md generator & validator',
    short: 'SKILL.md generator',
    blurb: 'Make a Claude / Agent Skill in a minute, or paste one to check it against the official rules.',
    art: ['SKILL.md', 'Generator + validator'],
  },
  {
    url: '/tools/agents-md-generator/',
    name: 'AGENTS.md & CLAUDE.md generator',
    short: 'AGENTS.md generator',
    blurb: 'Pick your stack, tick your rules, get an AGENTS.md and CLAUDE.md. Plus a checker for leaked secrets and vague rules.',
    art: ['AGENTS.md', 'Generator + checker'],
  },
  {
    url: '/tools/mcp-config-generator/',
    name: 'MCP config generator & converter',
    short: 'MCP config generator',
    blurb: 'The exact MCP config for Claude Code, Cursor, VS Code, Codex and 6 more apps, or convert one app\'s config to another.',
    art: ['mcp.json', 'Generator + converter'],
  },
  {
    url: '/tools/claude-code-hooks-generator/',
    name: 'Claude Code hooks generator & checker',
    short: 'Claude Code hooks generator',
    blurb: 'Notifications, auto-format, blocked dangerous commands, tests before Claude finishes: pick them, copy one settings.json. macOS, Linux and Windows.',
    art: ['hooks', 'Generator + checker'],
  },
];
const toolCard = (t) =>
  `<a class="card" href="${t.url}"><div class="art art-tool" aria-hidden="true"><span>${esc(t.art[0])}</span><small>${esc(t.art[1])}</small></div><div class="body"><span class="tag">Free tool</span><h3>${esc(t.name)}</h3><p>${esc(t.blurb)}</p><span class="go">Open the tool →</span></div></a>`;

const pages = [];

// ---- home ----
pages.push({
  url: '/',
  title: 'Byte Buddy: AI Coding Tools, Free Dev Resources & How Tech Works',
  description: 'Practical tech for developers, hosted by a bug. Free GitHub repo lists, Claude Code skills, prompts and the code behind our videos.',
  schema: [
    ORG,
    { '@type': 'WebSite', '@id': `${ORIGIN}/#site`, url: `${ORIGIN}/`, name: 'Byte Buddy', publisher: { '@id': `${ORIGIN}/#org` } },
  ],
  body: `
<section class="hero" aria-labelledby="hero-title">
  <div class="grid-floor" aria-hidden="true"></div>
  <div class="wrap hero-inner">
    <div>
      <span class="eyebrow">🐝 Byte Buddy</span>
      <h1 id="hero-title">Practical tech for developers, <span class="hl">hosted by a bug</span></h1>
      <p class="lead">AI coding tools, free developer resources and how tech really works. Every repo, prompt and line of code from our videos, in one place.</p>
      <div class="cta">
        <a class="btn btn-primary" href="/tools/">Browse free tools →</a>
        <a class="btn btn-ghost" href="${SOCIAL.youtube}" rel="noopener">${ICONS.youtube} Watch on YouTube</a>
      </div>
      <ul class="trust" aria-label="Why use our tools"><li>Free, no sign-up</li><li>Runs in your browser</li><li>Checked against official docs</li></ul>
    </div>
    <div id="bugsy-spot">
      <img src="/img/bugsy.png" alt="Bugsy, the Byte Buddy mascot: a yellow 3D bug with a cap and headphones" width="420" height="636" fetchpriority="high">
      <div class="poke-hint" aria-hidden="true">psst… poke him</div>
    </div>
  </div>
</section>

<section id="tools"><div class="wrap">
  <div class="section-head"><div><span class="kicker">Free tools</span><h2>Set up your AI coding agent in minutes</h2></div><p>Generators and checkers built on the official specs.</p></div>
  <div class="cards">
${TOOLS.map(toolCard).join('\n')}
  </div>
</div></section>

<section id="new"><div class="wrap">
  <div class="section-head"><div><span class="kicker">Guides &amp; lists</span><h2>Fresh from the videos</h2></div><p>Every repo, prompt and line of code, in one place.</p></div>
  <div class="cards">
    <a class="card" href="/gta/">
      <img src="/img/gta-site.jpg" alt="The GTA 6-style portfolio: synthwave sunset hero with Bugsy" width="1280" height="720" loading="lazy">
      <div class="body"><span class="tag new">Video + code + prompts</span><h3>A GTA 6-style portfolio built with Claude Code</h3><p>Working cheat codes, a minimap menu and a MISSION PASSED contact form. Free code and the prompts to build your own.</p><span class="go">Open →</span></div>
    </a>
    <a class="card" href="/skills/">
      <div class="art art-skills" aria-hidden="true"><span>10</span><small>Claude Skills</small></div>
      <div class="body"><span class="tag">List</span><h3>10 Claude Skills repos that feel illegal to know</h3><p>Free skills that turn Claude into a planner, a designer, a scientist and a test engineer, with the install command for each.</p><span class="go">See the list →</span></div>
    </a>
    <a class="card" href="/repos/">
      <div class="art art-repos" aria-hidden="true"><span>30</span><small>GitHub repos</small></div>
      <div class="body"><span class="tag">Lists</span><h3>30 GitHub repos every developer should know</h3><p>Three hand-picked lists: learning resources, deep dives and tools you can use today.</p><span class="go">Browse →</span></div>
    </a>
  </div>
</div></section>

<section><div class="wrap">
  <div class="section-head"><h2>What we make</h2></div>
  <div class="pillars">
    <div class="pillar"><div class="icon">🤖</div><h3>AI coding tools</h3><p>Claude Code, MCP, agents and prompting, shown on real projects, including the parts the AI gets wrong.</p></div>
    <div class="pillar"><div class="icon">⚙️</div><h3>How tech works</h3><p>Why games run the same at 30 and 60 FPS, how Maps finds the fastest route, why "delete" doesn't delete.</p></div>
    <div class="pillar"><div class="icon">📦</div><h3>Free dev resources</h3><p>Repos, tools, APIs and sites worth bookmarking. Every link is checked before it goes in a video.</p></div>
  </div>
</div></section>

<section><div class="wrap">
  <div class="section-head"><h2>Follow Bugsy</h2><p>New Shorts most days.</p></div>
  ${socials()}
</div></section>
`,
});

// ---- skills ----
pages.push({
  url: '/skills/',
  title: '10 Claude Skills Repos That Feel Illegal to Know (Free, 2026)',
  description: 'The best free Claude Skills on GitHub: superpowers, Anthropic skills, UI UX Pro Max, planning-with-files and more, with what each does and how to install it.',
  type: 'article',
  schema: [
    ORG,
    crumbSchema([['/', 'Home'], ['/skills/', 'Claude Skills']]),
    { '@type': 'Article', headline: '10 Claude Skills repos that feel illegal to know', datePublished: '2026-11-25', dateModified: TODAY, author: { '@id': `${ORIGIN}/#org` }, publisher: { '@id': `${ORIGIN}/#org` }, mainEntityOfPage: `${ORIGIN}/skills/` },
    { '@type': 'ItemList', itemListElement: skills.map((s) => ({ '@type': 'ListItem', position: s.n, name: s.repo, url: `https://github.com/${s.repo}` })) },
  ],
  body: `
<div class="wrap page-hero">${crumbs([['/', 'Home'], ['/skills/', 'Claude Skills']])}
<span class="eyebrow">🧠 Claude Skills</span>
<h1>10 Claude Skills repos that feel <span class="hl">illegal</span> to know</h1>
<p class="lead">Skills are folders of instructions (a <code>SKILL.md</code> plus optional scripts) that Claude loads only when a task needs them. These ten free repos give you hundreds of them.</p>
</div>
<article class="wrap article">
<p class="meta">Star counts checked on GitHub on 25 November 2026. Descriptions and install commands come from each repo's README.</p>
<div class="note"><strong>How to install:</strong> in Claude Code, <code>/plugin marketplace add owner/repo</code> registers a repo, then <code>/plugin install</code> adds a plugin from it. Repos that follow the open Agent Skills format also work with <code>npx skills add owner/repo</code>.</div>
${skills
  .map(
    (s) => `<section class="repo" id="${skillId(s)}">
<h2><span class="num">${s.n}</span><a href="https://github.com/${s.repo}" rel="noopener">${esc(s.repo)}</a></h2>
<div class="stars">★ ${esc(s.stars)} stars</div>
<p>${esc(s.what)}</p>
<p><strong>Why it's worth it:</strong> ${esc(s.why)}.</p>
${s.install ? `<pre><code>${esc(s.install)}</code></pre>` : `<p>Install: see the <a href="https://github.com/${s.repo}#readme" rel="noopener">README</a> for your agent.</p>`}
</section>`,
  )
  .join('\n')}
<h2>Want more?</h2>
<p><a href="https://github.com/VoltAgent/awesome-agent-skills" rel="noopener">VoltAgent/awesome-agent-skills</a> collects 1,000+ agent skills from dev teams like Anthropic and Vercel, plus the community. Before you install any skill, read its <code>SKILL.md</code> and scripts: a skill can run code on your machine.</p>
<p>Next: <a href="/repos/">30 GitHub repos every developer should know →</a></p>
</article>`,
});

// ---- repos ----
const partBlurb = {
  'Part 1': 'Big free learning resources: books, courses, study plans and project ideas.',
  'Part 2': 'Deeper dives: build an LLM from scratch, how JavaScript really works, the command line.',
  'Part 3': 'Tools you can install and use today, from local AI models to file sharing.',
};
pages.push({
  url: '/repos/',
  title: '30 GitHub Repos Every Developer Should Know (Free Resources)',
  description: 'Thirty free GitHub repositories for developers in three lists: learning resources, deep dives and tools you can use today. Every link checked.',
  type: 'article',
  schema: [
    ORG,
    crumbSchema([['/', 'Home'], ['/repos/', 'GitHub Repos']]),
    { '@type': 'Article', headline: '30 GitHub repos every developer should know', datePublished: '2026-11-25', dateModified: TODAY, author: { '@id': `${ORIGIN}/#org` }, publisher: { '@id': `${ORIGIN}/#org` }, mainEntityOfPage: `${ORIGIN}/repos/` },
  ],
  body: `
<div class="wrap page-hero">${crumbs([['/', 'Home'], ['/repos/', 'GitHub Repos']])}
<span class="eyebrow">📦 Free resources</span>
<h1>30 GitHub repos every developer <span class="hl">should know</span></h1>
<p class="lead">The repos from our "GitHub repos that feel illegal to know" series, all free. Every link was checked before it went into a video: it exists, isn't archived and is still maintained.</p>
</div>
<article class="wrap article">
${repoParts
  .map(
    (p, i) => `<h2 id="part-${i + 1}">${esc(p.part)}: ${esc(p.title)}</h2>
<p>${esc(partBlurb[p.part] ?? '')}${p.video ? ` <a href="${p.video}" rel="noopener">Watch the video →</a>` : ''}</p>
<table><thead><tr><th>#</th><th>Repo</th><th>What it is</th></tr></thead><tbody>
${p.repos.map((r, j) => `<tr><td>${j + 1}</td><td><a href="${r.url}" rel="noopener">${esc(r.repo)}</a></td><td>${esc(r.what)}</td></tr>`).join('\n')}
</tbody></table>`,
  )
  .join('\n')}
<p>Next: <a href="/skills/">10 Claude Skills repos that feel illegal to know →</a></p>
</article>`,
});

// ---- gta ----
const promptMd = read('content/gta-prompts.md');
const prompts = [...promptMd.matchAll(/## (\d+\. [^\n]+)\n\n```\n([\s\S]*?)```/g)].map((m) => ({ title: m[1], text: m[2].trim() }));
const bugRows = read('content/gta-build-log.md')
  .split('\n')
  .filter((l) => /^\| \d+ \|/.test(l))
  .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
pages.push({
  url: '/gta/',
  title: 'GTA 6-Style Portfolio Built with Claude Code (Free Code + Prompts)',
  description: 'A GTA 6-style developer portfolio with working cheat codes, built with Claude Code in plain HTML, CSS and JS. Play it, then get the code and the prompts.',
  image: '/img/gta-thumb.jpg',
  type: 'article',
  schema: [
    ORG,
    crumbSchema([['/', 'Home'], ['/gta/', 'GTA Portfolio']]),
    {
      '@type': 'VideoObject',
      name: GTA.title,
      description: 'Building a GTA 6-style developer portfolio with Claude Code: parallax sunset, wanted-level skills, mission cards, a minimap and working cheat codes, plus the 8 bugs Claude made and how screenshots caught them.',
      thumbnailUrl: [`${ORIGIN}/img/gta-thumb.jpg`, `https://i.ytimg.com/vi/${GTA.id}/hqdefault.jpg`],
      uploadDate: GTA.uploaded,
      duration: `PT${Math.floor(GTA.seconds / 60)}M${GTA.seconds % 60}S`,
      contentUrl: `https://www.youtube.com/watch?v=${GTA.id}`,
      embedUrl: `https://www.youtube.com/embed/${GTA.id}`,
      publisher: { '@id': `${ORIGIN}/#org` },
    },
  ],
  body: `
<div class="wrap page-hero">${crumbs([['/', 'Home'], ['/gta/', 'GTA Portfolio']])}
<span class="eyebrow">🎮 Built with Claude Code</span>
<h1>A <span class="hl">GTA 6-style</span> portfolio with working cheat codes</h1>
<p class="lead">Plain HTML, CSS and JavaScript. No framework, no build step. Watch the build, play the live site, then make your own with the prompts below.</p>
</div>
<article class="wrap article">
${ytBox(GTA.id, GTA.title, '/img/gta-thumb.jpg')}
<div class="links">
  <a class="btn btn-primary" href="${GTA.demo}" rel="noopener">🕹️ Play the live site</a>
  <a class="btn btn-ghost" href="${GTA.code}" rel="noopener">${ICONS.github} Get the code (MIT)</a>
</div>
<h2>Try the cheats</h2>
<p>Click anywhere on the live site (not in the form) and type:</p>
<table><thead><tr><th>Cheat</th><th>What happens</th></tr></thead><tbody>
<tr><td><code>HESOYAM</code></td><td>Every skill jumps to five stars</td></tr>
<tr><td><code>↑ ↑ ↓ ↓ ← → ← → B A</code></td><td>Party mode: the whole site changes colour (type it again to stop)</td></tr>
<tr><td>A secret six-letter word</td><td>Bugsy launches off the screen. Hint: what he does on Fridays</td></tr>
</tbody></table>
<p>On a phone, tap the cheat cards instead.</p>

<h2>What's inside</h2>
<ul>
<li><strong>Synthwave sunset with parallax palms:</strong> one CSS variable (<code>--scroll</code>) set on scroll; each layer moves at its own speed.</li>
<li><strong>Wanted-level skills:</strong> stars light up one by one with an <code>IntersectionObserver</code>.</li>
<li><strong>Mission cards:</strong> comic-style halftone dots from a single <code>radial-gradient</code>.</li>
<li><strong>Minimap navigation:</strong> the active section's blip turns pink and the arrow points at it.</li>
<li><strong>Cheat codes:</strong> keep the last 10 keys and compare the end of the buffer.</li>
<li><strong>"Mission passed" contact form:</strong> a demo, nothing is sent anywhere.</li>
</ul>

<h2>The 8 things Claude got wrong</h2>
<p>Most of the site worked first time. These didn't, and every one was caught by looking at real screenshots, not by trusting the code.</p>
<table><thead><tr><th>#</th><th>What was wrong</th><th>Fix</th></tr></thead><tbody>
${bugRows.map((r) => `<tr><td>${esc(r[0])}</td><td>${md(r[1])}</td><td>${md(r[3])}</td></tr>`).join('\n')}
</tbody></table>

<h2 id="prompts">The prompts</h2>
<p>Paste these into Claude Code one at a time, in an empty folder. Swap in your own name, skills and projects. They were written after the build to reproduce it, so expect small differences.</p>
${prompts.map((p) => `<h3>${esc(p.title)}</h3>\n<pre><code>${esc(p.text)}</code></pre>`).join('\n')}
<p class="note">The last prompt matters most: in our build, checking real screenshots caught missing palm trees, a cheat code that broke with Caps Lock and text running off the screen on phones.</p>
</article>`,
});

// ---- tools ----
pages.push({
  url: '/tools/',
  title: 'Free AI Developer Tools · Byte Buddy',
  description: 'Free tools for AI coding agents: Claude Code hooks, MCP config, AGENTS.md and CLAUDE.md, SKILL.md. No sign-up, nothing leaves your browser.',
  schema: [ORG, crumbSchema([['/', 'Home'], ['/tools/', 'Tools']])],
  body: `
<div class="wrap page-hero">${crumbs([['/', 'Home'], ['/tools/', 'Tools']])}
<span class="eyebrow">🛠️ Free tools</span>
<h1>Free tools for <span class="hl">AI-powered</span> developers</h1>
<p class="lead">Small, fast tools for working with Claude Code and other AI coding agents. No sign-up, no tracking: everything runs in your browser.</p>
</div>
<div class="wrap" style="padding-bottom:80px">
<div class="cards">
${TOOLS.map(toolCard).join('\n')}
</div>
<p class="meta" style="margin-top:28px">More on the way: a secret leak checker, a Cursor rules ↔ CLAUDE.md converter and an llms.txt generator.</p>
</div>`,
});

const SKILL_FAQ = [
  ['What is a SKILL.md file?', 'A SKILL.md is the main file of an Agent Skill: a folder of instructions (and optional scripts and resources) that an AI agent such as Claude loads only when a task needs it. The file starts with YAML frontmatter (name and description) followed by Markdown instructions.'],
  ['Where do I put a SKILL.md for Claude Code?', 'Personal skills go in ~/.claude/skills/&lt;skill-name&gt;/SKILL.md and work in every project. Project skills go in .claude/skills/&lt;skill-name&gt;/SKILL.md inside the repo, so your team gets them too.'],
  ['How long can the description be?', 'Up to 1,024 characters in the Agent Skills spec. It must not be empty, and it should say both what the skill does and when to use it, because that is what the agent reads to decide whether to load the skill.'],
  ['Why does my skill never trigger?', 'Almost always the description. Make it specific: name the task, the file types or tools involved, and the phrases a user would say ("Use when the user asks to…"). A vague description like "Helps with PDFs" gives the agent nothing to match.'],
  ['Can I use the same SKILL.md with other AI agents?', 'Yes, if you stick to the standard fields (name, description, license, compatibility, metadata, allowed-tools). Claude Code adds extra fields such as argument-hint and disable-model-invocation that other agents may ignore or reject.'],
  ['Does this tool upload my skill anywhere?', 'No. The generator and validator run entirely in your browser. Nothing you type is sent to a server.'],
];
pages.push({
  url: '/tools/skill-md-generator/',
  title: 'SKILL.md Generator & Validator: Create Claude Agent Skills (Free)',
  description: 'Free SKILL.md generator and validator for Claude Code and the open Agent Skills standard. Build a skill in a minute or check yours against the official rules.',
  type: 'article',
  scripts: ['tool-skill-md.js'],
  schema: [
    ORG,
    crumbSchema([['/', 'Home'], ['/tools/', 'Tools'], ['/tools/skill-md-generator/', 'SKILL.md generator']]),
    {
      '@type': 'WebApplication',
      name: 'SKILL.md Generator & Validator',
      url: `${ORIGIN}/tools/skill-md-generator/`,
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Any (runs in the browser)',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      publisher: { '@id': `${ORIGIN}/#org` },
    },
    { '@type': 'FAQPage', mainEntity: SKILL_FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a.replace(/&lt;/g, '<').replace(/&gt;/g, '>') } })) },
  ],
  body: `
<div class="wrap page-hero">${crumbs([['/', 'Home'], ['/tools/', 'Tools'], ['/tools/skill-md-generator/', 'SKILL.md generator']])}
<span class="eyebrow">🧠 Free tool</span>
<h1><span class="hl">SKILL.md</span> generator &amp; validator</h1>
<p class="lead">Pick a skill, copy the SKILL.md. Or paste yours and check it against the official rules. Free, and nothing leaves your browser.</p>
</div>
<div class="wrap tool simple">
  <div class="tabs" role="tablist" aria-label="What do you want to do?">
    <button type="button" role="tab" id="t-create" aria-controls="tab-create" aria-selected="true">Create</button>
    <button type="button" role="tab" id="t-check" aria-controls="tab-check" aria-selected="false" tabindex="-1">Check a SKILL.md</button>
  </div>

  <section id="tab-create" class="duo" role="tabpanel" aria-labelledby="t-create">
    <form id="gen" class="panel pick-panel" autocomplete="off">
      <div class="step-head"><h2>Pick a skill</h2></div>
      <div class="picks" id="sk-picks" role="group" aria-label="Skill templates"></div>
      <details class="adv" id="sk-edit"><summary>Customize <small>name, description, steps, examples</small></summary>
        <div class="adv-body">
          <label>Skill title <input name="title" placeholder="e.g. Commit messages"></label>
          <label>Name <small>lowercase, numbers, hyphens · same as the folder</small><input name="name" placeholder="commit-messages" maxlength="64"></label>
          <label>What it does <textarea name="what" rows="2" placeholder="Writes clear Conventional Commit messages from staged git changes"></textarea></label>
          <label>When to use it <textarea name="when" rows="2" placeholder="the user asks to commit or write a commit message"></textarea></label>
          <label>Steps <small>one per line</small><textarea name="steps" rows="5" placeholder="Run git diff --staged&#10;Pick the commit type&#10;Write a subject under 72 characters"></textarea></label>
          <div class="two"><label>Example input <textarea name="exIn" rows="3"></textarea></label><label>Example output <textarea name="exOut" rows="3"></textarea></label></div>
          <label>Edge cases <small>one per line, optional</small><textarea name="edge" rows="2"></textarea></label>
          <p class="adv-title">Extras (optional)</p>
          <label>Allowed tools <small>space-separated</small><input name="tools" placeholder="Read Grep Bash(git:*)"></label>
          <div class="two">
            <label>License <select name="license"><option value="">None</option><option>MIT</option><option>Apache-2.0</option><option>Proprietary</option></select></label>
            <label>Author <input name="author" placeholder="your-name"></label>
          </div>
          <label>Compatibility <small>only if it needs something special</small><input name="compat" maxlength="500" placeholder="Requires git and Node.js 20+"></label>
          <label class="cc-only">Argument hint <small>shown after /name</small><input name="hint" placeholder="[file or folder]"></label>
          <label class="cc-only check"><input type="checkbox" name="manual"><span><span>Only run when I type <code>/name</code></span><small>Claude won't load it on its own. Good for deploys and other risky actions.</small></span></label>
        </div>
      </details>
    </form>
    <div class="panel result" id="sk-result" aria-live="polite"></div>
  </section>

  <section id="tab-check" class="duo" role="tabpanel" aria-labelledby="t-check" hidden>
    <div class="panel pick-panel">
      <div class="step-head"><h2>Paste your SKILL.md</h2><button type="button" id="val-bad" class="link-btn">Load a broken example</button></div>
      <label class="sr" for="val-in">Paste a SKILL.md</label>
      <textarea id="val-in" rows="14" spellcheck="false" placeholder="---&#10;name: my-skill&#10;description: …&#10;---&#10;&#10;# Instructions"></textarea>
    </div>
    <div class="panel result" id="val-result" aria-live="polite"></div>
  </section>
</div>

<div class="wrap guide-divider"><span>Guide</span></div>

<article class="wrap article">
<h2>What is a SKILL.md?</h2>
<p>An <strong>Agent Skill</strong> is a folder that teaches an AI agent how to do one job well. Its only required file is <code>SKILL.md</code>: a few lines of YAML frontmatter, then Markdown instructions. Agents such as Claude load only each skill's name and description at startup (about 100 tokens each), then read the full file when a task matches. That is why one agent can carry dozens of skills without filling its context window.</p>
<pre><code>commit-messages/
├── SKILL.md        # required: frontmatter + instructions
├── scripts/        # optional: code the agent can run
├── references/     # optional: extra docs, loaded only when needed
└── assets/         # optional: templates, images, data</code></pre>

<h2>The rules this validator checks</h2>
<table><thead><tr><th>Field</th><th>Rule</th><th>Source</th></tr></thead><tbody>
<tr><td><code>name</code></td><td>Required. 1–64 characters: lowercase letters, numbers and hyphens. No leading, trailing or double hyphens. Must match the folder name.</td><td>Agent Skills spec</td></tr>
<tr><td><code>name</code></td><td>No XML tags, and no reserved words <code>anthropic</code> or <code>claude</code></td><td>Claude docs</td></tr>
<tr><td><code>description</code></td><td>Required, 1–1,024 characters. Says what the skill does <em>and</em> when to use it.</td><td>Agent Skills spec</td></tr>
<tr><td><code>description</code></td><td>No XML tags. Written in third person ("Processes Excel files…", not "I can help…").</td><td>Claude docs</td></tr>
<tr><td><code>compatibility</code></td><td>Optional, 1–500 characters. Only for real environment needs.</td><td>Agent Skills spec</td></tr>
<tr><td><code>metadata</code></td><td>Optional map of string keys to string values (quote numbers: <code>version: "1.0"</code>).</td><td>Agent Skills spec</td></tr>
<tr><td><code>allowed-tools</code></td><td>Optional, space-separated pre-approved tools. Experimental.</td><td>Agent Skills spec</td></tr>
<tr><td>Body</td><td>Keep it under 500 lines (about 5,000 tokens). Move long reference material into separate files, one level deep.</td><td>Spec &amp; Claude docs</td></tr>
</tbody></table>
<p class="meta">Sources: <a href="https://agentskills.io/specification" rel="noopener">agentskills.io/specification</a>, <a href="https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices" rel="noopener">Claude: Skill authoring best practices</a>, <a href="https://code.claude.com/docs/en/skills" rel="noopener">Claude Code: Skills</a>. Checked November 2026.</p>

<h2>Where to save it</h2>
<ul>
<li><strong>Claude Code, all projects:</strong> <code>~/.claude/skills/&lt;skill-name&gt;/SKILL.md</code></li>
<li><strong>Claude Code, one project (shared with your team):</strong> <code>.claude/skills/&lt;skill-name&gt;/SKILL.md</code></li>
<li><strong>Other agents:</strong> check where your agent loads skills from. The folder name must still match <code>name</code>.</li>
</ul>
<p>In Claude Code you can also run a skill directly by typing <code>/skill-name</code>. Set <code>disable-model-invocation: true</code> if it should only ever run when you type the command, for example a deploy skill.</p>

<h2>Write a description that actually triggers</h2>
<p>The description is the only thing the agent sees before deciding to load your skill. Compare:</p>
<table><thead><tr><th>❌ Too vague</th><th>✅ Specific</th></tr></thead><tbody>
<tr><td>Helps with PDFs.</td><td>Extracts text and tables from PDF files, fills PDF forms, and merges multiple PDFs. Use when working with PDF documents or when the user mentions PDFs, forms, or document extraction.</td></tr>
<tr><td>I can write commits for you.</td><td>Writes Conventional Commit messages from staged git changes. Use when the user asks to commit or describe their changes.</td></tr>
</tbody></table>
<p>Good descriptions name the task, the file types or tools, and the words a user would actually say. The PDF example above is the one used in the official spec.</p>

<h2>Free skills to learn from</h2>
<p>Reading good skills is the fastest way to write one. Our list of <a href="/skills/">10 Claude Skills repos that feel illegal to know</a> includes Anthropic's own skills and the 300K+ star superpowers collection.</p>

<h2>FAQ</h2>
${SKILL_FAQ.map(([q, a]) => `<h3>${esc(q)}</h3><p>${a}</p>`).join('\n')}
</article>`,
});

const AGENTS_FAQ = [
  ['What is AGENTS.md?', 'AGENTS.md is a plain Markdown file in the root of a repository that tells AI coding agents how to work on the project: the commands to install, test and lint, the code style, and the rules to follow. It is an open format now stewarded by the Agentic AI Foundation under the Linux Foundation, and is read by Codex, Cursor, GitHub Copilot, Jules, Gemini CLI, Aider, Zed, Windsurf and many more.'],
  ['Does AGENTS.md need special fields or frontmatter?', 'No. It is standard Markdown and you can use any headings you like. Popular sections are a project overview, build and test commands, code style, testing instructions and security notes.'],
  ['Does Claude Code read AGENTS.md?', 'Recent versions of Claude Code can read AGENTS.md, but by default only when there is no CLAUDE.md. The approach Anthropic recommends for sharing one file between tools is a CLAUDE.md that contains the line @AGENTS.md, with any Claude-only instructions below it. That is what this generator creates.'],
  ['How long should CLAUDE.md be?', 'Anthropic recommends keeping each CLAUDE.md under 200 lines. Longer files use more context and Claude follows them less reliably. Move step-by-step procedures into skills and rules for specific folders into .claude/rules/.'],
  ['Should I use a symlink instead of @AGENTS.md?', 'A symlink (ln -s AGENTS.md CLAUDE.md) works if you have no Claude-specific notes, but Claude cannot edit a file through a symlink, and on Windows symlinks need admin rights or Developer Mode and Git may check them out as plain text files. The @AGENTS.md import works everywhere.'],
  ['Which file wins in a monorepo?', 'Put an AGENTS.md in each package that needs its own rules. Agents read the file closest to the code being edited, so the nearest AGENTS.md takes precedence, and an explicit instruction in the chat overrides them all.'],
  ['Does this tool upload my files?', 'No. The generator and the checker run entirely in your browser. Nothing you type or paste is sent anywhere.'],
];
pages.push({
  url: '/tools/agents-md-generator/',
  title: 'AGENTS.md & CLAUDE.md Generator + Checker (Free)',
  description: 'Generate AGENTS.md and CLAUDE.md for your repo: pick your stack, copy. Plus a free checker for leaked secrets, vague rules and missing test commands.',
  type: 'article',
  scripts: ['tool-agents-md.js'],
  schema: [
    ORG,
    crumbSchema([['/', 'Home'], ['/tools/', 'Tools'], ['/tools/agents-md-generator/', 'AGENTS.md generator']]),
    {
      '@type': 'WebApplication',
      name: 'AGENTS.md & CLAUDE.md Generator',
      url: `${ORIGIN}/tools/agents-md-generator/`,
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Any (runs in the browser)',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      publisher: { '@id': `${ORIGIN}/#org` },
    },
    { '@type': 'FAQPage', mainEntity: AGENTS_FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
  ],
  body: `
<div class="wrap page-hero">${crumbs([['/', 'Home'], ['/tools/', 'Tools'], ['/tools/agents-md-generator/', 'AGENTS.md generator']])}
<span class="eyebrow">🤖 Free tool</span>
<h1><span class="hl">AGENTS.md</span> &amp; CLAUDE.md generator</h1>
<p class="lead">Pick your stack, copy the files. One set of rules for Claude Code, Codex, Cursor, Copilot and every other agent. Or check the file you already have. Free, and nothing leaves your browser.</p>
</div>
<div class="wrap tool simple">
  <div class="tabs" role="tablist" aria-label="What do you want to do?">
    <button type="button" role="tab" id="t-create" aria-controls="tab-create" aria-selected="true">Create</button>
    <button type="button" role="tab" id="t-check" aria-controls="tab-check" aria-selected="false" tabindex="-1">Check a file</button>
  </div>

  <section id="tab-create" class="duo" role="tabpanel" aria-labelledby="t-create">
    <form id="am" class="panel pick-panel" autocomplete="off">
      <div class="step-head"><h2>Pick your stack</h2></div>
      <div class="picks" id="am-stacks" role="group" aria-label="Your stack"></div>
      <fieldset class="seg mini" id="am-pm"><legend>Package manager</legend>
        <label><input type="radio" name="pm" value="npm" checked> npm</label>
        <label><input type="radio" name="pm" value="pnpm"> pnpm</label>
        <label><input type="radio" name="pm" value="yarn"> yarn</label>
        <label><input type="radio" name="pm" value="bun"> bun</label>
      </fieldset>
      <details class="adv" id="am-edit"><summary>Customize <small>commands, code style, rules, which files</small></summary>
        <div class="adv-body">
          <fieldset class="seg mini"><legend>Files</legend>
            <label><input type="radio" name="mode" value="both" checked> AGENTS.md + CLAUDE.md</label>
            <label><input type="radio" name="mode" value="claude"> CLAUDE.md only</label>
            <label><input type="radio" name="mode" value="agents"> AGENTS.md only</label>
          </fieldset>
          <div class="two"><label>Project name <input name="name" placeholder="my-app"></label><label>What it is <input name="about" placeholder="A Next.js web app"></label></div>
          <fieldset class="cmds"><legend>Commands <small>leave a box empty to skip it</small></legend><div id="am-cmds" class="cmd-grid"></div></fieldset>
          <label>Code style <small>one rule per line</small><textarea name="codestyle" rows="4"></textarea></label>
          <label>Gotchas <small>things the code doesn't make obvious · optional</small><textarea name="gotchas" rows="2" placeholder="Dates in the API are UTC; the UI converts them&#10;tests/e2e needs the dev server running first"></textarea></label>
          <fieldset class="rules"><legend>Rules</legend><div id="am-rules" class="rule-list"></div></fieldset>
          <label>Your own rules <small>one per line, optional</small><textarea name="extra" rows="2" placeholder="All UI text goes through the t() translation helper"></textarea></label>
          <label class="check"><input type="checkbox" name="layout"><span><span>Add a project layout section</span><small>Usually not needed: agents can read your folders. Anthropic's docs suggest leaving it out to keep the file short.</small></span></label>
          <label id="am-structure" hidden>Project layout <small>one folder per line: path — what's in it</small><textarea name="structure" rows="4"></textarea></label>
          <label id="am-claude-notes">Claude Code-only notes <small>optional · e.g. skills or commands only Claude has</small><textarea name="claude" rows="2" placeholder="Use the /release skill to publish a new version"></textarea></label>
        </div>
      </details>
    </form>
    <div class="panel result" id="am-result" aria-live="polite"></div>
  </section>

  <section id="tab-check" class="duo" role="tabpanel" aria-labelledby="t-check" hidden>
    <div class="panel pick-panel">
      <div class="step-head"><h2>Paste your file</h2><button type="button" id="ck-bad" class="link-btn">Load a messy example</button></div>
      <label class="scope-row">It's a <select id="ck-kind" class="mini"><option value="auto">detect it for me</option><option value="agents">AGENTS.md</option><option value="claude">CLAUDE.md</option></select></label>
      <label class="sr" for="ck-in">Paste an AGENTS.md or CLAUDE.md</label>
      <textarea id="ck-in" rows="14" spellcheck="false" placeholder="Paste your AGENTS.md or CLAUDE.md here"></textarea>
    </div>
    <div class="panel result" id="ck-result" aria-live="polite"></div>
  </section>
</div>

<div class="wrap guide-divider"><span>Guide</span></div>

<article class="wrap article">
<h2>What is AGENTS.md?</h2>
<p><strong>AGENTS.md</strong> is a README for AI coding agents. Your README tells humans what a project is; AGENTS.md tells an agent how to work on it: which commands install, test and lint the code, which style to follow, and what it must not do. It's plain Markdown with no required fields, and it lives in the root of your repo.</p>
<p>It started as a shared effort between OpenAI Codex, Amp, Google's Jules, Cursor and Factory, and is now stewarded by the Agentic AI Foundation under the Linux Foundation. Codex, Cursor, GitHub Copilot, Jules, Gemini CLI, Aider, Zed, Windsurf, Devin, Junie and many more read it.</p>

<h2>AGENTS.md vs CLAUDE.md</h2>
<table><thead><tr><th></th><th>AGENTS.md</th><th>CLAUDE.md</th></tr></thead><tbody>
<tr><td>Read by</td><td>Most coding agents</td><td>Claude Code</td></tr>
<tr><td>Format</td><td>Plain Markdown, any headings</td><td>Plain Markdown, plus <code>@path</code> imports</td></tr>
<tr><td>Where</td><td>Repo root, plus one per package in a monorepo (closest file wins)</td><td>Repo root or <code>.claude/CLAUDE.md</code>; personal rules in <code>~/.claude/CLAUDE.md</code>; private project notes in <code>CLAUDE.local.md</code></td></tr>
<tr><td>Size</td><td>No limit set; shorter is better</td><td>Anthropic recommends under 200 lines</td></tr>
</tbody></table>
<p><strong>Use both.</strong> Put the shared rules in AGENTS.md and make CLAUDE.md a one-line import:</p>
<pre><code>@AGENTS.md

## Claude Code
- Use the /release skill to publish a new version.</code></pre>
<p>Claude Code loads AGENTS.md through the import, and every other agent reads AGENTS.md directly. You maintain one set of rules. Newer versions of Claude Code can also read AGENTS.md on their own, but only when there is no CLAUDE.md, so the import is the reliable way to get both.</p>

<h2>What to put in it (and what to leave out)</h2>
<ul>
<li><strong>Exact commands.</strong> Install, test, lint, type-check, and how to run a single test. Agents run these to check their own work before they finish.</li>
<li><strong>Rules you'd otherwise repeat.</strong> Anything you've had to correct twice belongs here.</li>
<li><strong>Things the code doesn't say.</strong> Decisions made outside the repo, misleading names, the test that needs a running server.</li>
<li><strong>Leave out</strong> what an agent can find by reading the repo: folder tours, dependency lists, long architecture essays. Every line is read on every task.</li>
<li><strong>Write plainly.</strong> "Use 2-space indentation" beats "format code properly". Anthropic's guidance is that current models follow plain wording, and piling on IMPORTANT and ALL CAPS makes them over-apply a rule.</li>
<li><strong>No secrets.</strong> This file is committed to git. Never paste API keys or database URLs into it.</li>
</ul>
<p class="note">For things that must <em>never</em> happen (force-pushing, deleting a database), don't rely on a line of text: in Claude Code, use a hook or a permission deny rule, which are enforced every time.</p>

<h2>What the checker looks for</h2>
<table><thead><tr><th>Check</th><th>Why</th></tr></thead><tbody>
<tr><td>API keys, tokens, private keys, database passwords</td><td>The file gets committed and shared</td></tr>
<tr><td>Missing commands or test command</td><td>Agents need them to verify their work</td></tr>
<tr><td>Over 200 lines (CLAUDE.md)</td><td>Anthropic's recommended size</td></tr>
<tr><td>Vague rules ("best practices", "clean code")</td><td>Nothing the agent can act on</td></tr>
<tr><td>Shouting (IMPORTANT, MUST, NEVER…)</td><td>Makes the model over-apply rules</td></tr>
<tr><td>Paths from one person's machine</td><td>Breaks for everyone else</td></tr>
<tr><td>Duplicate headings, TODOs, placeholders</td><td>Contradictions and unfinished rules</td></tr>
<tr><td><code>@imports</code></td><td>Listed for CLAUDE.md; flagged in AGENTS.md, where other agents can't follow them</td></tr>
</tbody></table>
<p class="meta">Sources: <a href="https://agents.md/" rel="noopener">agents.md</a>, <a href="https://code.claude.com/docs/en/memory" rel="noopener">Claude Code: How Claude remembers your project</a>, <a href="https://code.claude.com/docs/en/best-practices" rel="noopener">Claude Code: Best practices</a>. Checked November 2026.</p>

<h2>Next step: teach your agent a skill</h2>
<p>AGENTS.md holds the rules for every task. For a repeatable job (writing commits, reviewing a PR, shipping a release) write a skill instead: it only loads when needed. Make one with the <a href="/tools/skill-md-generator/">SKILL.md generator</a>.</p>

<h2>FAQ</h2>
${AGENTS_FAQ.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join('\n')}
</article>`,
});

const MCP_FAQ = [
  ['How do I add an MCP server to Claude Code?', 'Run claude mcp add in your terminal, for example claude mcp add --transport http linear https://mcp.linear.app/mcp for a remote server, or claude mcp add playwright -- npx -y @playwright/mcp@latest for a local one. Add --scope project to save it in .mcp.json so your team gets it too. This tool writes the commands for you.'],
  ['Where is claude_desktop_config.json?', 'On macOS: ~/Library/Application Support/Claude/claude_desktop_config.json. On Windows: %APPDATA%\\Claude\\claude_desktop_config.json. On Linux: ~/.config/Claude/claude_desktop_config.json. The quickest way to open it is Settings → Developer → Edit Config in Claude Desktop.'],
  ['Is Cursor\'s mcp.json the same as VS Code\'s?', 'No. Cursor uses "mcpServers" in .cursor/mcp.json and reads secrets with ${env:NAME}. VS Code\'s .vscode/mcp.json uses "servers", needs a "type" on every server, and can prompt for secrets with an "inputs" list. The newer Copilot format (mcp-config.json) goes back to "mcpServers". Paste one into the converter on this page to get the other.'],
  ['How do I add MCP servers to Codex?', 'Codex reads TOML, not JSON: add a [mcp_servers.<name>] table to ~/.codex/config.toml with command and args for a local server, or url for a remote one. Keys go in env_vars or bearer_token_env_var so they are read from your environment. You can also run codex mcp add. The same config is used by the Codex CLI, the IDE extension and the app.'],
  ['Why won\'t my MCP server start?', 'The usual causes: npx without -y waiting for an install prompt, a Node.js version that is too old, docker run without -i, a remote URL without "type": "http" in Claude Code, or an environment variable that isn\'t set in the app\'s environment. Restart the app after every change. Paste your config into the checker on this page to find these.'],
  ['Should I use a remote or a local MCP server?', 'If the service has an official remote server (GitHub, Linear, Notion, Sentry, Stripe, Figma…), use it: nothing to install, it updates itself, and you sign in with OAuth instead of storing a key. Use a local server when it needs your machine: files, a browser, git, or a database on your network.'],
  ['Does this tool upload my config?', 'No. The generator, converter and checker run entirely in your browser. Nothing you paste or type is sent anywhere.'],
];
pages.push({
  url: '/tools/mcp-config-generator/',
  title: 'MCP Config Generator & Converter: Claude Code, Cursor, Codex',
  description: 'Free MCP config generator for Claude Code, Cursor, VS Code, Codex, Claude Desktop, Windsurf and Zed. Or convert one app\'s config to another.',
  type: 'article',
  scripts: ['tool-mcp-config.js'],
  schema: [
    ORG,
    crumbSchema([['/', 'Home'], ['/tools/', 'Tools'], ['/tools/mcp-config-generator/', 'MCP config generator']]),
    {
      '@type': 'WebApplication',
      name: 'MCP Config Generator & Converter',
      url: `${ORIGIN}/tools/mcp-config-generator/`,
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Any (runs in the browser)',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      publisher: { '@id': `${ORIGIN}/#org` },
    },
    { '@type': 'FAQPage', mainEntity: MCP_FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
  ],
  body: `
<div class="wrap page-hero">${crumbs([['/', 'Home'], ['/tools/', 'Tools'], ['/tools/mcp-config-generator/', 'MCP config generator']])}
<span class="eyebrow">🔌 Free tool</span>
<h1><span class="hl">MCP config</span> generator &amp; converter</h1>
<p class="lead">Pick your servers, pick your app, copy. Or paste a config from one app and get it for another. Free, and nothing leaves your browser.</p>
</div>
<div class="wrap tool simple">
  <div class="tabs" role="tablist" aria-label="What do you want to do?">
    <button type="button" role="tab" id="t-create" aria-controls="tab-create" aria-selected="true">Create</button>
    <button type="button" role="tab" id="t-convert" aria-controls="tab-convert" aria-selected="false" tabindex="-1">Convert or check</button>
  </div>

  <section id="tab-create" class="duo" role="tabpanel" aria-labelledby="t-create">
    <div class="panel pick-panel">
      <div class="step-head"><h2>Pick your servers</h2><label class="search-mini"><span class="sr">Search servers</span><input id="mc-q" type="search" autocomplete="off" placeholder="Search ${SERVER_COUNT} servers…"></label></div>
      <div class="picks" id="mc-servers" role="group" aria-label="MCP servers"></div>
      <button type="button" class="link-btn" id="mc-all"></button>
      <div id="mc-needs" class="needs"></div>
      <details class="adv" id="mc-adv"><summary>More options <small>remote or local, API key or sign-in, your own server</small></summary>
        <div class="adv-body">
          <div id="mc-selected" class="srv-opts"></div>
          <div class="custom" id="mc-custom">
            <p class="adv-title">Add your own server</p>
            <fieldset class="seg mini"><legend class="sr">Kind</legend><label><input type="radio" name="ckind" value="stdio" checked> Local command</label><label><input type="radio" name="ckind" value="http"> Remote URL</label></fieldset>
            <label id="mc-c-name">Name <input spellcheck="false" placeholder="my-server"></label>
            <label id="mc-c-cmd">Command <small>exactly what you'd type in a terminal</small><input spellcheck="false" placeholder="npx -y my-mcp-server"></label>
            <label id="mc-c-env">Environment variables <small>KEY=value, one per line · leave the value empty to read it from your computer</small><textarea rows="2" spellcheck="false" placeholder="API_KEY="></textarea></label>
            <label id="mc-c-url" hidden>URL <input spellcheck="false" placeholder="https://example.com/mcp"></label>
            <label id="mc-c-headers" hidden>Headers <small>Name: value, one per line · use \${VAR} for secrets</small><textarea rows="2" spellcheck="false" placeholder="Authorization: Bearer \${MY_TOKEN}"></textarea></label>
            <div class="btns"><button type="button" class="chip" id="mc-c-add">Add server</button><span class="meta" id="mc-c-msg" aria-live="polite"></span></div>
          </div>
        </div>
      </details>
    </div>
    <div class="panel result" id="mc-result"></div>
  </section>

  <section id="tab-convert" class="duo" role="tabpanel" aria-labelledby="t-convert" hidden>
    <div class="panel pick-panel">
      <div class="step-head"><h2>Paste your config</h2><button type="button" id="cv-sample" class="link-btn">Load an example</button></div>
      <label class="sr" for="cv-in">Paste an MCP config</label>
      <textarea id="cv-in" rows="14" spellcheck="false" placeholder="Paste any MCP config here: JSON from Claude, Cursor, VS Code, Windsurf, Zed… or Codex TOML"></textarea>
      <div id="cv-checks"></div>
    </div>
    <div class="panel result" id="cv-result"></div>
  </section>
</div>

<div class="wrap guide-divider"><span>Guide</span></div>
<article class="wrap article">
<h2>What is an MCP config?</h2>
<p>The <strong>Model Context Protocol</strong> (MCP) is the open standard AI apps use to connect to tools: GitHub, a browser, your database, your issue tracker. Each tool runs as an <em>MCP server</em>. Your AI app (the <em>client</em>) finds its servers in a small config file: a name for each server, plus either the command that starts it on your computer (a <strong>local</strong> server) or the URL it lives at (a <strong>remote</strong> server).</p>
<p>The idea is the same everywhere, but every app spells the file differently: a different file name and location, a different top-level key, different names for the URL field and a different way to read secrets. That's the part this tool takes care of.</p>

<h2>Where each app keeps its MCP config</h2>
<table><thead><tr><th>App</th><th>File</th><th>Top-level key</th><th>Remote server</th><th>Secrets</th></tr></thead><tbody>
<tr><td>Claude Code</td><td><code>.mcp.json</code> (project) · <code>~/.claude.json</code> (user)</td><td><code>mcpServers</code></td><td><code>"type": "http"</code> + <code>url</code></td><td><code>\${VAR}</code>, <code>\${VAR:-default}</code></td></tr>
<tr><td>Claude Desktop</td><td><code>claude_desktop_config.json</code></td><td><code>mcpServers</code></td><td>Settings → Connectors, or <code>mcp-remote</code></td><td>Typed into the file</td></tr>
<tr><td>Cursor</td><td><code>.cursor/mcp.json</code> · <code>~/.cursor/mcp.json</code></td><td><code>mcpServers</code></td><td><code>url</code></td><td><code>\${env:VAR}</code></td></tr>
<tr><td>VS Code</td><td><code>.vscode/mcp.json</code></td><td><code>servers</code> (+ <code>inputs</code>)</td><td><code>"type": "http"</code> + <code>url</code></td><td><code>\${input:id}</code> prompt, <code>\${env:VAR}</code></td></tr>
<tr><td>GitHub Copilot (new)</td><td><code>~/.copilot/mcp-config.json</code></td><td><code>mcpServers</code></td><td><code>"type": "http"</code> + <code>url</code></td><td><code>\${VAR}</code></td></tr>
<tr><td>Windsurf</td><td><code>~/.codeium/windsurf/mcp_config.json</code></td><td><code>mcpServers</code></td><td><code>serverUrl</code></td><td><code>\${env:VAR}</code></td></tr>
<tr><td>Codex</td><td><code>~/.codex/config.toml</code></td><td><code>[mcp_servers.name]</code> (TOML)</td><td><code>url</code></td><td><code>env_vars</code>, <code>bearer_token_env_var</code></td></tr>
<tr><td>Gemini CLI</td><td><code>~/.gemini/settings.json</code></td><td><code>mcpServers</code></td><td><code>httpUrl</code> (<code>url</code> = SSE)</td><td><code>\${VAR}</code></td></tr>
<tr><td>Antigravity</td><td><code>~/.gemini/config/mcp_config.json</code></td><td><code>mcpServers</code></td><td><code>serverUrl</code></td><td>Typed into the file</td></tr>
<tr><td>Zed</td><td><code>settings.json</code></td><td><code>context_servers</code></td><td><code>url</code></td><td>Typed into the file</td></tr>
</tbody></table>
<p class="meta">On Windows, <code>~</code> is your user folder (<code>%USERPROFILE%</code>), for example <code>C:\\Users\\you\\.cursor\\mcp.json</code>.</p>

<h2>Where is claude_desktop_config.json?</h2>
<ul>
<li><strong>macOS:</strong> <code>~/Library/Application Support/Claude/claude_desktop_config.json</code></li>
<li><strong>Windows:</strong> <code>%APPDATA%\\Claude\\claude_desktop_config.json</code></li>
<li><strong>Linux:</strong> <code>~/.config/Claude/claude_desktop_config.json</code></li>
</ul>
<p>The easy way: in Claude Desktop open <strong>Settings → Developer → Edit Config</strong>. The file only starts local servers. To add a remote server, use <strong>Settings → Connectors → Add custom connector</strong>, or bridge it with <code>npx -y mcp-remote &lt;url&gt;</code> (the generator does this for you). Quit and reopen Claude Desktop after every change.</p>

<h2>Local or remote server?</h2>
<p><strong>Remote</strong> servers run on the service's side: you paste a URL and sign in with OAuth. Nothing to install, nothing to update, and no key sitting in a file. GitHub, Linear, Notion, Sentry, Stripe, Figma, Atlassian, Vercel, Cloudflare and Supabase all have official remote servers. <strong>Local</strong> servers run on your computer through <code>npx</code>, <code>uvx</code> or <code>docker</code>. You need them when the tool works with your machine: files, a browser, git, a local database.</p>

<h2>Keep API keys out of your config</h2>
<p>Config files get committed, shared in screenshots and pasted into chats. This generator never puts a key in the file: it writes a reference like <code>\${GITHUB_PAT}</code> (or each app's own version of it), and shows you the one command that sets the variable on your computer. VS Code gets an <code>inputs</code> prompt instead, so it asks once and stores the key securely. Three apps (Claude Desktop, Antigravity and Zed) can't read variables in their config; for those you get a clear <code>&lt;PLACEHOLDER&gt;</code> to fill in, in a file that should stay on your machine.</p>

<h2>Common MCP config mistakes (the checker finds these)</h2>
<table><thead><tr><th>Mistake</th><th>What happens</th></tr></thead><tbody>
<tr><td><code>npx</code> without <code>-y</code></td><td>npx waits for "Ok to proceed?" and the server never starts</td></tr>
<tr><td><code>docker run</code> without <code>-i</code></td><td>The server can't read requests from the app</td></tr>
<tr><td>A <code>url</code> with no <code>"type"</code> in Claude Code</td><td>Claude Code treats it as a local command and fails</td></tr>
<tr><td><code>url</code> instead of <code>httpUrl</code> in Gemini CLI</td><td>Gemini connects with the old SSE transport</td></tr>
<tr><td><code>servers</code> vs <code>mcpServers</code></td><td>The app silently finds no servers</td></tr>
<tr><td>An API key typed into the file</td><td>Anyone who sees the file can use your account</td></tr>
<tr><td>Archived packages (<code>@modelcontextprotocol/server-github</code>, <code>-postgres</code>, <code>-brave-search</code>, <code>-puppeteer</code>…)</td><td>No more fixes; most have an official replacement</td></tr>
<tr><td>SSE endpoints (<code>…/sse</code>)</td><td>SSE is deprecated in the MCP spec; Notion's SSE endpoint shuts down in February 2027</td></tr>
</tbody></table>

<h2>Example: the same server in three apps</h2>
<p>GitHub's official remote server with a personal access token read from <code>GITHUB_PAT</code>:</p>
<h3>Claude Code (.mcp.json)</h3>
<pre><code>{
  "mcpServers": {
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/",
      "headers": { "Authorization": "Bearer \${GITHUB_PAT}" }
    }
  }
}</code></pre>
<h3>Cursor (.cursor/mcp.json)</h3>
<pre><code>{
  "mcpServers": {
    "github": {
      "url": "https://api.githubcopilot.com/mcp/",
      "headers": { "Authorization": "Bearer \${env:GITHUB_PAT}" }
    }
  }
}</code></pre>
<h3>Codex (~/.codex/config.toml)</h3>
<pre><code>[mcp_servers.github]
url = "https://api.githubcopilot.com/mcp/"
bearer_token_env_var = "GITHUB_PAT"</code></pre>

<p class="meta">Sources: <a href="https://code.claude.com/docs/en/mcp" rel="noopener">Claude Code MCP</a>, <a href="https://modelcontextprotocol.io/docs/develop/connect-local-servers" rel="noopener">Claude Desktop (modelcontextprotocol.io)</a>, <a href="https://cursor.com/docs/context/mcp" rel="noopener">Cursor</a>, <a href="https://code.visualstudio.com/docs/copilot/reference/mcp-configuration" rel="noopener">VS Code</a>, <a href="https://docs.devin.ai/windsurf/plugins/cascade/mcp" rel="noopener">Windsurf</a>, <a href="https://developers.openai.com/codex/mcp" rel="noopener">Codex</a>, <a href="https://geminicli.com/docs/tools/mcp-server/" rel="noopener">Gemini CLI</a>, <a href="https://antigravity.google/docs/mcp" rel="noopener">Antigravity</a>, <a href="https://zed.dev/docs/ai/mcp" rel="noopener">Zed</a>, and each server's own docs (linked in the generator). Checked ${MCP_CHECKED}.</p>

<h2>Next: tell your agent how your project works</h2>
<p>MCP servers give an agent tools. To give it your project's rules (the test command, the code style, what it must not touch), make an <a href="/tools/agents-md-generator/">AGENTS.md and CLAUDE.md</a>. For a repeatable job, write a <a href="/tools/skill-md-generator/">skill</a>.</p>

<h2>FAQ</h2>
${MCP_FAQ.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join('\n')}
</article>`,
});

const HOOKS_FAQ = [
  ['What are Claude Code hooks?', 'Hooks are commands that Claude Code runs automatically at set moments: before a tool runs, after a file is edited, when Claude finishes, when it needs your attention, and more. Unlike instructions in CLAUDE.md, which Claude can forget or skip, a hook runs every time.'],
  ['Where do I put hooks?', 'In a settings file under a top-level "hooks" key. ~/.claude/settings.json applies to all your projects, .claude/settings.json applies to one project and is committed for your team, and .claude/settings.local.json is for one project and only you.'],
  ['How does a hook block something?', 'Exit with code 2. For PreToolUse that stops the tool call, for UserPromptSubmit it blocks the prompt, and for Stop it makes Claude keep working. Whatever the hook writes to stderr is passed to Claude as the reason. Exit 0 means carry on; any other exit code is a non-blocking error.'],
  ['Why doesn\'t my hook run?', 'The usual causes: a matcher with the wrong case ("bash" instead of "Bash"), an event name with the wrong case, a relative script path, a script that isn\'t executable (chmod +x), or jq not being installed. Type /hooks in Claude Code to see which hooks loaded. Paste your settings.json into the checker on this page to find the rest.'],
  ['Do hooks work on Windows?', 'Yes. Claude Code runs hook commands in Git Bash on Windows, or in PowerShell when Git Bash isn\'t installed. Adding "shell": "powershell" makes a hook always run in PowerShell, which can read the hook\'s JSON input without jq. This generator writes PowerShell versions when you pick Windows.'],
  ['Are hooks safe?', 'Hooks run with your full user permissions, without asking. Only add hooks you understand, and look at .claude/settings.json in any repo you clone before you trust the folder: Claude Code holds hooks back until you accept the workspace trust dialog.'],
  ['Does this tool upload anything?', 'No. The generator and the checker run entirely in your browser. Nothing you type or paste is sent anywhere.'],
];
pages.push({
  url: '/tools/claude-code-hooks-generator/',
  title: 'Claude Code Hooks Generator + Checker (Free, Copy-Paste)',
  description: 'Make Claude Code hooks without writing JSON: notifications, auto-format, block dangerous commands, run tests. For macOS, Linux and Windows. Free.',
  type: 'article',
  scripts: ['tool-hooks.js'],
  schema: [
    ORG,
    crumbSchema([['/', 'Home'], ['/tools/', 'Tools'], ['/tools/claude-code-hooks-generator/', 'Claude Code hooks generator']]),
    {
      '@type': 'WebApplication',
      name: 'Claude Code Hooks Generator',
      url: `${ORIGIN}/tools/claude-code-hooks-generator/`,
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Any (runs in the browser)',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      publisher: { '@id': `${ORIGIN}/#org` },
    },
    { '@type': 'FAQPage', mainEntity: HOOKS_FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
  ],
  body: `
<div class="wrap page-hero">${crumbs([['/', 'Home'], ['/tools/', 'Tools'], ['/tools/claude-code-hooks-generator/', 'Claude Code hooks generator']])}
<span class="eyebrow">🪝 Free tool</span>
<h1><span class="hl">Claude Code hooks</span> generator</h1>
<p class="lead">Pick what you want Claude Code to do automatically, copy one file. Every hook is tested on macOS, Linux and Windows. Or check the hooks you already have. Free, and nothing leaves your browser.</p>
</div>
<div class="wrap tool simple">
  <div class="tabs" role="tablist" aria-label="What do you want to do?">
    <button type="button" role="tab" id="t-create" aria-controls="tab-create" aria-selected="true">Create</button>
    <button type="button" role="tab" id="t-check" aria-controls="tab-check" aria-selected="false" tabindex="-1">Check my hooks</button>
  </div>

  <section id="tab-create" class="duo" role="tabpanel" aria-labelledby="t-create">
    <form id="hk" class="panel pick-panel" autocomplete="off">
      <div class="step-head"><h2>What should happen automatically?</h2></div>
      <div class="picks" id="hk-picks" role="group" aria-label="Hooks"></div>
      <fieldset class="seg mini"><legend>Your computer</legend>
        <label><input type="radio" name="os" value="mac"> macOS</label>
        <label><input type="radio" name="os" value="linux"> Linux</label>
        <label><input type="radio" name="os" value="win"> Windows</label>
      </fieldset>
      <details class="adv"><summary>Customize <small>protected files, test command, merge into your settings</small></summary>
        <div class="adv-body">
          <div id="hk-params"></div>
          <label>Your current settings.json <small>optional · paste it and we add the hooks to it, keeping everything else</small><textarea name="existing" rows="4" spellcheck="false" placeholder='{ "permissions": { … } }'></textarea></label>
        </div>
      </details>
    </form>
    <div class="panel result" id="hk-result" aria-live="polite"></div>
  </section>

  <section id="tab-check" class="duo" role="tabpanel" aria-labelledby="t-check" hidden>
    <div class="panel pick-panel">
      <div class="step-head"><h2>Paste your settings.json</h2><button type="button" id="ck-bad" class="link-btn">Load a broken example</button></div>
      <label class="sr" for="ck-in">Paste a Claude Code settings.json</label>
      <textarea id="ck-in" rows="14" spellcheck="false" placeholder="Paste .claude/settings.json or ~/.claude/settings.json here"></textarea>
    </div>
    <div class="panel result" id="ck-result" aria-live="polite"></div>
  </section>
</div>

<div class="wrap guide-divider"><span>Guide</span></div>

<article class="wrap article">
<h2>What are Claude Code hooks?</h2>
<p><strong>Hooks</strong> are commands Claude Code runs on its own at set moments: before it uses a tool, after it edits a file, when it needs you, when it finishes. They turn "please always do X" into something that actually happens every time.</p>
<p>That's the difference from CLAUDE.md. A line like "run Prettier after editing" is advice: Claude usually follows it, but it can forget. A hook is code: it runs whether Claude remembers or not. Use CLAUDE.md for guidance and hooks for rules that must hold.</p>

<h2>The events you'll use most</h2>
<table><thead><tr><th>Event</th><th>Runs when</th><th>Good for</th></tr></thead><tbody>
<tr><td><code>PreToolUse</code></td><td>Before a tool runs; can block it</td><td>Blocking dangerous commands, protecting files</td></tr>
<tr><td><code>PostToolUse</code></td><td>After a tool succeeds</td><td>Formatting edited files, logging commands</td></tr>
<tr><td><code>UserPromptSubmit</code></td><td>When you send a prompt, before Claude sees it</td><td>Blocking pasted secrets, adding context</td></tr>
<tr><td><code>Notification</code></td><td>When Claude needs your permission or input</td><td>Desktop notifications</td></tr>
<tr><td><code>Stop</code></td><td>When Claude finishes a reply</td><td>Running tests, "done" notifications</td></tr>
<tr><td><code>SessionStart</code></td><td>When a session starts, resumes or is compacted</td><td>Loading context, reminders after compaction</td></tr>
<tr><td><code>PreCompact</code> / <code>PostCompact</code></td><td>Around context compaction</td><td>Saving notes before details are summarized</td></tr>
<tr><td><code>SessionEnd</code></td><td>When the session closes</td><td>Quick cleanup (it gets 1.5 seconds by default)</td></tr>
</tbody></table>
<p>There are more (SubagentStop, PermissionRequest, PostToolUseFailure, ConfigChange, FileChanged…). Our checker knows all of them.</p>

<h2>How the settings.json is laid out</h2>
<pre><code>{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "your command here" }
        ]
      }
    ]
  }
}</code></pre>
<ul>
<li><strong>The event</strong> (<code>PostToolUse</code>) holds a list of groups.</li>
<li><strong>The matcher</strong> picks which tools the group applies to. <code>"Edit|Write"</code> means either; <code>"Bash"</code> means shell commands; <code>"mcp__github__.*"</code> matches every tool from the GitHub MCP server. Leave it out to match everything. Names are case-sensitive: <code>bash</code> matches nothing.</li>
<li><strong>The hooks</strong> list holds what to run. The command gets a JSON description of what's happening on stdin: the tool name, the file path, the shell command, your prompt.</li>
</ul>

<h2>How a hook says yes or no</h2>
<table><thead><tr><th>Exit code</th><th>Means</th></tr></thead><tbody>
<tr><td><code>0</code></td><td>All good, carry on. On SessionStart and UserPromptSubmit, anything printed is added to Claude's context.</td></tr>
<tr><td><code>2</code></td><td>Block it. The text written to stderr goes to Claude as the reason, so write something it can act on.</td></tr>
<tr><td>Anything else</td><td>The hook failed, but Claude carries on. You see a "hook error" notice.</td></tr>
</tbody></table>
<p>For finer control a hook can print JSON instead, for example to answer a permission prompt with allow, deny or ask. The generator sticks to exit codes, which are simpler and work everywhere.</p>

<h2>Where the file goes</h2>
<table><thead><tr><th>File</th><th>Applies to</th></tr></thead><tbody>
<tr><td><code>~/.claude/settings.json</code></td><td>All your projects on this computer</td></tr>
<tr><td><code>.claude/settings.json</code></td><td>This project, for everyone (commit it)</td></tr>
<tr><td><code>.claude/settings.local.json</code></td><td>This project, just you (keep it out of git)</td></tr>
</tbody></table>
<p>Hooks from all of these files run together. Changes are usually picked up without a restart; type <code>/hooks</code> in Claude Code to see what it loaded and from which file.</p>

<h2>Hooks on Windows</h2>
<p>Claude Code runs hook commands with <code>sh</code> on macOS and Linux, and with Git Bash on Windows (or PowerShell when Git Bash isn't installed). Most examples online pipe the input through <code>jq</code>, which Windows doesn't have. Add <code>"shell": "powershell"</code> to a hook and it always runs in PowerShell, which reads JSON natively with <code>ConvertFrom-Json</code>. Pick Windows in the generator and every hook is written that way, with nothing to install.</p>

<h2>Stop hooks that never stop</h2>
<p>A Stop hook that exits with 2 keeps Claude working, which is how "run the tests before finishing" works. If the tests keep failing, Claude keeps trying. Claude Code gives each Stop hook a <code>stop_hook_active</code> field that's true when it's already continuing because of a Stop hook: exit 0 when it's true, and Claude gets one retry instead of a loop. Our test hook does this, and the checker warns when yours doesn't.</p>

<h2>Keep hooks safe</h2>
<ul>
<li>Hooks run with your full permissions, without asking. Read every hook before you add it.</li>
<li>Look at <code>.claude/settings.json</code> in any repo you clone. Claude Code holds hooks back until you accept the folder's trust dialog, so check before you click it.</li>
<li>Never put API keys in a hook command. settings.json gets committed; read keys from environment variables.</li>
<li>A file-protection hook only guards Claude's Edit and Write tools. For secrets, also add a deny rule such as <code>Read(./.env)</code> under <code>permissions</code>.</li>
</ul>
<p class="meta">Sources: <a href="https://code.claude.com/docs/en/hooks" rel="noopener">Claude Code: Hooks reference</a>, <a href="https://code.claude.com/docs/en/hooks-guide" rel="noopener">Claude Code: Get started with hooks</a>, <a href="https://code.claude.com/docs/en/settings" rel="noopener">Claude Code: Settings</a>, <a href="https://code.claude.com/docs/en/tools-reference" rel="noopener">Claude Code: Tools reference</a>. Every command in the generator was run on macOS/Linux (sh) and Windows (PowerShell) with test input. Checked ${HOOKS_CHECKED}.</p>

<h2>Next: give Claude your project's rules</h2>
<p>Hooks enforce the must-never-happen rules. For everything else (the test command, the code style, the gotchas) write an <a href="/tools/agents-md-generator/">AGENTS.md and CLAUDE.md</a>. To connect Claude to GitHub, a browser or your database, use the <a href="/tools/mcp-config-generator/">MCP config generator</a>.</p>

<h2>FAQ</h2>
${HOOKS_FAQ.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join('\n')}
</article>`,
});

// ---- blog ----
// One Markdown file per post in content/blog/<slug>.md, with a small frontmatter block:
//   title, description (≤158 chars), date, updated, tool (a /tools/ url this post supports), emoji, draft
marked.use({
  renderer: {
    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens);
      return `<a href="${href}"${title ? ` title="${title}"` : ''}${/^https?:/.test(href) ? ' rel="noopener"' : ''}>${text}</a>`;
    },
  },
});
const frontmatter = (src, file) => {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(src);
  if (!m) throw new Error(`${file}: missing frontmatter`);
  const data = Object.fromEntries(
    m[1].split(/\r?\n/).filter(Boolean).map((l) => {
      const i = l.indexOf(':');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"(.*)"$/, '$1')];
    }),
  );
  return { data, body: src.slice(m[0].length) };
};
const POSTS = fs.existsSync('content/blog')
  ? fs
      .readdirSync('content/blog')
      .filter((f) => f.endsWith('.md'))
      .map((f) => {
        const { data, body } = frontmatter(read(`content/blog/${f}`), f);
        for (const k of ['title', 'description', 'date']) if (!data[k]) throw new Error(`content/blog/${f}: needs "${k}"`);
        if (data.description.length > 158) throw new Error(`content/blog/${f}: description is ${data.description.length} chars (max 158)`);
        const words = body.replace(/```[\s\S]*?```/g, ' ').split(/\s+/).filter(Boolean).length;
        return { ...data, slug: f.replace(/\.md$/, ''), url: `/blog/${f.replace(/\.md$/, '')}/`, html: marked.parse(body), minutes: Math.max(1, Math.round(words / 220)), updated: data.updated || data.date };
      })
      .filter((p) => p.draft !== 'true')
      .sort((a, b) => b.date.localeCompare(a.date))
  : [];
const niceDate = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
const postCard = (p) =>
  `<a class="card post-card" href="${p.url}"><div class="body"><span class="tag">${esc(p.emoji || '📝')} Guide · ${p.minutes} min read</span><h3>${esc(p.title)}</h3><p>${esc(p.description)}</p><span class="go">Read it →</span></div></a>`;

for (const p of POSTS) {
  const tool = TOOLS.find((t) => t.url === p.tool);
  const others = POSTS.filter((x) => x !== p).slice(0, 3);
  pages.push({
    url: p.url,
    title: p.title,
    description: p.description,
    type: 'article',
    lastmod: p.updated,
    post: true,
    schema: [
      ORG,
      crumbSchema([['/', 'Home'], ['/blog/', 'Blog'], [p.url, p.title]]),
      {
        '@type': 'BlogPosting',
        headline: p.title,
        description: p.description,
        datePublished: p.date,
        dateModified: p.updated,
        url: `${ORIGIN}${p.url}`,
        mainEntityOfPage: `${ORIGIN}${p.url}`,
        image: `${ORIGIN}/img/og.jpg`,
        author: { '@id': `${ORIGIN}/#org` },
        publisher: { '@id': `${ORIGIN}/#org` },
      },
    ],
    body: `
<div class="wrap page-hero">${crumbs([['/', 'Home'], ['/blog/', 'Blog'], [p.url, p.title]])}
<span class="eyebrow">${esc(p.emoji || '📝')} Guide</span>
<h1>${esc(p.title)}</h1>
<p class="lead">${esc(p.description)}</p>
<p class="meta post-meta">By Byte Buddy · ${p.updated !== p.date ? `Updated <time datetime="${p.updated}">${niceDate(p.updated)}</time>` : `<time datetime="${p.date}">${niceDate(p.date)}</time>`} · ${p.minutes} min read</p>
</div>
<article class="wrap article post">
${p.html}
${tool ? `<div class="tool-cta"><div><strong>${esc(tool.name)}</strong><p>${esc(tool.blurb)}</p></div><a class="btn btn-primary" href="${tool.url}">Open the free tool →</a></div>` : ''}
${others.length ? `<h2 class="more-h">Keep reading</h2><ul class="post-links">${others.map((o) => `<li><a href="${o.url}">${esc(o.title)}</a></li>`).join('')}</ul>` : ''}
</article>`,
  });
}
if (POSTS.length)
  pages.push({
    url: '/blog/',
    title: 'Blog: Claude Code, AI Coding Agents & Dev Guides · Byte Buddy',
    description: 'Short, practical guides to Claude Code, MCP, AGENTS.md and AI coding agents. Every step checked against the official docs.',
    schema: [ORG, crumbSchema([['/', 'Home'], ['/blog/', 'Blog']]), { '@type': 'Blog', name: 'Byte Buddy Blog', url: `${ORIGIN}/blog/`, publisher: { '@id': `${ORIGIN}/#org` } }],
    body: `
<div class="wrap page-hero">${crumbs([['/', 'Home'], ['/blog/', 'Blog']])}
<span class="eyebrow">📝 Blog</span>
<h1>Guides for <span class="hl">AI-powered</span> developers</h1>
<p class="lead">Short, practical answers about Claude Code, MCP and AI coding agents. Every step is checked against the official docs. <a href="/blog/rss.xml">RSS feed</a></p>
</div>
<div class="wrap" style="padding-bottom:80px">
<div class="cards">
${POSTS.map(postCard).join('\n')}
</div>
</div>`,
  });

// ---- about / contact / privacy ----
pages.push({
  url: '/about/',
  title: 'About Byte Buddy',
  description: 'Byte Buddy makes short, practical videos about AI coding tools, free developer resources and how tech works, hosted by Bugsy the bug.',
  schema: [ORG, crumbSchema([['/', 'Home'], ['/about/', 'About']])],
  body: `
<div class="wrap page-hero">${crumbs([['/', 'Home'], ['/about/', 'About']])}<h1>About <span class="hl">Byte Buddy</span></h1></div>
<article class="wrap article">
<p>Byte Buddy is a tech channel for developers and curious people. We make short videos on YouTube, Instagram and TikTok about three things:</p>
<ul>
<li><strong>AI coding tools:</strong> Claude Code, MCP servers, agents and prompting, shown on real projects.</li>
<li><strong>How tech works:</strong> the engineering behind games, apps and everyday software.</li>
<li><strong>Free developer resources:</strong> GitHub repos, tools, APIs and websites worth bookmarking.</li>
</ul>
<h2>Meet the hosts</h2>
<p><strong>Bugsy</strong> is a junior developer who ships fast and fixes things… eventually. He's the 3D bug on this site (go on, poke him). His mentor <strong>Patch</strong> is a walking band-aid with tired eyes and a coffee mug, who has seen every bug before.</p>
<h2>How we check things</h2>
<ul>
<li>Every repo in a list is checked on GitHub before it's used: it exists, it isn't archived and it's still maintained.</li>
<li>Code shown in a video is run before it goes on screen.</li>
<li>When an AI tool gets something wrong in a build, we show it. The GTA portfolio page lists all 8 mistakes.</li>
</ul>
<h2>Follow along</h2>
${socials()}
</article>`,
});
pages.push({
  url: '/contact/',
  title: 'Contact Byte Buddy',
  description: 'How to reach Byte Buddy: ideas for videos, corrections, collaborations.',
  schema: [ORG, crumbSchema([['/', 'Home'], ['/contact/', 'Contact']])],
  body: `
<div class="wrap page-hero">${crumbs([['/', 'Home'], ['/contact/', 'Contact']])}<h1>Contact</h1></div>
<article class="wrap article">
<p>Spotted a mistake, have an idea for a video or want to collaborate? The fastest way to reach us is a direct message on Instagram or a comment on YouTube.</p>
${socials()}
<p>For problems with a project's code (like the GTA portfolio), open an issue on its GitHub repository.</p>
</article>`,
});
pages.push({
  url: '/privacy/',
  title: 'Privacy Policy · Byte Buddy',
  description: 'What bytebuddydev.com collects (almost nothing) and which third-party services it uses.',
  schema: [ORG],
  body: `
<div class="wrap page-hero">${crumbs([['/', 'Home'], ['/privacy/', 'Privacy']])}<h1>Privacy policy</h1><p class="meta">Last updated: ${TODAY}</p></div>
<article class="wrap article">
<h2>What we collect</h2>
<p>This website does not use cookies, analytics or accounts, and we don't collect personal information. Bugsy's greeting remembers that you've seen it using your browser's session storage, and your light/dark choice is saved in your browser's local storage. Neither ever leaves your device.</p>
<h2>Third-party services</h2>
<ul>
<li><strong>Hosting:</strong> the site is served by GitHub Pages. GitHub may log technical data such as IP addresses to keep the service secure (see the <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement" rel="noopener">GitHub Privacy Statement</a>).</li>
<li><strong>Fonts:</strong> fonts load from Google Fonts, which receives your IP address to deliver them (see the <a href="https://policies.google.com/privacy" rel="noopener">Google Privacy Policy</a>).</li>
${AI_URL ? `<li><strong>Chat with Bugsy (AI):</strong> messages you type in the chat are sent through our server to <a href="https://groq.com/privacy-policy" rel="noopener">Groq</a>, which runs the AI model that writes Bugsy's replies. We do not store chat messages. Don't type personal or sensitive information into the chat.</li>` : `<li><strong>Chat with Bugsy:</strong> the chat runs in your browser. Messages are only sent somewhere if you click a contact button (Instagram or GitHub).</li>`}
<li><strong>YouTube videos:</strong> videos show a thumbnail first. The player only loads from youtube-nocookie.com when you click play, after which YouTube's and Google's policies apply.</li>
</ul>
<h2>Advertising</h2>
<p>We don't show ads yet. If we add advertising (for example Google AdSense), this page will be updated first to explain how ad partners use cookies and how you can opt out.</p>
<h2>Links</h2>
<p>We link to GitHub repositories and other websites. Their privacy practices are their own.</p>
<h2>Contact</h2>
<p>Questions about this policy: see the <a href="/contact/">contact page</a>.</p>
</article>`,
});

// ---------------- build ----------------
const STAMP = Date.now().toString(36);
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'img'), { recursive: true });

// plain <h2>Text</h2> headings get an id (linkable sections; the search index points at them)
const slug = (t) => t.toLowerCase().replace(/&amp;/g, 'and').replace(/<[^>]+>/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
const plain = (h) => h.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();
const search = [];
for (const p of pages) {
  const used = new Set();
  const addId = (tag) => (m, inner) => {
    let id = slug(inner) || 'section';
    while (used.has(id)) id += '-2';
    used.add(id);
    return `<${tag} id="${id}">${inner}</${tag}>`;
  };
  // only headings in the written article, not the tool panels or the skill cards
  const at = p.body.indexOf('<article');
  if (at >= 0) p.body = p.body.slice(0, at) + p.body.slice(at).replace(/<h2>((?:(?!<span class="num">)[\s\S])*?)<\/h2>/g, addId('h2')).replace(/<h3>([^<]+\?)<\/h3>/g, addId('h3'));
  const short = plain(p.title.split(/ · |: | \(/)[0]);
  const tool = TOOLS.find((t) => t.url === p.url);
  search.push({ k: tool ? 'Tool' : p.post ? 'Guide' : 'Page', t: tool ? tool.name : p.post ? p.title : short, d: p.description, u: p.url, x: p.title });
  if (p.url !== '/' && p.url !== '/privacy/' && at >= 0) {
    const art = p.body.slice(at);
    for (const m of art.matchAll(/<h2 id="([^"]+)">([\s\S]*?)<\/h2>/g)) if (m[1] !== 'faq') search.push({ k: 'Section', t: plain(m[2]), d: short, u: `${p.url}#${m[1]}` });
    for (const m of art.matchAll(/<h3 id="([^"]+)">([^<]+\?)<\/h3>/g)) if (!search.some((x) => x.t === plain(m[2]))) search.push({ k: 'FAQ', t: plain(m[2]), d: short, u: `${p.url}#${m[1]}` });
  }
  const dir = path.join(OUT, p.url);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), layout(p));
}
for (const sk of skills) search.push({ k: 'Claude Skill', t: sk.repo, d: sk.what, u: `/skills/#${skillId(sk)}` });
for (const part of repoParts) for (const r of part.repos) search.push({ k: 'GitHub repo', t: r.repo, d: r.what, u: r.url });
fs.writeFileSync(
  path.join(OUT, '404.html'),
  layout({
    url: '/404.html',
    title: 'Page not found · Byte Buddy',
    description: 'This page does not exist.',
    body: `<div class="wrap page-hero"><span class="eyebrow">404</span><h1>Bugsy <span class="hl">deleted</span> this page</h1><p class="lead">It worked on his machine. Try the <a href="/">home page</a>, the <a href="/skills/">Claude Skills list</a> or the <a href="/repos/">GitHub repos</a>.</p></div>`,
  }).replace('<meta name="robots" content="index, follow, max-image-preview:large">', '<meta name="robots" content="noindex">'),
);

// assets
await build({ entryPoints: ['src/scene.js'], bundle: true, minify: true, format: 'esm', target: 'es2020', outfile: `${OUT}/assets/scene.js`, legalComments: 'none' });
await build({ entryPoints: ['src/tools/skill-md.js'], bundle: true, minify: true, format: 'esm', target: 'es2020', outfile: `${OUT}/assets/tool-skill-md.js` });
await build({ entryPoints: ['src/tools/mcp-config.js'], bundle: true, minify: true, format: 'esm', target: 'es2020', outfile: `${OUT}/assets/tool-mcp-config.js` });
await build({ entryPoints: ['src/tools/hooks.js'], bundle: true, minify: true, format: 'esm', target: 'es2020', outfile: `${OUT}/assets/tool-hooks.js` });
await build({ entryPoints: ['src/tools/agents-md.js'], bundle: true, minify: true, format: 'esm', target: 'es2020', outfile: `${OUT}/assets/tool-agents-md.js` });
await build({ entryPoints: ['src/chat.js'], bundle: true, minify: true, format: 'esm', target: 'es2020', outfile: `${OUT}/assets/chat.js` });
await build({ entryPoints: ['src/site.js'], bundle: false, minify: true, format: 'esm', target: 'es2020', outfile: `${OUT}/assets/site.js` });
await build({ entryPoints: ['src/site.css'], minify: true, outfile: `${OUT}/assets/site.css` });
for (const f of ['bugsy.png', 'logo.png', 'icon-192.png', 'favicon-48.png', 'gta-thumb.jpg', 'gta-site.jpg', 'og.jpg']) {
  const src = path.join('static/img', f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(OUT, 'img', f));
}
fs.copyFileSync('static/img/favicon-48.png', path.join(OUT, 'favicon.ico'));

fs.writeFileSync(path.join(OUT, 'assets', 'search.json'), JSON.stringify(search));

// SEO files
fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`);
fs.writeFileSync(
  path.join(OUT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map((p) => `  <url><loc>${ORIGIN}${p.url}</loc><lastmod>${p.lastmod || TODAY}</lastmod></url>`).join('\n')}\n</urlset>\n`,
);
// RSS for the blog
if (POSTS.length) {
  const x = (v) => esc(v).replace(/'/g, '&#39;');
  const items = POSTS.map((p) => `<item><title>${x(p.title)}</title><link>${ORIGIN}${p.url}</link><guid>${ORIGIN}${p.url}</guid><pubDate>${new Date(p.date + 'T12:00:00Z').toUTCString()}</pubDate><description>${x(p.description)}</description></item>`);
  fs.writeFileSync(
    path.join(OUT, 'blog', 'rss.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>
<title>Byte Buddy Blog</title><link>${ORIGIN}/blog/</link><description>Practical guides to Claude Code, MCP and AI coding agents.</description><language>en</language>
<atom:link href="${ORIGIN}/blog/rss.xml" rel="self" type="application/rss+xml"/>
${items.join('\n')}
</channel></rss>
`,
  );
}
fs.writeFileSync(path.join(OUT, 'CNAME'), 'bytebuddydev.com\n');
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

const kb = (f) => (fs.statSync(f).size / 1024).toFixed(0) + ' KB';
console.log(`✔ ${pages.length} pages + 404 → ${OUT}/  (scene.js ${kb(`${OUT}/assets/scene.js`)}, site.css ${kb(`${OUT}/assets/site.css`)})`);
