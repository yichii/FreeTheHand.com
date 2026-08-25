# Free the Hand

Satirical single-page website styled as a 1970s OSHA workplace-safety / anti-smoking PSA
poster. The gag: a fake "Institute for Manual Restraint" running a public-awareness
campaign about excessive gooning, aimed at a friend as a joke. Deployed to freethehand.com.

Tone is deadpan and affectionate, never crude — funny because it's played completely
straight, like a real vintage government poster. Keep all copy PG-13.

## Stack

- Plain HTML/CSS/JS. No frontend framework, no build step.
- Backend: Cloudflare Workers + Workers KV (free tier) for shared state across all
  visitors. No auth, no per-user accounts — small trusted friend group, fully anonymous.
- Frontend + `freethehand.com` domain are hosted on Vercel; `vercel.json` rewrites
  `/api/*` to the Cloudflare Worker so the frontend calls it same-origin.

## Shared state (Workers KV)

Single JSON blob holding:
- `streakStartDate` — resets to now whenever anyone reports a goon
- `totalGoonsReported` — running tally
- `log` — array of `{ timestamp, excuse }`, anonymous, no names attached

Frontend fetches this from the Worker API on load; never reads/writes localStorage for
this data. Last-write-wins on conflicts is fine — this doesn't need to be bulletproof.

## Design system

- Palette: cream paper `#F2E9D8`, ink black `#1F1B16`, mustard `#D4A017`, teal `#2B6E6E`,
  rust red `#B5451B` (warnings), faded brown `#8A7B5C` (aged-paper shadows)
- Type: Alfa Slab One (headlines), Courier Prime (memo/stamp body text), a condensed sans
  for small print/labels — all via Google Fonts
- Visual language: paper grain/texture, slightly rotated "stamped" elements, hairline
  rules, halftone dividers. Should read as a printed, worn government poster — not a
  modern web UI. No rounded corners, no drop-shadow-heavy modern card UI.

## Conventions

- Single-file-per-concern is fine given the small scope: `index.html`, `styles.css`,
  `app.js`, plus a small `worker/` directory for the Cloudflare Worker source.
- Don't introduce a framework or build tooling unless explicitly asked — this should stay
  simple enough to hand-edit directly.
- Any copy changes should keep the bureaucratic-PSA voice consistent with existing text
  (see hero, warning badges, pledge section, footer disclaimer).

## Off-limits

- Don't make content graphic/explicit — innuendo and dry humor only.
- Don't add user accounts, names, or any way to attribute a report to a specific person —
  anonymity is a deliberate design choice, not an oversight.
- Don't commit Cloudflare API tokens or wrangler secrets — use `.env` / wrangler secrets,
  keep them out of git.
