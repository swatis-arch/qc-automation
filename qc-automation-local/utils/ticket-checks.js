/**
 * utils/ticket-checks.js — ticket-specific checks for the QC Console.
 *
 * The AI turns a Jira ticket's acceptance criteria into a list of checks drawn from the fixed
 * menu below. The ticket never becomes code: validateChecks() is the gate (console/ai.js calls it
 * before a run is queued, tests/ticket-checks.spec.js calls it again before running), and
 * runCheck() only drives the existing page objects.
 *
 * Check types:
 *   text_visible      the page shows `text` (case-insensitive, whitespace-normalised)
 *   text_absent       the page does not show `text`
 *   discount_percent  a price on the page is `percent`% below the price shown next to it
 *                     (e.g. $59.00 → $34.81 is 41% off), within `tolerance` points (default 1)
 *
 * Pages: home, collection, product, cart (default product added), checkout (stops before any order),
 * url (`path`, any page on the store, e.g. "/pages/bundle-builder").
 * `product` optionally names a product handle on the merchant's own store.
 * Ad-hoc stores (merchants/adhoc, from a ticket link) only allow home and url.
 */

const HomePage     = require('../core/homepage/HomePage');
const PLPPage      = require('../core/plp/PLPPage');
const PDPPage      = require('../core/pdp/PDPPage');
const CartPage     = require('../core/cart/CartPage');
const CheckoutPage = require('../core/checkout/CheckoutPage');
const { dismissPopups } = require('./popups');

const CHECK_TYPES = ['text_visible', 'text_absent', 'discount_percent'];
const PAGES       = ['home', 'collection', 'product', 'cart', 'checkout', 'url'];
const ADHOC_PAGES = ['home', 'url'];
const MAX_CHECKS  = 12;
const HANDLE_RE   = /^[a-z0-9][a-z0-9-]{0,99}$/;
// A path on the store itself: no scheme, host, "..", or characters a URL would need escaping for.
const PATH_RE     = /^\/(?!\/)[A-Za-z0-9\-._~/%]{0,200}(\?[A-Za-z0-9\-._~=&%+]{0,200})?$/;

// ── Validation (the gate) ─────────────────────────────────────────────────────

/**
 * @param {unknown} list  checks as returned by the AI (or sent back by the UI)
 * @param {{adhoc?: boolean}} [opts]  adhoc: the store comes from a ticket link (home and url pages only)
 * @returns {{title: string, type: string, page: string, text: string|null, percent: number|null, tolerance: number, product: string|null, path: string|null}[]}
 */
function validateChecks(list, { adhoc = false } = {}) {
    if (!Array.isArray(list) || !list.length) throw new Error('A ticket run needs at least one check.');
    if (list.length > MAX_CHECKS) throw new Error(`At most ${MAX_CHECKS} checks per ticket.`);
    return list.map((c, i) => {
        const n = `Check ${i + 1}`;
        if (!c || typeof c !== 'object') throw new Error(`${n} is not an object.`);
        if (!CHECK_TYPES.includes(c.type)) throw new Error(`${n}: unknown type "${c.type}". Use one of: ${CHECK_TYPES.join(', ')}`);
        const pages = adhoc ? ADHOC_PAGES : PAGES;
        if (!pages.includes(c.page)) throw new Error(`${n}: page "${c.page}" can't be checked here. Use one of: ${pages.join(', ')}`);
        const title = String(c.title || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 120);
        if (!title) throw new Error(`${n} has no title.`);

        const product = !adhoc && c.product ? String(c.product).trim().toLowerCase() : null;
        if (product && !HANDLE_RE.test(product)) throw new Error(`${n}: "${product}" is not a product handle.`);

        let path = null;
        if (c.page === 'url') {
            path = String(c.path || '').trim();
            if (!PATH_RE.test(path) || path.includes('..')) throw new Error(`${n}: "${path}" is not a page path on the store (e.g. /pages/sale).`);
        }

        let text = null, percent = null;
        if (c.type === 'discount_percent') {
            percent = Number(c.percent);
            if (!(percent >= 1 && percent <= 99)) throw new Error(`${n}: percent must be between 1 and 99.`);
        } else {
            text = String(c.text || '').replace(/\s+/g, ' ').trim();
            if (!text || text.length > 80) throw new Error(`${n}: text must be 1-80 characters.`);
        }
        const tolerance = Math.min(Math.max(Number(c.tolerance) || 1, 0.1), 5);
        return { title, type: c.type, page: c.page, text, percent, tolerance, product, path };
    });
}

// ── Running ───────────────────────────────────────────────────────────────────

/**
 * Open `check.page` and return a function giving the locators whose text the check reads
 * (a function, because checkout frames keep loading after the page does).
 */
