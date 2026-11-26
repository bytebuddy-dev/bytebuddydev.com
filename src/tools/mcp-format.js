// MCP config: one neutral server model → the exact file each app expects, plus a parser (JSON, JSONC, TOML)
// that turns any app's config back into the model (= the converter) and a checker.
// Formats checked against each app's official docs on 2026-11-26 (sources on the tool page).
//
// Entry: { name, transport: 'stdio' | 'http' | 'sse', command, args[], env{}, url, headers{}, oauth? }
// Secrets are always references in the neutral form ${VAR}; each app gets its own syntax (or a <VAR> placeholder).
import { SECRETS } from './agents-rules.js';
import { RETIRED } from './mcp-servers.js';

const REF = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g;
const sub = (v, fn) => String(v).replace(REF, (_, n) => fn(n));
const mapVals = (o, fn) => Object.fromEntries(Object.entries(o || {}).map(([k, v]) => [k, fn(v)]));
const has = (o) => !!o && Object.keys(o).length > 0;
const json = (o) => JSON.stringify(o, null, 2) + '\n';
const ph = (v) => sub(v, (n) => `<${n}>`);
export const shq = (s) => (/^[A-Za-z0-9_@%+=:,./-]+$/.test(s) ? s : `'${String(s).replace(/'/g, `'\\''`)}'`);
const b64 = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
export const varsOf = (es) => [
  ...new Set(
    es.flatMap((e) => [e.command, ...(e.args || []), e.url, ...Object.values(e.env || {}), ...Object.values(e.headers || {})].filter(Boolean).flatMap((v) => [...String(v).matchAll(REF)].map((m) => m[1]))),
  ),
];
const usesPlaceholders = (es) => varsOf(es).length > 0;
const P = (mac, win, linux = mac) => ({ mac, win, linux });

const PLACEHOLDER_NOTE = (app) => `${app} can't read environment variables from this file, so replace each <code>&lt;VAR&gt;</code> with the real value. The file stays on your computer: never commit it or share it.`;

// ---------------------------------------------------------------- apps
export const CLIENTS = [
  {
    id: 'claude-code', name: 'Claude Code', icon: '✳️', sub: '.mcp.json', file: '.mcp.json', lang: 'json',
    paths: [
      ['The project root (shared through git)', P('.mcp.json', '.mcp.json')],
      ['All your projects (use the terminal command with --scope user)', P('~/.claude.json', '%USERPROFILE%\\.claude.json')],
    ],
    interp: true,
    oauth: 'For servers that use sign-in, run <code>/mcp</code> inside Claude Code and choose <strong>Authenticate</strong>.',
    emit(es, { scope = 'project' } = {}) {
      const servers = {};
      const cli = [];
      for (const e of es) {
        if (e.transport === 'stdio') {
          servers[e.name] = { command: e.command, args: e.args, ...(has(e.env) && { env: e.env }) };
          // --scope goes between -e and the name: -e takes several values and would swallow the name
          cli.push(['claude mcp add', ...Object.entries(e.env || {}).map(([k, v]) => `-e ${shq(`${k}=${v}`)}`), `--scope ${scope}`, shq(e.name), '--', shq(e.command), ...e.args.map(shq)].join(' '));
        } else {
          servers[e.name] = { type: e.transport, url: e.url, ...(has(e.headers) && { headers: e.headers }) };
          cli.push(['claude mcp add', `--transport ${e.transport}`, `--scope ${scope}`, shq(e.name), shq(e.url), ...Object.entries(e.headers || {}).map(([k, v]) => `--header ${shq(`${k}: ${v}`)}`)].join(' '));
        }
      }
      const notes = [];
      if (varsOf(es).length) notes.push('<code>${VAR}</code> is read from your environment when Claude Code starts. The quotes in the commands keep your shell from filling it in early, so the key never lands in the file.');
      return { text: json({ mcpServers: servers }), cli, notes };
    },
  },
  {
    id: 'claude-desktop', name: 'Claude Desktop', icon: '🖥️', sub: 'claude_desktop_config.json', file: 'claude_desktop_config.json', lang: 'json',
    paths: [['Config file (Settings → Developer → Edit Config)', P('~/Library/Application Support/Claude/claude_desktop_config.json', '%APPDATA%\\Claude\\claude_desktop_config.json', '~/.config/Claude/claude_desktop_config.json')]],
    interp: false,
    oauth: 'Remote servers are bridged through <code>mcp-remote</code>, which opens a browser sign-in the first time. Simpler for sign-in servers: paste the URL in <strong>Settings → Connectors → Add custom connector</strong> instead.',
    emit(es) {
      const servers = {};
      const notes = [];
      for (const e of es) {
        if (e.transport === 'stdio') servers[e.name] = { command: e.command, args: e.args.map(ph), ...(has(e.env) && { env: mapVals(e.env, ph) }) };
        else {
          // the config file only runs local commands: mcp-remote bridges to the URL. Header values go through env
          // (mcp-remote fills ${VAR} in its args from env; no spaces in the arg avoids a Windows quoting bug).
          const args = ['-y', 'mcp-remote', ph(e.url)];
          const env = {};
          const hs = Object.entries(e.headers || {});
          hs.forEach(([k, v], i) => {
            const n = hs.length === 1 ? 'AUTH_HEADER' : `HEADER_${i + 1}`;
            args.push('--header', `${k}:\${${n}}`);
            env[n] = ph(v);
          });
          servers[e.name] = { command: 'npx', args, ...(has(env) && { env }) };
        }
      }
      if (es.some((e) => e.transport !== 'stdio')) notes.push('Claude Desktop\'s config file only starts local programs, so remote servers run through <code>mcp-remote</code> (needs Node.js).');
      if (usesPlaceholders(es)) notes.push(PLACEHOLDER_NOTE('Claude Desktop'));
      notes.push('Fully quit and reopen Claude Desktop after saving.');
      return { text: json({ mcpServers: servers }), cli: [], notes };
    },
  },
  {
    id: 'cursor', name: 'Cursor', icon: '🖱️', sub: '.cursor/mcp.json', file: 'mcp.json', lang: 'json',
    paths: [
      ['Project', P('.cursor/mcp.json', '.cursor\\mcp.json')],
      ['All projects', P('~/.cursor/mcp.json', '%USERPROFILE%\\.cursor\\mcp.json')],
    ],
    interp: true,
    oauth: 'Cursor asks you to sign in the first time it connects to a sign-in server.',
    emit(es) {
      const servers = {};
      const links = [];
      const ref = (v) => sub(v, (n) => `\${env:${n}}`);
      for (const e of es) {
        const s = e.transport === 'stdio'
          ? { command: e.command, args: e.args.map(ref), ...(has(e.env) && { env: mapVals(e.env, ref) }) }
          : { url: ref(e.url), ...(has(e.headers) && { headers: mapVals(e.headers, ref) }) };
        servers[e.name] = s;
        links.push({ label: e.name, href: `cursor://anysphere.cursor-deeplink/mcp/install?name=${encodeURIComponent(e.name)}&config=${encodeURIComponent(b64(JSON.stringify(s)))}` });
      }
      const notes = varsOf(es).length ? ['<code>${env:VAR}</code> is read from your environment when Cursor starts.'] : [];
      return { text: json({ mcpServers: servers }), cli: [], links, notes };
    },
  },
  {
    id: 'vscode', name: 'VS Code', icon: '🧿', sub: '.vscode/mcp.json', file: 'mcp.json', lang: 'json',
    paths: [
      ['Workspace', P('.vscode/mcp.json', '.vscode\\mcp.json')],
      ['All workspaces', P('Command Palette → MCP: Open User Configuration', 'Command Palette → MCP: Open User Configuration')],
    ],
    interp: true,
    oauth: 'VS Code asks you to sign in when a sign-in server starts.',
    emit(es) {
      const vars = varsOf(es);
      const id = (n) => n.toLowerCase().replace(/_/g, '-');
      const ref = (v) => sub(v, (n) => `\${input:${id(n)}}`);
      const servers = {};
      const cli = [];
      const links = [];
      for (const e of es) {
        const s = e.transport === 'stdio'
          ? { type: 'stdio', command: e.command, args: e.args.map(ref), ...(has(e.env) && { env: mapVals(e.env, ref) }) }
          : { type: e.transport, url: ref(e.url), ...(has(e.headers) && { headers: mapVals(e.headers, ref) }) };
        servers[e.name] = s;
        // the one-line installers can't add the "inputs" prompts, so only offer them for servers without secrets
        if (!varsOf([e]).length) {
          const full = JSON.stringify({ name: e.name, ...s });
          cli.push(`code --add-mcp ${shq(full)}`);
          links.push({ label: e.name, href: `vscode:mcp/install?${encodeURIComponent(full)}` });
        }
      }
      const inputs = vars.map((n) => ({ type: 'promptString', id: id(n), description: n, password: true }));
      const notes = [];
      if (vars.length) notes.push('VS Code asks for each <code>${input:…}</code> value the first time the server starts and stores it securely, so no key is written in the file.');
      notes.push('VS Code\'s docs now mark this <code>servers</code> format as deprecated, with removal planned for February 2027. The new format is under <strong>GitHub Copilot</strong> in this tool.');
      return { text: json({ ...(inputs.length && { inputs }), servers }), cli, links, notes };
    },
  },
  {
    id: 'copilot', name: 'GitHub Copilot', icon: '🤖', sub: 'mcp-config.json (new)', file: 'mcp-config.json', lang: 'json',
    paths: [
      ['All projects', P('~/.copilot/mcp-config.json', '%USERPROFILE%\\.copilot\\mcp-config.json')],
      ['Workspace (experimental: chat.mcp.workspaceRootConfig.enabled)', P('.mcp.json in the workspace root', '.mcp.json in the workspace root')],
    ],
    interp: true,
    oauth: 'Copilot asks you to sign in the first time it connects to a sign-in server.',
    emit(es) {
      const servers = {};
      for (const e of es)
        servers[e.name] = e.transport === 'stdio'
          ? { type: 'stdio', command: e.command, args: e.args, ...(has(e.env) && { env: e.env }), tools: ['*'] }
          : { type: e.transport, url: e.url, ...(has(e.headers) && { headers: e.headers }), tools: ['*'] };
      const notes = ['The portable format shared by Copilot CLI and VS Code. <code>"tools": ["*"]</code> turns on every tool; list tool names to allow fewer.'];
      if (varsOf(es).length) notes.push('<code>${VAR}</code> is read from your environment.');
      return { text: json({ mcpServers: servers }), cli: [], notes };
    },
  },
  {
    id: 'windsurf', name: 'Windsurf', icon: '🏄', sub: 'mcp_config.json', file: 'mcp_config.json', lang: 'json',
    paths: [
      ['Windsurf', P('~/.codeium/windsurf/mcp_config.json', '%USERPROFILE%\\.codeium\\windsurf\\mcp_config.json')],
      ['Newer builds (Devin docs)', P('~/.config/devin/mcp_config.json', '%APPDATA%\\devin\\mcp_config.json')],
    ],
    interp: true,
    oauth: 'Windsurf asks you to sign in the first time it connects to a sign-in server.',
    emit(es) {
      const ref = (v) => sub(v, (n) => `\${env:${n}}`);
      const servers = {};
      for (const e of es)
        servers[e.name] = e.transport === 'stdio'
          ? { command: e.command, args: e.args.map(ref), ...(has(e.env) && { env: mapVals(e.env, ref) }) }
          : { serverUrl: ref(e.url), ...(has(e.headers) && { headers: mapVals(e.headers, ref) }) };
      const notes = ['Open it from Cascade: the MCP icon → <strong>Configure</strong>, or the "Open MCP config file" command. Remote servers use <code>serverUrl</code>.'];
      if (varsOf(es).length) notes.push('<code>${env:VAR}</code> is read from your environment.');
      return { text: json({ mcpServers: servers }), cli: [], notes };
    },
  },
  {
    id: 'codex', name: 'Codex', icon: '🧬', sub: 'config.toml', file: 'config.toml', lang: 'toml',
    paths: [
      ['All projects (CLI, IDE extension and app)', P('~/.codex/config.toml', '%USERPROFILE%\\.codex\\config.toml')],
      ['One project (trusted projects only)', P('.codex/config.toml', '.codex\\config.toml')],
    ],
    interp: true,
    oauth: 'For sign-in servers, run <code>codex mcp login &lt;name&gt;</code> once.',
    emit(es) {
      const q = (s) => JSON.stringify(String(s));
      const key = (k) => (/^[A-Za-z0-9_-]+$/.test(k) ? k : q(k));
      const inline = (o) => `{ ${Object.entries(o).map(([k, v]) => `${key(k)} = ${q(v)}`).join(', ')} }`;
      const out = [];
      const cli = [];
      const notes = [];
      let placeholders = false;
      const lit = (v) => {
        if (REF.test(v)) placeholders = true;
        REF.lastIndex = 0;
        return ph(v);
      };
      for (const e of es) {
        out.push(`[mcp_servers.${key(e.name)}]`);
        if (e.transport === 'stdio') {
          out.push(`command = ${q(e.command)}`, `args = [${e.args.map((a) => q(lit(a))).join(', ')}]`);
          const fwd = [];
          const env = {};
          for (const [k, v] of Object.entries(e.env || {})) v === `\${${k}}` ? fwd.push(k) : (env[k] = lit(v));
          if (fwd.length) out.push(`env_vars = [${fwd.map(q).join(', ')}]`);
          if (has(env)) out.push(`env = ${inline(env)}`);
          if (!varsOf([e]).length) cli.push(['codex mcp add', shq(e.name), '--', shq(e.command), ...e.args.map(shq)].join(' '));
        } else {
          out.push(`url = ${q(lit(e.url))}`);
          const plain = {};
          const fromEnv = {};
          for (const [k, v] of Object.entries(e.headers || {})) {
            const bearer = /^Bearer \$\{([A-Za-z_]\w*)\}$/.exec(v);
            const whole = /^\$\{([A-Za-z_]\w*)\}$/.exec(v);
            if (k.toLowerCase() === 'authorization' && bearer) out.push(`bearer_token_env_var = ${q(bearer[1])}`);
            else if (whole) fromEnv[k] = whole[1];
            else plain[k] = lit(v);
          }
          if (has(fromEnv)) out.push(`env_http_headers = ${inline(fromEnv)}`);
          if (has(plain)) out.push(`http_headers = ${inline(plain)}`);
          if (!has(e.headers)) cli.push(`codex mcp add ${shq(e.name)} --url ${shq(e.url)}`);
          if (e.transport === 'sse') notes.push(`<strong>${e.name}</strong> uses the older SSE transport. Codex connects with streamable HTTP, so check whether the server also has a <code>/mcp</code> URL.`);
        }
        out.push('');
      }
      if (varsOf(es).length) notes.unshift('<code>env_vars</code> and <code>bearer_token_env_var</code> read the value from your environment, so the key never goes in the file.');
      if (placeholders) notes.push('Replace each <code>&lt;VAR&gt;</code> with the real value.');
      notes.push('Add these tables to your existing <code>config.toml</code>; don\'t replace the file.');
      return { text: out.join('\n'), cli, notes };
    },
  },
  {
    id: 'gemini', name: 'Gemini CLI', icon: '♊', sub: 'settings.json', file: 'settings.json', lang: 'json',
    paths: [
      ['All projects', P('~/.gemini/settings.json', '%USERPROFILE%\\.gemini\\settings.json')],
      ['Project', P('.gemini/settings.json', '.gemini\\settings.json')],
    ],
    interp: true,
    oauth: 'Gemini CLI opens a browser sign-in the first time it connects to a sign-in server.',
    emit(es) {
      const servers = {};
      const cli = [];
      for (const e of es) {
        if (e.transport === 'stdio') servers[e.name] = { command: e.command, args: e.args, ...(has(e.env) && { env: e.env }) };
        else {
          // httpUrl = streamable HTTP; plain url means SSE in Gemini CLI
          servers[e.name] = { [e.transport === 'sse' ? 'url' : 'httpUrl']: e.url, ...(has(e.headers) && { headers: e.headers }) };
          if (!has(e.headers)) cli.push(`gemini mcp add -s user -t ${e.transport === 'sse' ? 'sse' : 'http'} ${shq(e.name)} ${shq(e.url)}`);
        }
      }
      const notes = ['Merge <code>mcpServers</code> into your existing <code>settings.json</code>. In Gemini CLI, <code>httpUrl</code> is streamable HTTP and <code>url</code> means the older SSE transport.', 'Google now points Gemini CLI users to <strong>Antigravity</strong>, which has its own file (pick it above).'];
      if (varsOf(es).length) notes.unshift('<code>${VAR}</code> is read from your environment.');
      return { text: json({ mcpServers: servers }), cli, notes };
    },
  },
  {
    id: 'antigravity', name: 'Antigravity', icon: '🪐', sub: 'mcp_config.json', file: 'mcp_config.json', lang: 'json',
    paths: [
      ['All projects', P('~/.gemini/config/mcp_config.json', '%USERPROFILE%\\.gemini\\config\\mcp_config.json')],
      ['Workspace', P('.agents/mcp_config.json', '.agents\\mcp_config.json')],
    ],
    interp: false,
    oauth: 'Antigravity asks you to sign in the first time it connects to a sign-in server.',
    emit(es) {
      const servers = {};
      for (const e of es)
        servers[e.name] = e.transport === 'stdio'
          ? { command: e.command, args: e.args.map(ph), ...(has(e.env) && { env: mapVals(e.env, ph) }) }
          : { serverUrl: ph(e.url), ...(has(e.headers) && { headers: mapVals(e.headers, ph) }) };
      const notes = ['You can also open this file from the <code>/mcp</code> manager. Remote servers use <code>serverUrl</code>.'];
      if (usesPlaceholders(es)) notes.push(PLACEHOLDER_NOTE('Antigravity'));
      return { text: json({ mcpServers: servers }), cli: [], notes };
    },
  },
  {
    id: 'zed', name: 'Zed', icon: '⚡', sub: 'settings.json', file: 'settings.json', lang: 'json',
    paths: [
      ['User settings (zed: open settings file)', P('~/.config/zed/settings.json', 'zed: open settings file')],
      ['Project', P('.zed/settings.json', '.zed\\settings.json')],
    ],
    interp: false,
    oauth: 'Zed asks you to sign in when a remote server has no <code>Authorization</code> header.',
    emit(es) {
      const servers = {};
      for (const e of es)
        servers[e.name] = e.transport === 'stdio'
          ? { command: e.command, args: e.args.map(ph), ...(has(e.env) && { env: mapVals(e.env, ph) }) }
          : { url: ph(e.url), ...(has(e.headers) && { headers: mapVals(e.headers, ph) }) };
      const notes = ['Merge <code>context_servers</code> into your existing <code>settings.json</code>; don\'t replace the file.'];
      if (usesPlaceholders(es)) notes.push(PLACEHOLDER_NOTE('Zed'));
      return { text: json({ context_servers: servers }), cli: [], notes };
    },
  },
];

// ---------------------------------------------------------------- catalogue entry → neutral entry
export function entryFor(sv, o = {}, os = 'mac') {
  const params = o.params || {};
  if (o.mode === 'remote' && sv.remote) {
    const r = sv.remote;
    const useKey = !!r.key && (o.auth === 'key' || (!r.oauth && r.key.required));
    let url = useKey && r.key.url ? r.key.url : r.url;
    const q = (r.params || [])
      .filter((p) => p.query)
      .map((p) => (p.check ? ((params[p.id] ?? p.on) ? `${p.id}=true` : '') : String(params[p.id] ?? '').trim() ? `${p.id}=${encodeURIComponent(String(params[p.id]).trim())}` : ''))
      .filter(Boolean);
    if (q.length) url += (url.includes('?') ? '&' : '?') + q.join('&');
    return { name: sv.id, transport: 'http', command: '', args: [], env: {}, url, headers: useKey ? { [r.key.header]: `${r.key.prefix}\${${r.key.var}}` } : {}, oauth: !useKey && r.oauth };
  }
  const l = sv.local;
  const args = l.args.flatMap((a) => {
    const m = /^\{(\w+)\}$/.exec(a);
    if (!m) return [a];
    const p = l.params.find((x) => x.id === m[1]);
    const v = String(params[p.id] ?? p[os] ?? '').trim();
    return p.list ? v.split('\n').map((x) => x.trim()).filter(Boolean) : [v];
  });
  return { name: sv.id, transport: 'stdio', command: l.command, args, env: Object.fromEntries(Object.keys(l.env || {}).map((k) => [k, `\${${k}}`])), url: '', headers: {} };
}

// ---------------------------------------------------------------- parsing (the converter)
const stripJsonc = (s) => {
  let out = '';
  let inStr = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      out += c;
      if (c === '\\') out += s[++i] ?? '';
      else if (c === '"') inStr = false;
    } else if (c === '"') (inStr = true), (out += c);
    else if (c === '/' && s[i + 1] === '/') while (i < s.length && s[i + 1] !== '\n') i++;
    else if (c === '/' && s[i + 1] === '*') {
      const j = s.indexOf('*/', i + 2);
      i = j < 0 ? s.length : j + 1;
    } else out += c;
  }
  return out.replace(/,(\s*[}\]])/g, '$1');
};

