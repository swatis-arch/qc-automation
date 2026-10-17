/**
 * utils/shopify-store.js — reading and driving any Shopify storefront without a merchant config.
 *
 * Used for stores the suite isn't set up for (merchants/adhoc): utils/ticket-checks.js and
 * tests/store-regression.spec.js. Everything goes through Shopify's standard storefront URLs and
 * JSON endpoints (/products.json, /products/<handle>.js, /cart.js, /cart/add.js, /cart/change.js),
 * which every theme has, plus markup common to Shopify themes where a click is needed.
 * page.request shares the browser context's cookies, so cart calls and page views see the same cart.
 *
 * Shopify throttles its JSON endpoints per IP (HTTP 429, an HTML page), so every request backs off and
 * retries, and the product feed is read once per store per worker.
 */

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** page.request.get/post with back-off on HTTP 429 (Retry-After, else 5 s, 10 s, 20 s). */
async function request(page, method, path, options = {}) {
    for (let attempt = 0; ; attempt++) {
        const res = await page.request[method](path, { timeout: 30_000, ...options });
        if (res.status() !== 429 || attempt === 3) return res;
        const after = Number(res.headers()['retry-after']);
        await sleep(Math.min(after > 0 ? after * 1000 : 5_000 * 2 ** attempt, 30_000));
    }
}

/** A product's first in-stock variant from /products/<handle>.js: { handle, title, variantId, product }, or null if sold out. */
async function productJs(page, handle) {
    const res = await request(page, 'get', `/products/${handle}.js`);
    if (!res.ok()) throw new Error(`/products/${handle} returned HTTP ${res.status()}`);
    const p = await res.json();
    const v = (p.variants || []).find(x => x.available);
    return v ? { handle, title: p.title, variantId: v.id, product: p } : null;
}

/** Product handles the store's collection page and homepage link to. */
async function linkedHandles(page) {
    const handles = new Set();
    for (const path of ['/collections/all', '/']) {
        const html = await request(page, 'get', path).then(r => (r.ok() ? r.text() : '')).catch(() => '');
        for (const m of html.matchAll(/\/products\/([a-z0-9][a-z0-9-]*)/gi)) handles.add(m[1].toLowerCase());
    }
    return [...handles];
}

/**
 * An in-stock product: `handle` if given, else the first one in /products.json, or (for stores that hide
 * that feed) among the products /collections/all and the homepage link to. `accept(product)` can skip some
 * (e.g. to find one with several variants). Returns { handle, title, variantId, product }.
 */
async function findProduct(page, { handle = null, accept = () => true } = {}) {
    if (handle) {
        const p = await productJs(page, handle);
        if (!p) throw new Error(`/products/${handle} is sold out in every variant`);
        return p;
    }
    const products = await listProducts(page);
    for (const p of products) {
        const v = (p.variants || []).find(x => x.available);
        if (v && accept(p)) return { handle: p.handle, title: p.title, variantId: v.id, product: p };
    }
    const handles = await linkedHandles(page);
    for (const h of handles.slice(0, 15)) {
        const p = await productJs(page, h).catch(() => null);
        if (p && accept(p.product)) return p;
    }
    throw new Error(products.length || handles.length
        ? 'No matching product in stock was found (checked /products.json, /collections/all and the homepage)'
        : 'No products found: /products.json, /collections/all and the homepage list none. Is this a Shopify storefront?');
}

const feedCache = new Map();

/**
 * Products in /products.json (empty when the store hides the feed), read once per store per worker.
 * limit=50: some stores throttle bigger pages.
 */
async function listProducts(page) {
    const origin = process.env.QC_ADHOC_BASE_URL || '';   // a run covers one store
    if (!feedCache.has(origin)) {
        const res = await request(page, 'get', '/products.json?limit=50');
        if (res.status() === 429) throw new Error('/products.json is rate-limited (HTTP 429) even after backing off: re-run later');
        feedCache.set(origin, res.ok() ? ((await res.json().catch(() => ({}))).products || []) : []);
    }
    return feedCache.get(origin);
}

/** The cart as /cart.js reports it. */
async function getCart(page) {
    const res = await request(page, 'get', '/cart.js');
    if (!res.ok()) throw new Error(`/cart.js returned HTTP ${res.status()}`);
    return res.json();
}

/** Add a variant to the cart through /cart/add.js. */
async function addToCart(page, variantId, quantity = 1) {
    const res = await request(page, 'post', '/cart/add.js', { data: { items: [{ id: variantId, quantity }] } });
    if (!res.ok()) throw new Error(`/cart/add.js returned HTTP ${res.status()}: ${(await res.text()).slice(0, 200)}`);
}

/** Set a cart line's quantity through /cart/change.js (line is 1-based). */
async function changeLine(page, line, quantity) {
    const res = await request(page, 'post', '/cart/change.js', { data: { line, quantity } });
    if (!res.ok()) throw new Error(`/cart/change.js returned HTTP ${res.status()}`);
    return res.json();
}

const clearCart = page => request(page, 'post', '/cart/clear.js');

/** Amount in cents → the digits a page shows for it ("2499" → "24.99"; "2500" also matches "25"). */
function moneyPatterns(cents) {
    const whole = Math.floor(cents / 100), part = String(cents % 100).padStart(2, '0');
    const withCommas = whole.toLocaleString('en-US');
    const out = [`${whole}.${part}`, `${withCommas}.${part}`, `${whole},${part}`];
    if (part === '00') out.push(String(whole), withCommas);
    return [...new Set(out)];
}

/** Whether `text` shows the amount (in cents) as a price. */
function showsAmount(text, cents) {
    const flat = String(text).replace(/\s+/g, ' ');
    return moneyPatterns(cents).some(p => new RegExp(`(^|[^\\d.,])${p.replace(/[.,]/g, m => `\\${m}`)}(?![\\d])`).test(flat));
}

/** Prices in /products/<handle>.js are cents; in /products.json they are "24.99" strings. */
const toCents = price => (typeof price === 'number' ? price : Math.round(parseFloat(price) * 100));

/** Internal links (same host, http status worth checking) inside a locator, de-duplicated, at most `max`. */
async function internalLinks(locator, origin, max = 25) {
    const hrefs = await locator.evaluateAll(els => els.map(a => a.href)).catch(() => []);
    const host = new URL(origin).hostname.replace(/^www\./, '');
    const out = new Set();
    for (const href of hrefs) {
        let u;
        try { u = new URL(href); } catch { continue; }
        if (!/^https?:$/.test(u.protocol) || u.hostname.replace(/^www\./, '') !== host) continue;
        if (/^\/(cart|account|checkout|checkouts)(\/|$)|^\/apps\/|\/password$/.test(u.pathname)) continue;
        u.hash = '';
        out.add(u.pathname + u.search);
        if (out.size >= max) break;
    }
    return [...out];
}

/** HTTP status of each path (GET), a few at a time with back-off on 429. Returns [{ path, status }]. */
async function statuses(page, paths, batch = 3) {
    const out = [];
    for (let i = 0; i < paths.length; i += batch) {
        out.push(...await Promise.all(paths.slice(i, i + batch).map(async path => {
            const status = await request(page, 'get', path, { maxRedirects: 5 }).then(r => r.status()).catch(() => 0);
            return { path, status };
        })));
        await sleep(300);
    }
    return out;
}

module.exports = {
    request, productJs, findProduct, listProducts, getCart, addToCart, changeLine, clearCart,
    showsAmount, toCents, internalLinks, statuses,
};
