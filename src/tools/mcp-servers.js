// MCP server catalogue for the config generator. Every entry was checked against the vendor's own docs on 2026-11-26.
// remote: { url, oauth, key?: { var, header, prefix, required, url? } }   (key.url = a different endpoint when using a key)
// local:  { command, args, env?: { VAR: { secret, hint } }, params? }      params fill placeholders in args: {name}
export const CHECKED = '26 November 2026';

export const CATS = ['Code & git', 'Browser & web', 'Docs & search', 'Project tools', 'Cloud & data', 'Thinking & memory'];

export const SERVERS = [
  {
    id: 'github', name: 'GitHub', icon: '🐙', cat: 'Code & git',
    desc: 'Issues, pull requests, code search and Actions in your GitHub repos.',
    docs: 'https://github.com/github/github-mcp-server',
    remote: { url: 'https://api.githubcopilot.com/mcp/', oauth: true, key: { var: 'GITHUB_PAT', header: 'Authorization', prefix: 'Bearer ', required: false } },
    defaultAuth: 'key',
    local: { command: 'docker', args: ['run', '-i', '--rm', '-e', 'GITHUB_PERSONAL_ACCESS_TOKEN', 'ghcr.io/github/github-mcp-server'], env: { GITHUB_PERSONAL_ACCESS_TOKEN: { secret: true, hint: 'a GitHub personal access token' } } },
    note: 'Sign-in (OAuth) works in VS Code and as a Claude connector. Most other apps need a personal access token.',
  },
  {
    id: 'playwright', name: 'Playwright', icon: '🎭', cat: 'Browser & web',
    desc: 'Lets the agent open pages, click, type and take screenshots in a real browser.',
    docs: 'https://github.com/microsoft/playwright-mcp',
    local: { command: 'npx', args: ['-y', '@playwright/mcp@latest'] },
    note: 'Needs Node.js 20 or newer.',
  },
  {
    id: 'chrome-devtools', name: 'Chrome DevTools', icon: '🧪', cat: 'Browser & web',
    desc: 'Debug a live Chrome: console, network requests, performance traces.',
    docs: 'https://github.com/ChromeDevTools/chrome-devtools-mcp',
    local: { command: 'npx', args: ['-y', 'chrome-devtools-mcp@latest'] },
  },
  {
    id: 'context7', name: 'Context7', icon: '📚', cat: 'Docs & search',
    desc: 'Up-to-date docs and code examples for thousands of libraries, so the agent stops guessing APIs.',
    docs: 'https://github.com/upstash/context7',
    remote: { url: 'https://mcp.context7.com/mcp', oauth: false, key: { var: 'CONTEXT7_API_KEY', header: 'Authorization', prefix: 'Bearer ', required: false } },
    local: { command: 'npx', args: ['-y', '@upstash/context7-mcp'] },
    note: 'Works without a key on the free rate limit.',
  },
  {
    id: 'filesystem', name: 'Filesystem', icon: '📁', cat: 'Code & git',
    desc: 'Read and write files, but only inside the folders you list.',
    docs: 'https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem',
    local: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '{folders}'], params: [{ id: 'folders', label: 'Allowed folders', hint: 'one per line, full paths', list: true, mac: '/Users/you/projects', win: 'C:\\Users\\you\\projects', linux: '/home/you/projects' }] },
  },
  {
    id: 'git', name: 'Git', icon: '🌿', cat: 'Code & git',
    desc: 'Read git history, diffs and branches, and make commits in one repo.',
    docs: 'https://github.com/modelcontextprotocol/servers/tree/main/src/git',
    local: { command: 'uvx', args: ['mcp-server-git', '--repository', '{repo}'], params: [{ id: 'repo', label: 'Repository folder', hint: 'full path', mac: '/Users/you/projects/my-app', win: 'C:\\Users\\you\\projects\\my-app', linux: '/home/you/projects/my-app' }] },
    note: 'Needs uv (uvx) installed.',
  },
  {
    id: 'fetch', name: 'Fetch', icon: '🌐', cat: 'Browser & web',
    desc: 'Fetches a web page and turns it into Markdown the agent can read.',
    docs: 'https://github.com/modelcontextprotocol/servers/tree/main/src/fetch',
    local: { command: 'uvx', args: ['mcp-server-fetch'] },
    note: 'Needs uv (uvx) installed.',
  },
  {
    id: 'memory', name: 'Memory', icon: '🧠', cat: 'Thinking & memory',
    desc: 'A small knowledge graph the agent can save facts to and recall later.',
    docs: 'https://github.com/modelcontextprotocol/servers/tree/main/src/memory',
    local: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-memory'] },
  },
  {
    id: 'sequential-thinking', name: 'Sequential Thinking', icon: '🪜', cat: 'Thinking & memory',
    desc: 'Gives the agent a structured, step-by-step scratchpad for hard problems.',
    docs: 'https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking',
    local: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-sequential-thinking'] },
  },
  {
    id: 'brave-search', name: 'Brave Search', icon: '🦁', cat: 'Docs & search',
    desc: 'Web, news and image search through the Brave Search API.',
    docs: 'https://github.com/brave/brave-search-mcp-server',
    local: { command: 'npx', args: ['-y', '@brave/brave-search-mcp-server', '--transport', 'stdio'], env: { BRAVE_API_KEY: { secret: true, hint: 'a Brave Search API key' } } },
    note: 'Replaces the archived @modelcontextprotocol/server-brave-search.',
  },
  {
    id: 'exa', name: 'Exa', icon: '🔎', cat: 'Docs & search',
    desc: 'AI web search and code search built for agents.',
    docs: 'https://docs.exa.ai/reference/exa-mcp',
    remote: { url: 'https://mcp.exa.ai/mcp', oauth: false, key: { var: 'EXA_API_KEY', header: 'x-api-key', prefix: '', required: false } },
    local: { command: 'npx', args: ['-y', 'exa-mcp-server'], env: { EXA_API_KEY: { secret: true, hint: 'an Exa API key' } } },
    note: 'The remote server works without a key on a free rate limit.',
  },
  {
    id: 'firecrawl', name: 'Firecrawl', icon: '🔥', cat: 'Browser & web',
    desc: 'Scrape, crawl and search websites into clean Markdown.',
    docs: 'https://docs.firecrawl.dev/mcp-server',
    remote: { url: 'https://mcp.firecrawl.dev/v2/mcp-oauth', oauth: true, key: { var: 'FIRECRAWL_API_KEY', header: 'Authorization', prefix: 'Bearer ', required: false, url: 'https://mcp.firecrawl.dev/v2/mcp' } },
    local: { command: 'npx', args: ['-y', 'firecrawl-mcp'], env: { FIRECRAWL_API_KEY: { secret: true, hint: 'a Firecrawl API key' } } },
  },
  {
    id: 'sentry', name: 'Sentry', icon: '🚨', cat: 'Project tools',
    desc: 'Look up errors, stack traces and issues from your Sentry projects.',
    docs: 'https://mcp.sentry.dev/',
    remote: { url: 'https://mcp.sentry.dev/mcp', oauth: true },
  },
  {
    id: 'linear', name: 'Linear', icon: '📐', cat: 'Project tools',
    desc: 'Find, create and update Linear issues, projects and comments.',
    docs: 'https://linear.app/docs/mcp',
    remote: { url: 'https://mcp.linear.app/mcp', oauth: true, key: { var: 'LINEAR_API_KEY', header: 'Authorization', prefix: 'Bearer ', required: false } },
  },
  {
    id: 'notion', name: 'Notion', icon: '📝', cat: 'Project tools',
    desc: 'Search, read and edit pages and databases in your Notion workspace.',
    docs: 'https://developers.notion.com/docs/get-started-with-mcp',
    remote: { url: 'https://mcp.notion.com/mcp', oauth: true },
    note: 'The old local server (@notionhq/notion-mcp-server) is no longer maintained.',
  },
  {
    id: 'atlassian', name: 'Atlassian', icon: '🧩', cat: 'Project tools',
    desc: 'Jira issues and Confluence pages through Atlassian\'s Rovo MCP server.',
    docs: 'https://support.atlassian.com/atlassian-rovo-mcp-server/',
    remote: { url: 'https://mcp.atlassian.com/v2/mcp', oauth: true },
  },
  {
    id: 'figma', name: 'Figma', icon: '🎨', cat: 'Project tools',
    desc: 'Turns Figma frames into code context: layout, variables, components.',
    docs: 'https://developers.figma.com/docs/figma-mcp-server/',
    remote: { url: 'https://mcp.figma.com/mcp', oauth: true },
  },
  {
    id: 'supabase', name: 'Supabase', icon: '⚡', cat: 'Cloud & data',
    desc: 'Query tables, manage migrations and read logs in your Supabase project.',
    docs: 'https://supabase.com/docs/guides/getting-started/mcp',
    remote: { url: 'https://mcp.supabase.com/mcp', oauth: true, key: { var: 'SUPABASE_ACCESS_TOKEN', header: 'Authorization', prefix: 'Bearer ', required: false }, params: [{ id: 'project_ref', label: 'Project ref', hint: 'optional · limits it to one project', query: true }, { id: 'read_only', label: 'Read-only', check: true, on: true, query: true }] },
  },
  {
    id: 'stripe', name: 'Stripe', icon: '💳', cat: 'Cloud & data',
    desc: 'Customers, payments, products and the Stripe docs.',
    docs: 'https://docs.stripe.com/mcp',
    remote: { url: 'https://mcp.stripe.com', oauth: true, key: { var: 'STRIPE_API_KEY', header: 'Authorization', prefix: 'Bearer ', required: false } },
    note: 'For a key, use a restricted agent key: Stripe stops accepting full secret keys here from 11 January 2027.',
  },
  {
    id: 'vercel', name: 'Vercel', icon: '▲', cat: 'Cloud & data',
    desc: 'Projects, deployments and logs on Vercel, plus the Vercel docs.',
    docs: 'https://vercel.com/docs/mcp/vercel-mcp',
    remote: { url: 'https://mcp.vercel.com', oauth: true },
  },
  {
    id: 'cloudflare', name: 'Cloudflare', icon: '☁️', cat: 'Cloud & data',
    desc: 'The Cloudflare API: Workers, DNS, R2, D1 and more.',
    docs: 'https://developers.cloudflare.com/agents/model-context-protocol/mcp-servers-for-cloudflare/',
    remote: { url: 'https://mcp.cloudflare.com/mcp', oauth: true, key: { var: 'CLOUDFLARE_API_TOKEN', header: 'Authorization', prefix: 'Bearer ', required: false } },
  },
  {
    id: 'postgres', name: 'Postgres', icon: '🐘', cat: 'Cloud & data',
    desc: 'Inspect a Postgres schema and run read-only queries. Community server (crystaldba/postgres-mcp).',
    docs: 'https://github.com/crystaldba/postgres-mcp',
    local: { command: 'uvx', args: ['postgres-mcp', '--access-mode=restricted'], env: { DATABASE_URI: { secret: true, hint: 'your database URL' } } },
    note: 'Third-party: the official reference Postgres server was archived in 2025.',
  },
];

// Archived or replaced packages the checker warns about.
export const RETIRED = {
  '@modelcontextprotocol/server-github': 'archived: use GitHub\'s official server (remote https://api.githubcopilot.com/mcp/ or ghcr.io/github/github-mcp-server)',
  '@modelcontextprotocol/server-postgres': 'archived in 2025 with no official replacement',
  '@modelcontextprotocol/server-brave-search': 'archived: use @brave/brave-search-mcp-server',
  '@modelcontextprotocol/server-puppeteer': 'archived: use @playwright/mcp or chrome-devtools-mcp',
  '@modelcontextprotocol/server-slack': 'archived (now maintained as zencoderai/slack-mcp-server)',
  '@modelcontextprotocol/server-gdrive': 'archived',
  '@modelcontextprotocol/server-sqlite': 'archived',
  '@modelcontextprotocol/server-redis': 'archived',
  '@modelcontextprotocol/server-gitlab': 'archived',
  '@modelcontextprotocol/server-google-maps': 'archived',
  '@modelcontextprotocol/server-sentry': 'archived: use Sentry\'s remote server https://mcp.sentry.dev/mcp',
  '@notionhq/notion-mcp-server': 'no longer maintained: use Notion\'s remote server https://mcp.notion.com/mcp',
};
