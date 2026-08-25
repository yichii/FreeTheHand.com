/**
 * Free the Hand — Worker API
 *
 * Shared state for the group goon-streak counter, stored as a single JSON
 * blob in Workers KV under one key. No auth, no per-user identity — small
 * trusted friend group, fully anonymous. Last-write-wins on KV is fine.
 *
 * Routes:
 *   GET  /api/state   -> current shared state (creates a default on first use)
 *   POST /api/report  -> resets the streak, bumps the total, appends a log entry
 */

const KV_KEY = "state";
const MAX_LOG_ENTRIES = 50; // stored cap, keeps the KV value small
const LOG_ENTRIES_RETURNED = 5; // shown to visitors as the "incident log"

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
    log: []
  };
}

async function readState(env) {
  const stored = await env.GOON_STATE.get(KV_KEY, "json");
  if (stored) return stored;
  const fresh = defaultState();
  await env.GOON_STATE.put(KV_KEY, JSON.stringify(fresh));
  return fresh;
}

function publicState(state) {
  return {
    streakStartDate: state.streakStartDate,
    totalGoonsReported: state.totalGoonsReported,
    log: state.log.slice(0, LOG_ENTRIES_RETURNED)
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
      const state = await readState(env);
      const excuse = EXCUSES[Math.floor(Math.random() * EXCUSES.length)];
      const entry = { timestamp: new Date().toISOString(), excuse: excuse };

      const updated = {
        streakStartDate: entry.timestamp,
        totalGoonsReported: state.totalGoonsReported + 1,
        log: [entry].concat(state.log).slice(0, MAX_LOG_ENTRIES)
      };

      await env.GOON_STATE.put(KV_KEY, JSON.stringify(updated));
      return json(publicState(updated));
    }

    return json({ error: "Not found" }, 404);
  }
};
