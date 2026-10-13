/**
 * utils/rate-limit.js — Cloudflare 429 ("Too Many Requests") guard
 *
 * Long runs against a live merchant can get throttled. This keeps our own
 * traffic polite and stops one 429 from cascading into a wall of failures:
 *
 *  1. Pacing    — a short pause before every test (REQUEST_PACING_MS).
 *  2. Detection — count HTTP 429 responses seen during a test.
 *  3. Cooldown  — if a test was throttled, the NEXT test waits
 *                 RATE_LIMIT_COOLDOWN_MS first, so Playwright's retry / the
 *                 next test doesn't hit the same wall.
 *
 * Wired in as the auto `rateLimitGuard` fixture in fixtures/base.js.
 * State is per Playwright worker (the suite runs with workers: 1).
 *
 * Env:
 *   REQUEST_PACING_MS        default 500    (0 disables pacing)
 *   RATE_LIMIT_COOLDOWN_MS   default 20000  (0 disables cooldown)
 */

const { shouldIgnore } = require('./network');

function envMs(name, fallback) {
    const n = Number(process.env[name]);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
}

const PACING_MS   = envMs('REQUEST_PACING_MS', 500);
const COOLDOWN_MS = envMs('RATE_LIMIT_COOLDOWN_MS', 20_000);

let cooldownUntil = 0;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/** Wait out any active cooldown, then apply the normal pacing delay. */
async function waitBeforeTest() {
    const cooldown = Math.max(cooldownUntil - Date.now(), 0);
    if (cooldown > 0) {
        console.warn(`[rate-limit] Previous test was throttled (429) — cooling down ${Math.round(cooldown / 1000)}s.`);
    }
    const total = cooldown + PACING_MS;
    if (total > 0) await sleep(total);
}

/**
 * Count 429 responses on a page (third-party noise ignored).
 * @param {import('@playwright/test').Page} page
 * @returns {{ count: () => number, urls: () => string[] }}
 */
function watch(page) {
    const urls = [];
    page.on('response', response => {
        if (response.status() === 429 && !shouldIgnore(response.url())) urls.push(response.url());
    });
    return { count: () => urls.length, urls: () => [...urls] };
}

/** Called when a test was throttled: make the next test wait. */
function startCooldown() {
    cooldownUntil = Date.now() + COOLDOWN_MS;
}

module.exports = { waitBeforeTest, watch, startCooldown, PACING_MS, COOLDOWN_MS };
