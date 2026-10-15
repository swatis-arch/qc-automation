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
 *   page_works        the page opens and does its job: collection lists products, product has an
 *                     add-to-cart button, cart holds the added product, checkout opens
 *
 * Pages: home, collection, product, cart (default product added), checkout (stops before any order),
 * url (`path`, any page on the store, e.g. "/pages/bundle-builder").
 * `product` optionally names a product handle on the merchant's own store.
 * Ad-hoc stores (merchants/adhoc: no config or locators) use Shopify's standard storefront instead of
 * the page objects: /collections/all, the first in-stock product from /products.json (or `product`),
 * /cart/add.js, then /cart or /checkout.
 */

const HomePage     = require('../core/homepage/HomePage');
const PLPPage      = require('../core/plp/PLPPage');
const PDPPage      = require('../core/pdp/PDPPage');
const CartPage     = require('../core/cart/CartPage');
const CheckoutPage = require('../core/checkout/CheckoutPage');
const { dismissPopups } = require('./popups');
const { findProduct, addToCart } = require('./shopify-store');

const CHECK_TYPES = ['text_visible', 'text_absent', 'discount_percent', 'page_works'];
const PAGES       = ['home', 'collection', 'product', 'cart', 'checkout', 'url'];
const MAX_CHECKS  = 12;
const HANDLE_RE   = /^[a-z0-9][a-z0-9-]{0,99}$/;
// A path on the store itself: no scheme, host, "..", or characters a URL would need escaping for.
const PATH_RE     = /^\/(?!\/)[A-Za-z0-9\-._~/%]{0,200}(\?[A-Za-z0-9\-._~=&%+]{0,200})?$/;

// ── Validation (the gate) ─────────────────────────────────────────────────────

/**
 * @param {unknown} list  checks as returned by the AI (or sent back by the UI)
 * @returns {{title: string, type: string, page: string, text: string|null, percent: number|null, tolerance: number, product: string|null, path: string|null}[]}
 */
function validateChecks(list) {
    if (!Array.isArray(list) || !list.length) throw new Error('A ticket run needs at least one check.');
    if (list.length > MAX_CHECKS) throw new Error(`At most ${MAX_CHECKS} checks per ticket.`);
    return list.map((c, i) => {
        const n = `Check ${i + 1}`;
        if (!c || typeof c !== 'object') throw new Error(`${n} is not an object.`);
        if (!CHECK_TYPES.includes(c.type)) throw new Error(`${n}: unknown type "${c.type}". Use one of: ${CHECK_TYPES.join(', ')}`);
        if (!PAGES.includes(c.page)) throw new Error(`${n}: page "${c.page}" can't be checked here. Use one of: ${PAGES.join(', ')}`);
        const title = String(c.title || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 120);
        if (!title) throw new Error(`${n} has no title.`);

        const product = c.product ? String(c.product).trim().toLowerCase() : null;
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
        } else if (c.type !== 'page_works') {
            text = String(c.text || '').replace(/\s+/g, ' ').trim();
            if (!text || text.length > 80) throw new Error(`${n}: text must be 1-80 characters.`);
        }
        const tolerance = Math.min(Math.max(Number(c.tolerance) || 1, 0.1), 5);
        return { title, type: c.type, page: c.page, text, percent, tolerance, product, path };
    });
}

// ── Running ───────────────────────────────────────────────────────────────────

const CHECKOUT_URL = /checkout\.shopify\.com|\/checkouts\/|shop\.app/;
const only = locator => () => [locator];

/** Shopify checkout frames: extensions (e.g. a subscription app's order summary) render in iframes. */
const checkoutRoots = page => () => page.frames().filter(f => !f.isDetached()).map(f => f.locator('body'));

/**
 * Open `check.page` and return { roots, product }: roots gives the locators whose text the check reads
 * (a function, because checkout frames keep loading after the page does); product is the title of the
 * product added to the cart, when the store has no config (null otherwise).
 */
