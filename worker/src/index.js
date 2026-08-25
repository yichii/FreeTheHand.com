/**
 * Free the Hand — Worker API
 *
 * Shared state for the group goon-streak counter, stored as a single JSON
 * blob in Workers KV under one key. No auth — small trusted friend group.
 * Reports and pledges carry a hand-drawn signature (a small PNG, signed with
 * mouse or finger) so it's visible that the site is shared/multiplayer.
 * Last-write-wins on KV is fine.
 *
 * Routes:
 *   GET  /api/state   -> current shared state (creates a default on first use)
 *   POST /api/report  -> resets the streak, bumps the total, appends a log entry
 *   POST /api/pledge  -> appends a signed pledge entry
 */

const KV_KEY = "state";
const MAX_LOG_ENTRIES = 50; // stored cap, keeps the KV value small
const LOG_ENTRIES_RETURNED = 5; // shown to visitors as the "incident log"
const MAX_PLEDGE_ENTRIES = 200; // stored cap
const PLEDGE_ENTRIES_RETURNED = 100; // shown to visitors as the signature ledger

// Hand-drawn signatures come in as small PNG data URIs. Generous but bounded
// cap keeps a single KV value (and a single bad-faith POST) from growing
// unreasonably large.
const MAX_SIGNATURE_LENGTH = 200000;
const SIGNATURE_DATA_URL_PATTERN = /^data:image\/png;base64,[A-Za-z0-9+/]+=*$/;

const EXCUSES = [
  "Distracted by a podcast.",
  "Thought about it too hard.",
  "Saw a doorknob.",
  "Tuesday.",
  "The WiFi went out.",
  "Read a spicy group chat.",
  "Bored during a Zoom call.",
  "Blamed the full moon.",
  "Ergonomic curiosity got the better of me.",
  "Momentary lapse in supervision.",
  "The cat left the room.",
  "Forgot the pledge existed.",
  "A gentle breeze.",
  "It was right there.",
  "Peer pressure from absolutely no one."
];

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ "Content-Type": "application/json" }, CORS_HEADERS)
  });
}

function defaultState() {
  return {
    streakStartDate: new Date().toISOString(),
    totalGoonsReported: 0,
    log: [],
    pledges: []
  };
}

// Older KV entries predate the pledges list; backfill so callers don't have
// to special-case a missing field.
function normalizeState(state) {
  if (!Array.isArray(state.pledges)) state.pledges = [];
  return state;
}

function cleanSignature(raw) {
  if (typeof raw !== "string") return "";
  if (raw.length > MAX_SIGNATURE_LENGTH) return "";
  if (!SIGNATURE_DATA_URL_PATTERN.test(raw)) return "";
  return raw;
}

async function readState(env) {
  const stored = await env.GOON_STATE.get(KV_KEY, "json");
  if (stored) return normalizeState(stored);
  const fresh = defaultState();
  await env.GOON_STATE.put(KV_KEY, JSON.stringify(fresh));
  return fresh;
}

function publicState(state) {
  return {
    streakStartDate: state.streakStartDate,
    totalGoonsReported: state.totalGoonsReported,
    log: state.log.slice(0, LOG_ENTRIES_RETURNED),
    pledges: state.pledges.slice(0, PLEDGE_ENTRIES_RETURNED)
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (url.pathname === "/api/state" && request.method === "GET") {
      const state = await readState(env);
      return json(publicState(state));
    }

    if (url.pathname === "/api/report" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch (e) {
        body = {};
      }
      const signature = cleanSignature(body.signature);
      if (!signature) {
        return json({ error: "SIGNATURE REQUIRED — reports are not valid without one." }, 400);
      }

      const state = await readState(env);
      const excuse = EXCUSES[Math.floor(Math.random() * EXCUSES.length)];
      const entry = { timestamp: new Date().toISOString(), excuse: excuse, signature: signature };

      const updated = {
        streakStartDate: entry.timestamp,
        totalGoonsReported: state.totalGoonsReported + 1,
        log: [entry].concat(state.log).slice(0, MAX_LOG_ENTRIES),
        pledges: state.pledges
      };

      await env.GOON_STATE.put(KV_KEY, JSON.stringify(updated));
      return json(publicState(updated));
    }

    if (url.pathname === "/api/pledge" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch (e) {
        body = {};
      }
      const signature = cleanSignature(body.signature);
      if (!signature) {
        return json({ error: "SIGNATURE REQUIRED — pledges are not valid without one." }, 400);
      }

      const state = await readState(env);
      const entry = { signature: signature, timestamp: new Date().toISOString() };

      const updated = {
        streakStartDate: state.streakStartDate,
        totalGoonsReported: state.totalGoonsReported,
        log: state.log,
        pledges: [entry].concat(state.pledges).slice(0, MAX_PLEDGE_ENTRIES)
      };

      await env.GOON_STATE.put(KV_KEY, JSON.stringify(updated));
      return json(publicState(updated));
    }

    return json({ error: "Not found" }, 404);
  }
};