async function openPage(check, { page, merchant }) {
    const handle = check.product || (merchant.products.default && merchant.products.default.handle);
    const only = locator => () => [locator];
    switch (check.page) {
        case 'url': {
            const res = await page.goto(check.path, { waitUntil: 'domcontentloaded' });
            if (res && res.status() >= 400) throw new Error(`${check.path} returned HTTP ${res.status()}`);
            await dismissPopups(page, merchant);
            return only(page.locator('body'));
        }
        case 'home': {
            await new HomePage(page, merchant).navigate();
            return only(page.locator('body'));
        }
        case 'collection': {
            const plp = new PLPPage(page, merchant);
            await plp.navigateTo(merchant.pages.collection.replace(/^\/collections\//, ''));
            await plp.waitForProducts();
            return only(page.locator('main').first());
        }
        case 'product': {
            await new PDPPage(page, merchant).navigateTo(handle);
            return only(page.locator('main').first());
        }
        case 'cart':
        case 'checkout': {
            const pdp  = new PDPPage(page, merchant);
            const cart = new CartPage(page, merchant);
            await pdp.navigateTo(handle);
            await pdp.addToCart();
            await cart.waitForDrawerOpen();
            if (check.page === 'cart') return only(page.locator('body'));
            // Stops on the checkout page: nothing is filled in and no order is placed. Shopify checkout's
            // "load" event can take well over 20 s, so wait for the DOM and then the form instead.
            await Promise.all([
                page.waitForURL(/checkout\.shopify\.com|\/checkouts\/|shop\.app/, { waitUntil: 'domcontentloaded', timeout: 30_000 }),
                cart.checkoutButton.click(),
            ]);
            await new CheckoutPage(page).waitForCheckoutLoad();
            // Checkout extensions (e.g. the subscription app's order summary) render in iframes.
            return () => page.frames().filter(f => !f.isDetached()).map(f => f.locator('body'));
        }
    }
    throw new Error(`Unknown page "${check.page}"`);
}

const normalise = s => String(s).replace(/\s+/g, ' ').trim().toLowerCase();

/** Scroll down the page once so lazy sections (review apps, upsells) render, then back to the top. */
async function scrollThrough(page) {
    await page.evaluate(async () => {
        const step = window.innerHeight * 0.8;
        for (let y = 0, i = 0; y < document.body.scrollHeight && i < 25; y += step, i++) {
            window.scrollTo(0, y);
            await new Promise(r => setTimeout(r, 150));
        }
        window.scrollTo(0, 0);
    }).catch(() => { /* page navigated mid-scroll (e.g. checkout redirect): nothing to load */ });
}

/**
 * Price pairs shown together: for every small visible element holding two or more amounts,
 * each (higher, lower) pair and the % between them. Small elements keep unrelated prices apart.
 */
async function pricePairs(roots) {
    const all = [];
    for (const root of roots) all.push(...await pairsIn(root).catch(() => []));   // a frame may navigate away mid-read
    return all;
}

/** Visible text of all roots, joined. */
async function textOf(roots) {
    const parts = [];
    for (const root of roots) parts.push(await root.innerText({ timeout: 5_000 }).catch(() => ''));
    return parts.join('\n');
}

async function pairsIn(root) {
    return root.evaluate(el => {
        const MONEY = /[$£€]\s?(\d[\d,]*(?:\.\d{1,2})?)/g;
        const pairs = [];
        const seen  = new Set();
        for (const node of [el, ...el.querySelectorAll('*')]) {
            if (node.checkVisibility ? !node.checkVisibility() : !node.getClientRects().length) continue;   // hidden
            const text = node.innerText || '';
            if (text.length > 200) continue;
            const amounts = [...text.matchAll(MONEY)].map(m => parseFloat(m[1].replace(/,/g, ''))).filter(a => a > 0);
            if (amounts.length < 2) continue;
            for (const a of amounts) for (const b of amounts) {
                if (b >= a) continue;
                const key = `${a}>${b}`;
                if (seen.has(key)) continue;
                seen.add(key);
                pairs.push({ from: a, to: b, percent: Math.round((1 - b / a) * 1000) / 10 });
            }
        }
        return pairs;
    });
}

/**
 * Run one validated check. Throws (fails the test) with a message QA can read.
 * @param {object} check  one entry from validateChecks()
 * @param {{page, merchant, expect, testInfo}} ctx
 */
async function runCheck(check, { page, merchant, expect, testInfo }) {
    const roots = await openPage(check, { page, merchant });
    const where = check.page === 'url' ? `${check.path} page` : `${check.page}${check.product ? ` (${check.product})` : ''} page`;
    const timeout = check.page === 'checkout' ? 30_000 : 15_000;   // checkout's order summary renders late
    if (check.page !== 'checkout') await scrollThrough(page);

    if (check.type === 'text_visible' || check.type === 'text_absent') {
        const want = normalise(check.text);
        const shows = async () => normalise(await textOf(roots())).includes(want);
        if (check.type === 'text_visible') {
            await expect.poll(shows, { message: `"${check.text}" should be shown on the ${where}`, timeout }).toBe(true);
        } else {
            await page.waitForTimeout(2_000);   // let late banners render before asserting absence
            expect(await shows(), `"${check.text}" should not be shown on the ${where}`).toBe(false);
        }
        return;
    }

    // discount_percent
    let pairs = [];
    await expect.poll(async () => {
        pairs = await pricePairs(roots());
        return pairs.some(p => Math.abs(p.percent - check.percent) <= check.tolerance);
    }, {
        message: `a price ${check.percent}% (±${check.tolerance}) below the price next to it should be shown on the ${where}`,
        timeout,
    }).toBe(true).catch(e => {
        const seen = pairs.slice(0, 8).map(p => `$${p.from} → $${p.to} (${p.percent}%)`).join(', ') || 'no prices shown side by side';
        e.message += `\nPrice pairs found: ${seen}`;
        throw e;
    });
    const hit = pairs.find(p => Math.abs(p.percent - check.percent) <= check.tolerance);
    testInfo.annotations.push({ type: 'price', description: `$${hit.from} → $${hit.to} (${hit.percent}% off)` });
}

module.exports = { validateChecks, runCheck, CHECK_TYPES, PAGES, MAX_CHECKS };
