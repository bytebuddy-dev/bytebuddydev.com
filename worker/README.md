# Bugsy AI (Cloudflare Worker + Groq)

The website chat sends typed messages here; this Worker adds Bugsy's instructions and calls Groq.
The Groq key is a Worker **secret**: it is never in the website's code or in git.

- `src/index.js`: the Worker (allowed origins, 8 requests/min per IP, 10 messages × 600 chars, falls back on any Groq error)
- `src/prompt.js`: Bugsy's instructions (site pages, tone, SKILL.md rules). Update it when the site changes.
- `npm test`: tests the Worker against a fake Groq (no key, no network)

## One-time setup

1. **Groq key**: sign in at https://console.groq.com, then **API Keys → Create API key**. Copy it (starts with `gsk_`).
   Check your free limits at https://console.groq.com/settings/limits.
2. **Cloudflare**: create a free account at https://dash.cloudflare.com/sign-up.
3. In this folder:
   ```bash
   npm install
   npx wrangler login                  # opens the browser once
   npx wrangler secret put GROQ_API_KEY   # paste the key when asked (it is not shown or saved locally)
   npx wrangler deploy                 # prints https://bugsy-ai.<your-subdomain>.workers.dev
   ```
4. Build the site with AI on:
   ```bash
   cd .. && npm run build   # the deployed URL is the default in build.mjs; set BUGSY_AI_URL to override
   ```
   This also updates the privacy page to mention Groq.

With `BUGSY_AI_URL=` (empty), the site uses scripted Bugsy only. If Groq is down or the free quota runs out,
the Worker returns `{ fallback: true }` and the site quietly switches to scripted answers.

Change the model in `wrangler.toml` (`GROQ_MODEL`), default `openai/gpt-oss-20b`.

## Try it locally

Put the key in `worker/.dev.vars` (git-ignored, see `.dev.vars.example`), run `npx wrangler dev`
(http://localhost:8787), then build the site with `BUGSY_AI_URL=http://localhost:8787/chat`.
