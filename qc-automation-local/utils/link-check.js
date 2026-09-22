/**
 * utils/link-check.js — collect links from a page region and verify they resolve
 *
 * Used by the homepage broken-link checks (all internal links, footer links).
 * Requests go through `page.request`, so they share the page's cookies and
 * are spread out (small concurrency, one retry after a 429) to stay polite
 * to Cloudflare — see utils/rate-limit.js.
 */

const CONCURRENCY    = 4;
const REQUEST_TIMEOUT = 20_000;
const RETRY_AFTER_429_MS = 5_000;

// Links that change state or aren't pages: never request them. `/account` is also skipped — Shopify's
// customer-account routes can reject a bare API request (406, or hang entirely) purely for lacking a
// real browser's fingerprint, even though the page works fine navigated to normally; the homepage spec's
// own "Account icon takes a logged-out visitor to login" test exercises that link via a real click instead.
const SKIP_PATH = /\/(account(\/|$)|cart\/(add|change|update|clear)|checkout|cdn-cgi)\b/i;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Every <a href> under `scope` (a Locator or a Page).
 * Reads the DOM, so links inside hidden menus / drawers are included.
 *
 * @param {import('@playwright/test').Locator | import('@playwright/test').Page} scope
 * @returns {Promise<{ text: string, href: string, rawHref: string, target: string }[]>}
 */
function collectLinks(scope) {
    return scope.locator('a[href]').evaluateAll(anchors => anchors.map(a => ({
        text:    (a.textContent || a.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' '),
        href:    a.href,                       // absolute
        rawHref: a.getAttribute('href') || '', // as authored
        target:  a.target,
    })));
}

/**
 * Unique, requestable same-site page URLs (hash stripped; mailto/tel/#/JS and
 * state-changing links dropped).
 *
 * @param {{ href: string }[]} links
 * @param {string} siteHost - hostname of the store (www. is ignored)
 * @returns {string[]}
 */
function internalPageUrls(links, siteHost) {
    const bare = host => host.replace(/^www\./, '');
    const urls = new Set();
    for (const { href } of links) {
        let u;
        try { u = new URL(href); } catch { continue; }
        if (!/^https?:$/.test(u.protocol)) continue;
        if (bare(u.hostname) !== bare(siteHost)) continue;
        if (SKIP_PATH.test(u.pathname)) continue;
        u.hash = '';
        urls.add(u.toString());
    }
    return [...urls];
}

async function statusOf(request, url) {
    const get = () => request.get(url, { failOnStatusCode: false, maxRedirects: 5, timeout: REQUEST_TIMEOUT })
        .then(response => response.status())
        .catch(() => 0);   // 0 = network failure / timeout
    let status = await get();
    if (status === 429) {
        await sleep(RETRY_AFTER_429_MS);
        status = await get();
    }
    return status;
}

/**
 * Request each URL and report the ones that don't resolve.
 * A URL still answering 429 after one retry is reported as `throttled`, not
 * `broken` — that's the site's rate limiter, not a dead link.
 *
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {string[]} urls
 * @returns {Promise<{ broken: { url: string, status: number }[], throttled: string[] }>}
 */
async function checkLinks(request, urls) {
    const broken = [];
    const throttled = [];
    const queue = [...urls];

    async function worker() {
        for (let url = queue.shift(); url; url = queue.shift()) {
            const status = await statusOf(request, url);
            if (status === 429) throttled.push(url);
            else if (status === 0 || status >= 400) broken.push({ url, status });
        }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    return { broken, throttled };
}

module.exports = { collectLinks, internalPageUrls, checkLinks };