export function parseToml(src) {
  const s = src.replace(/\r\n/g, '\n');
  let i = 0;
  const root = {};
  let cur = root;
  const fail = (m) => {
    throw new Error(`${m} (line ${s.slice(0, i).split('\n').length})`);
  };
  const ws = () => {
    while (i < s.length) {
      if (s[i] === ' ' || s[i] === '\t') i++;
      else if (s[i] === '#') while (i < s.length && s[i] !== '\n') i++;
      else break;
    }
  };
  const wsn = () => {
    for (;;) {
      ws();
      if (s[i] === '\n') i++;
      else break;
    }
  };
  const basic = () => {
    if (s.startsWith('"""', i)) {
      const j = s.indexOf('"""', i + 3);
      if (j < 0) fail('Unclosed string');
      const v = s.slice(i + 3, j).replace(/^\n/, '');
      i = j + 3;
      return v;
    }
    let out = '';
    let j = i + 1;
    while (j < s.length && s[j] !== '"') {
      if (s[j] === '\n') fail('Unclosed string');
      if (s[j] === '\\') {
        const n = s[j + 1];
        if (n === 'u') (out += String.fromCharCode(parseInt(s.slice(j + 2, j + 6), 16))), (j += 6);
        else (out += { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f' }[n] ?? n), (j += 2);
      } else out += s[j++];
    }
    if (j >= s.length) fail('Unclosed string');
    i = j + 1;
    return out;
  };
  const literal = () => {
    const multi = s.startsWith("'''", i);
    const j = s.indexOf(multi ? "'''" : "'", i + (multi ? 3 : 1));
    if (j < 0) fail('Unclosed string');
    const v = s.slice(i + (multi ? 3 : 1), j).replace(/^\n/, '');
    i = j + (multi ? 3 : 1);
    return v;
  };
  const key = () => {
    const parts = [];
    for (;;) {
      ws();
      if (s[i] === '"') parts.push(basic());
      else if (s[i] === "'") parts.push(literal());
      else {
        const m = /^[A-Za-z0-9_-]+/.exec(s.slice(i));
        if (!m) fail('Expected a key');
        parts.push(m[0]);
        i += m[0].length;
      }
      ws();
      if (s[i] !== '.') return parts;
      i++;
    }
  };
  const setPath = (o, parts, v) => {
    let t = o;
    for (const p of parts.slice(0, -1)) t = t[p] ??= {};
    t[parts.at(-1)] = v;
  };
  const value = () => {
    ws();
    const c = s[i];
    if (c === '"') return basic();
    if (c === "'") return literal();
    if (c === '[') {
      i++;
      const arr = [];
      for (;;) {
        wsn();
        if (s[i] === ']') return i++, arr;
        arr.push(value());
        wsn();
        if (s[i] === ',') i++;
        else if (s[i] === ']') return i++, arr;
        else fail('Expected , or ] in an array');
      }
    }
    if (c === '{') {
      i++;
      const o = {};
      ws();
      if (s[i] === '}') return i++, o;
      for (;;) {
        const k = key();
        if (s[i] !== '=') fail('Expected =');
        i++;
        setPath(o, k, value());
        ws();
        if (s[i] === ',') i++;
        else if (s[i] === '}') return i++, o;
        else fail('Expected , or } in an inline table');
      }
    }
    const m = /^(?:true|false|[+-]?\d[\d_]*(?:\.\d+)?)/.exec(s.slice(i));
    if (!m) fail('Unsupported value');
    i += m[0].length;
    return m[0] === 'true' ? true : m[0] === 'false' ? false : Number(m[0].replace(/_/g, ''));
  };
  for (;;) {
    wsn();
    if (i >= s.length) break;
    if (s[i] === '[') {
      if (s[i + 1] === '[') fail('Arrays of tables are not supported here');
      i++;
      const k = key();
      if (s[i] !== ']') fail('Expected ]');
      i++;
      cur = root;
      for (const p of k) cur = cur[p] ??= {};
    } else {
      const k = key();
      if (s[i] !== '=') fail('Expected =');
      i++;
      setPath(cur, k, value());
    }
    ws();
    if (i < s.length && s[i] !== '\n') fail('Unexpected text after a value');
  }
  return root;
}

// ${env:X}, ${input:x}, ${X:-default}, $X and %X% all become ${X}
const normRef = (v) =>
  String(v)
    .replace(/\$\{env:([A-Za-z_]\w*)\}/g, '${$1}')
    .replace(/\$\{input:([\w.-]+)\}/g, (_, id) => '${' + id.toUpperCase().replace(/[^A-Z0-9]+/g, '_') + '}')
    .replace(/\$\{([A-Za-z_]\w*):-[^}]*\}/g, '${$1}')
    .replace(/(^|[^$\w{])\$([A-Za-z_]\w*)/g, '$1${$2}')
    .replace(/%([A-Za-z_]\w*)%/g, '${$1}');

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const looksLikeServer = (v) => isObj(v) && (v.command || v.url || v.httpUrl || v.serverUrl);

function normalize(name, s) {
  const e = { name, transport: 'stdio', command: '', args: [], env: {}, url: '', headers: {} };
  if (isObj(s.command)) {
    // older Zed shape: "command": { "path", "args", "env" }
    e.command = String(s.command.path || '');
    e.args = (s.command.args || []).map(String);
    Object.assign(e.env, s.command.env || {});
  } else {
    e.command = String(s.command || '');
    e.args = (Array.isArray(s.args) ? s.args : []).map(String);
  }
  Object.assign(e.env, isObj(s.env) ? s.env : {});
  for (const v of Array.isArray(s.env_vars) ? s.env_vars : []) if (typeof v === 'string') e.env[v] = `\${${v}}`;
  const url = s.httpUrl || s.serverUrl || s.url || '';
  if (url) {
    e.url = String(url);
    e.transport = s.type === 'sse' || s.transport === 'sse' || (!s.httpUrl && /\/sse\/?(\?|$)/.test(e.url)) ? 'sse' : 'http';
    e.command = '';
    e.args = [];
  }
  Object.assign(e.headers, isObj(s.headers) ? s.headers : {}, isObj(s.http_headers) ? s.http_headers : {});
  for (const [h, v] of Object.entries(isObj(s.env_http_headers) ? s.env_http_headers : {})) e.headers[h] = `\${${v}}`;
  if (s.bearer_token_env_var) e.headers.Authorization = `Bearer \${${s.bearer_token_env_var}}`;
  // npx mcp-remote <url> --header K:${V}  →  a plain remote server again
  const at = e.args.findIndex((a) => /^mcp-remote(@|$)/.test(a));
  if (!url && at >= 0 && /^https?:\/\//.test(e.args[at + 1] || '')) {
    e.url = e.args[at + 1];
    e.transport = /\/sse\/?(\?|$)/.test(e.url) ? 'sse' : 'http';
    const rest = e.args.slice(at + 2);
    for (let j = 0; j < rest.length; j++)
      if (rest[j] === '--header' && rest[j + 1]) {
        const [k, ...v] = rest[++j].split(':');
        e.headers[k.trim()] = v.join(':').trim().replace(/\$\{(\w+)\}/g, (m, n) => e.env[n] ?? m);
      }
    e.command = '';
    e.args = [];
    e.env = {};
    e.bridged = true;
  }
  e.command = normRef(e.command);
  e.args = e.args.map(normRef);
  e.url = normRef(e.url);
  e.env = mapVals(e.env, (v) => normRef(String(v)));
  e.headers = mapVals(e.headers, (v) => normRef(String(v)));
  return e;
}

export const KEY_LABEL = {
  mcpServers: '"mcpServers" (Claude Code, Claude Desktop, Cursor, Windsurf, Gemini CLI, Antigravity, Copilot)',
  servers: '"servers" (VS Code)',
  'mcp.servers': '"mcp.servers" (VS Code settings.json)',
  context_servers: '"context_servers" (Zed)',
  mcp_servers: '[mcp_servers] tables (Codex)',
  single: 'a single server',
  map: 'a map of servers',
};

export function parseConfig(text) {
  const src = text.trim();
  if (!src) return { error: 'Paste a config to convert or check it.' };
  let obj;
  let format;
  if (src[0] === '{') {
    try {
      obj = JSON.parse(stripJsonc(src));
      format = 'json';
    } catch (err) {
      return { error: `This isn't valid JSON: ${err.message}` };
    }
  } else {
    try {
      obj = parseToml(src);
      format = 'toml';
    } catch (err) {
      return { error: `This isn't valid JSON or TOML: ${err.message}` };
    }
  }
  let map;
  let key;
  for (const k of ['mcpServers', 'servers', 'context_servers', 'mcp_servers'])
    if (isObj(obj[k])) {
      map = obj[k];
      key = k;
      break;
    }
  if (!map && isObj(obj.mcp?.servers)) (map = obj.mcp.servers), (key = 'mcp.servers');
  if (!map && looksLikeServer(obj)) (map = { [obj.name || 'server']: obj }), (key = 'single');
  if (!map && Object.keys(obj).length && Object.values(obj).every(looksLikeServer)) (map = obj), (key = 'map');
  if (!map) return { error: 'No MCP servers found. Expected a "mcpServers", "servers" or "context_servers" section, or [mcp_servers.<name>] tables.' };
  const raw = Object.entries(map).filter(([, s]) => isObj(s));
  return { format, key, raw, entries: raw.map(([n, s]) => normalize(n, s)) };
}

// ---------------------------------------------------------------- checker
const SECRET_NAME = /(KEY|TOKEN|SECRET|PASSWORD|PASSWD|PAT|CREDENTIAL|AUTH)/i;
const pkgName = (a) => (/^(@[^/@\s]+\/[^@\s]+|[^@\s/][^@\s]*)/.exec(a) || [])[1];

// Used by the converter: move typed-in keys to ${VAR} references and fix the flags that stop servers starting.
// Returns { entry, fixes: [text] }.
export function fixEntry(e0) {
  const e = { ...e0, args: [...e0.args], env: { ...e0.env }, headers: { ...e0.headers } };
  const fixes = [];
  const literal = (v) => !/\$\{|<[^>]+>/.test(v);
  const secretish = (k, v) => literal(v) && v.length >= 8 && (SECRETS.some(([re]) => re.test(v)) || SECRET_NAME.test(k));
  for (const [k, v] of Object.entries(e.env))
    if (secretish(k, v)) {
      e.env[k] = `\${${k}}`;
      fixes.push(`${e.name}: moved the value of ${k} out of the file (now read from the ${k} environment variable)`);
    }
  for (const [h, v] of Object.entries(e.headers)) {
    const bearer = /^Bearer\s+(.+)$/i.exec(v);
    const val = bearer ? bearer[1] : v;
    if (literal(val) && val.length >= 8 && (SECRETS.some(([re]) => re.test(val)) || /^(authorization|x-api-key|api-key|x-api-token)$/i.test(h))) {
      const n = `${e.name.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_TOKEN`;
      e.headers[h] = bearer ? `Bearer \${${n}}` : `\${${n}}`;
      fixes.push(`${e.name}: moved the ${h} value out of the file (now read from ${n})`);
    }
  }
  if (/^npx(\.cmd)?$/i.test(e.command) && !e.args.includes('-y') && !e.args.includes('--yes')) {
    e.args.unshift('-y');
    fixes.push(`${e.name}: added -y to npx`);
  }
  const run = e.args.indexOf('run');
  if (/^docker$/i.test(e.command) && run >= 0 && !e.args.some((a) => /^-\w*i/.test(a) || a === '--interactive')) {
    e.args.splice(run + 1, 0, '-i');
    fixes.push(`${e.name}: added -i to docker run`);
  }
  return { entry: e, fixes };
}

// app: which app the file is for ('auto' = unknown), so app-specific rules can apply.
export function lintConfig(text, app = 'auto') {
  const p = parseConfig(text);
  if (p.error) return { parsed: p, results: [{ level: 'error', text: p.error }] };
  const r = [];
  const add = (level, t) => r.push({ level, text: t });
  const n = p.entries.length;
  if (!n) return { parsed: p, results: [{ level: 'error', text: 'The servers section is empty.' }] };
  add('ok', `Found ${n} server${n > 1 ? 's' : ''} (${p.entries.map((e) => e.name).join(', ')}) in ${KEY_LABEL[p.key]}.`);
  const reads = { 'claude-code': 'mcpServers', 'claude-desktop': 'mcpServers', cursor: 'mcpServers', windsurf: 'mcpServers', gemini: 'mcpServers', antigravity: 'mcpServers', copilot: 'mcpServers', vscode: 'servers', zed: 'context_servers', codex: 'mcp_servers' }[app];
  if (reads && p.key !== reads && KEY_LABEL[p.key] && !['single', 'map'].includes(p.key))
    add('error', `This app reads ${KEY_LABEL[reads]}, but the file uses ${KEY_LABEL[p.key]}. Convert it with the button below.`);
  p.raw.forEach(([name, s], i) => {
    const e = p.entries[i];
    if (!e.url && !e.command) return add('error', `${name}: no "command" or "url", so there's nothing to start or connect to.`);
    if (p.key === 'mcpServers' && s.url && !s.type && !s.transport && !e.bridged && !['cursor', 'windsurf', 'antigravity', 'gemini', 'claude-desktop'].includes(app))
      add(app === 'auto' ? 'info' : 'error', `${name}: "url" without "type". ${app === 'auto' ? 'Fine for Cursor and Windsurf, but ' : ''}Claude Code and the new Copilot format need "type": "http" here (Claude Code reads it as a local command otherwise).`);
    if (app === 'gemini' && s.url && !s.httpUrl && /\/mcp\/?(\?|$)/.test(s.url))
      add('warn', `${name}: in Gemini CLI "url" means the older SSE transport. For a /mcp endpoint use "httpUrl".`);
    if (app === 'claude-desktop' && s.url && !e.bridged)
      add('warn', `${name}: Claude Desktop's config file runs local commands. Add remote servers in Settings → Connectors, or bridge them with mcp-remote (the generator does this).`);
    if (/^docker$/i.test(e.command) && e.args.includes('run') && !e.args.some((a) => /^-\w*i/.test(a) || a === '--interactive'))
      add('error', `${name}: "docker run" needs -i, or the server can't read requests from the app.`);
    if (/^npx(\.cmd)?$/i.test(e.command) && !e.args.includes('-y') && !e.args.includes('--yes'))
      add('warn', `${name}: add "-y" to the npx args. Without it npx may stop to ask "Ok to proceed?" and the server never starts.`);
    for (const a of e.args) {
      const pkg = pkgName(a);
      if (pkg && RETIRED[pkg]) add('warn', `${name}: ${pkg} is ${RETIRED[pkg]}.`);
    }
    if (/\/sse\/?(\?|$)/.test(e.url)) add('warn', `${name}: this is an SSE endpoint. SSE is deprecated in the MCP spec; most servers now also have a streamable HTTP URL ending in /mcp.`);
    if (/[?&](api[_-]?key|exaApiKey|key|token)=[^&$<{]{8,}/i.test(e.url)) add('error', `${name}: there's a key in the URL. Use a header with an environment variable instead.`);
    const values = [['url', e.url], ...e.args.map((a) => ['args', a]), ...Object.entries(e.env).map(([k, v]) => [k, v]), ...Object.entries(e.headers).map(([k, v]) => [k, v])];
    let flagged = false;
    for (const [k, v] of values) {
      const hit = SECRETS.find(([re]) => re.test(v));
      if (hit) {
        add('error', `${name}: ${k} looks like ${hit[1]} pasted into the config. Anyone who sees this file can use it. Move it to an environment variable (the generator above shows how) and rotate the key.`);
        flagged = true;
      }
    }
    if (!flagged)
      for (const [k, v] of [...Object.entries(e.env), ...Object.entries(e.headers)])
        if (SECRET_NAME.test(k) && v.length >= 8 && !/\$\{|<[^>]+>|^(Bearer\s+)?(your|xxx|\*)/i.test(v))
          add('warn', `${name}: ${k} has a value typed into the file. Fine for a private file, but use an environment variable if the file is shared or committed.`);
  });
  if (r.length === 1) add('ok', 'No problems found.');
  return { parsed: p, results: r };
}
