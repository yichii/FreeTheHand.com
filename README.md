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
- Frontend + domain are hosted on Vercel.
- Shared state (streak counter, total goons reported, anonymous excuse log) lives in
  Cloudflare Workers + Workers KV, so the counter is the same for everyone instead of
  per-browser. Deployed at `https://freethehand-api.freethehand-worker.workers.dev`.
  `vercel.json` rewrites `/api/*` to that Worker so the frontend can call it same-origin.
  See `CLAUDE.md` for the full design.

## Running locally

No build step — just serve the static files and open them in a browser:

```bash
python3 -m http.server 8000
# or: npx serve .
```

Then visit `http://localhost:8000`.

## Deploying the frontend (Vercel)

The site and `freethehand.com` domain are already set up on Vercel, connected to this
repo for deploy-on-push — no build command needed, it's a static file deploy. `vercel.json`
carries the `/api/*` rewrite to the Worker; make sure it stays committed.

To deploy manually instead: `npx vercel --prod` from the repo root (requires `vercel login`
once).

## Deploying the backend (Cloudflare Workers + KV)

The shared counter lives behind a small Worker (`worker/src/index.js`) backed by a KV
namespace holding one JSON blob: `{ streakStartDate, totalGoonsReported, log }`. Already
deployed; to redeploy after changes, from the `worker/` directory:

```bash
npm install       # first time only — installs wrangler locally
npx wrangler login # first time only — authorizes this machine
npx wrangler deploy
```

The KV namespace (binding `GOON_STATE`) and its id in `worker/wrangler.toml` are already
set up. If you ever need to recreate it: `npx wrangler kv namespace create GOON_STATE`,
then paste the returned id into `worker/wrangler.toml`.

The Worker exposes two endpoints, open with no auth (small trusted friend group):

- `GET /api/state` — current shared state (initializes a default on first call)
- `POST /api/report` — resets the streak, bumps the total, appends a log entry with a
  random deadpan excuse (picked server-side from the list in `worker/src/index.js`)

`freethehand.com` is on Vercel, not this Cloudflare account, so a Cloudflare Worker route
(same-domain, zero-CORS) isn't an option here — see the commented `routes` block in
`worker/wrangler.toml` if that ever changes. Instead, `vercel.json`'s rewrite makes
`/api/*` on the Vercel-hosted frontend proxy to the Worker's `workers.dev` URL, so
`script.js` still calls same-origin `/api/...` (`API_BASE = "/api"`). CORS is also left
wide open in the Worker as a fallback, in case the rewrite is ever removed and the
frontend needs to call the `workers.dev` URL directly.

To inspect or reset the live shared state directly:

```bash
npx wrangler kv key get --remote --namespace-id=<id> state
npx wrangler kv key put --remote --namespace-id=<id> state --path=./some-state.json
```

(Omit `--remote` and it writes to wrangler's local dev simulator instead of production —
easy to do by accident.)

Secrets (like any Cloudflare API tokens used outside of Wrangler's own auth) should be
set with `npx wrangler secret put <NAME>`, never committed. See `.gitignore` for what's
kept out of the repo — `.env`, `.dev.vars`, and `.wrangler/` in particular.

## Conventions

See `CLAUDE.md` for tone, design system, and code conventions if you're editing this.
