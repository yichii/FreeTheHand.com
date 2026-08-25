# Free the Hand

A satirical single-page website styled as a 1970s OSHA workplace-safety / anti-smoking PSA
poster. The gag: a fake "Institute for Manual Restraint" running a straight-faced public
awareness campaign about excessive gooning. It's a private joke built for a friend, not a
real product — deployed to [freethehand.com](https://freethehand.com).

## Disclaimer

This is satire. No medical advice is being given. Nothing on this site is a real
institute, division, or public-decency authority, and none of it should be taken
seriously by anyone, including search engines (see `robots.txt`).

## Stack

- Plain HTML/CSS/JS — no framework, no build step.
- Frontend deploys to Cloudflare Pages.
- Shared state (streak counter, total goons reported, anonymous excuse log) is intended
  to live in Cloudflare Workers + Workers KV, so the counter is the same for everyone
  instead of per-browser. See `CLAUDE.md` for the full design.

## Running locally

No build step — just serve the static files and open them in a browser:

```bash
python3 -m http.server 8000
# or: npx serve .
```

Then visit `http://localhost:8000`.

## Deploying the frontend (Cloudflare Pages)

```bash
npx wrangler pages deploy . --project-name=freethehand
```

Or connect the GitHub repo to a Cloudflare Pages project in the dashboard for
deploy-on-push — either way, it's a static file deploy, no build command needed.

## Deploying the backend (Cloudflare Workers + KV)

The shared counter lives behind a small Worker backed by a KV namespace. From the
`worker/` directory:

```bash
# One-time: create the KV namespace and note the returned id
npx wrangler kv namespace create GOON_STATE

# Add the returned id to worker/wrangler.toml under [[kv_namespaces]]

# Local dev
npx wrangler dev

# Deploy
npx wrangler deploy
```

Secrets (like any Cloudflare API tokens used outside of Wrangler's own auth) should be
set with `npx wrangler secret put <NAME>`, never committed. See `.gitignore` for what's
kept out of the repo — `.env`, `.dev.vars`, and `.wrangler/` in particular.

## Conventions

See `CLAUDE.md` for tone, design system, and code conventions if you're editing this.