async function openPage(check, { page, merchant }) {
    if (merchant.adhoc) return openShopifyPage(check, { page, merchant });
    const handle = check.product || (merchant.products.default && merchant.products.default.handle);
    const opened = roots => ({ roots, product: null });
    switch (check.page) {
        case 'url': {
            await open(page, merchant, check.path);
            return opened(only(page.locator('body')));
        }
        case 'home': {
            await new HomePage(page, merchant).navigate();
            return opened(only(page.locator('body')));
        }
        case 'collection': {
            const plp = new PLPPage(page, merchant);
            await plp.navigateTo(merchant.pages.collection.replace(/^\/collections\//, ''));
            await plp.waitForProducts();
            return opened(only(page.locator('main').first()));
        }
        case 'product': {
            await new PDPPage(page, merchant).navigateTo(handle);
            return opened(only(page.locator('main').first()));
        }
        case 'cart':
        case 'checkout': {
            const pdp  = new PDPPage(page, merchant);
            const cart = new CartPage(page, merchant);
            await pdp.navigateTo(handle);
            await pdp.addToCart();
            await cart.waitForDrawerOpen();
            if (check.page === 'cart') return opened(only(page.locator('body')));
            // Stops on the checkout page: nothing is filled in and no order is placed. Shopify checkout's
            // "load" event can take well over 20 s, so wait for the DOM and then the form instead.
            await Promise.all([
                page.waitForURL(CHECKOUT_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 }),
                cart.checkoutButton.click(),
            ]);
            await new CheckoutPage(page).waitForCheckoutLoad();
            return opened(checkoutRoots(page));
        }
    }
    throw new Error(`Unknown page "${check.page}"`);
}

/** Go to a path on the store; fail on an HTTP error. */
async function open(page, merchant, path) {
    const res = await page.goto(path, { waitUntil: 'domcontentloaded' });
    if (res && res.status() >= 400) throw new Error(`${path} returned HTTP ${res.status()}`);
    await dismissPopups(page, merchant);
}

/** A product on a store with no config: `handle` (from the ticket's links), else the first one in stock. */
const shopifyProduct = (page, handle) => findProduct(page, { handle });

/** openPage() for a store with no config or locators, through Shopify's standard storefront URLs. */
async function openShopifyPage(check, { page, merchant }) {
    const body = only(page.locator('body'));
    switch (check.page) {
        case 'home':       await open(page, merchant, '/');                 return { roots: body, product: null };
        case 'url':        await open(page, merchant, check.path);          return { roots: body, product: null };
        case 'collection': await open(page, merchant, '/collections/all');  return { roots: body, product: null };
        case 'product': {
            const p = await shopifyProduct(page, check.product);
            await open(page, merchant, `/products/${p.handle}`);
            return { roots: body, product: p.title };
        }
        case 'cart':
        case 'checkout': {
            await open(page, merchant, '/');   // the store's cookies first, so the cart sticks to this browser
            const p = await shopifyProduct(page, check.product);
            await addToCart(page, p.variantId);
            if (check.page === 'cart') {
                await open(page, merchant, '/cart');
                return { roots: body, product: p.title };
            }
            // Stops on the checkout page: nothing is filled in and no order is placed.
            await page.goto('/checkout', { waitUntil: 'domcontentloaded' });
            await page.waitForURL(CHECKOUT_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
            await new CheckoutPage(page).waitForCheckoutLoad();
            return { roots: checkoutRoots(page), product: p.title };
        }
    }
    throw new Error(`Unknown page "${check.page}"`);
}

/** What "the page works" means for each page, beyond opening without an HTTP error. */
async function expectPageWorks(check, { page, expect, product, roots }) {
    switch (check.page) {
        case 'collection':
            await expect(page.locator('a[href*="/products/"]:visible').first(), 'the collection page lists products').toBeVisible({ timeout: 15_000 });
            return;
        case 'product':
            await expect(page.locator('form[action*="/cart/add"] button:visible, form[action*="/cart/add"] [type="submit"]:visible').first(),
                'the product page has an add-to-cart button').toBeVisible({ timeout: 15_000 });
            return;
        case 'cart':
            if (product) {
                await expect.poll(async () => normalise(await textOf(roots())).includes(normalise(product)),
                    { message: `the cart should hold ${product}`, timeout: 15_000 }).toBe(true);
            }
            return;
        default:
            // home, url: opened without an HTTP error; checkout: openPage waited for the checkout form.
            await expect(page.locator('body'), 'the page has content').not.toBeEmpty();
    }
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
    // Uncaught script errors are reported, not failed on: third-party apps throw on most live stores.
    const jsErrors = [];
    page.on('pageerror', e => jsErrors.push(String(e.message || e).split('\n')[0].slice(0, 160)));
    const { roots, product } = await openPage(check, { page, merchant });
    if (product) testInfo.annotations.push({ type: 'product', description: product });
    const where = check.page === 'url' ? `${check.path} page` : `${check.page}${check.product ? ` (${check.product})` : ''} page`;
    const timeout = check.page === 'checkout' ? 30_000 : 15_000;   // checkout's order summary renders late
    if (check.page !== 'checkout') await scrollThrough(page);

    if (check.type === 'page_works') {
        await expectPageWorks(check, { page, expect, product, roots });
        if (jsErrors.length) {
            testInfo.annotations.push({ type: 'js errors', description: `${jsErrors.length}: ${[...new Set(jsErrors)].slice(0, 3).join(' | ')}` });
        }
        return;
    }

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
