/**
 * tests/store-regression.spec.js — regression for a Shopify store the suite isn't set up for.
 *
 * Run by the QC Console ("regression on rydertoys.com", or a regression ticket for such a store) on the
 * adhoc merchant (merchants/adhoc, QC_ADHOC_BASE_URL). With no config or verified locators, it checks
 * through Shopify's standard URLs and JSON (utils/shopify-store.js) and markup common to Shopify themes.
 * A failure here is a lead for QA, not a verdict: the store's theme may do things differently.
 *
 * Never submits a form and never places an order: checkout stops on the checkout page.
 * Skipped on configured merchants (they have their own suites in tests/generated/).
 */

const { test, expect, setupPage } = require('../fixtures/base');
const { dismissPopups } = require('../utils/popups');
const CheckoutPage = require('../core/checkout/CheckoutPage');
const shop = require('../utils/shopify-store');

const CHECKOUT_URL = /checkout\.shopify\.com|\/checkouts\/|shop\.app/;
const MAIN   = 'main, #MainContent, [role="main"]';
const HEADER = 'header, [role="banner"], #shopify-section-header, .shopify-section-group-header-group';
const FOOTER = 'footer, [role="contentinfo"], #shopify-section-footer, .shopify-section-group-footer-group';
const PRICE  = /[$£€₹¥]\s?\d|\d[\d.,]*\s?(USD|CAD|EUR|GBP|AUD|INR)\b/;

/** Go to a path; fail on an HTTP error. Returns the response status. */
async function open(page, merchant, path) {
    const res = await page.goto(path, { waitUntil: 'domcontentloaded' });
    const status = res ? res.status() : 0;
    expect(status, `${path} should open (HTTP status)`).toBeLessThan(400);
    await dismissPopups(page, merchant);
    return status;
}

const main = page => page.locator(MAIN).first();
const normalise = s => String(s).replace(/\s+/g, ' ').trim().toLowerCase();
const textOf = async locator => normalise(await locator.innerText({ timeout: 10_000 }).catch(() => ''));

/** Scroll down once so lazy images and sections load, then back to the top. */
async function scrollThrough(page) {
    await page.evaluate(async () => {
        const step = window.innerHeight * 0.8;
        for (let y = 0, i = 0; y < document.body.scrollHeight && i < 30; y += step, i++) {
            window.scrollTo(0, y);
            await new Promise(r => setTimeout(r, 120));
        }
        window.scrollTo(0, 0);
    }).catch(() => {});
}

/** Handles of the products a page's main content links to, in page order. */
async function productHandlesIn(page) {
    const hrefs = await main(page).locator('a[href*="/products/"]').evaluateAll(els => els.map(a => a.getAttribute('href') || ''));
    return [...new Set(hrefs.map(h => (h.match(/\/products\/([a-z0-9][a-z0-9-]*)/i) || [])[1]).filter(Boolean).map(h => h.toLowerCase()))];
}

const addToCartButton = page => page.locator(
    'form[action*="/cart/add"] button[type="submit"]:visible, form[action*="/cart/add"] [type="submit"]:visible, ' +
    'form[action*="/cart/add"] button[name="add"]:visible, button[name="add"]:visible').first();

test.describe('Store regression (store not set up in the suite)', () => {
    test.beforeEach(async ({ page, merchant }) => {
        test.skip(!merchant.adhoc, 'Runs only on a store from the QC Console (merchants/adhoc)');
        await setupPage(page);
    });

    // ── Homepage & layout ────────────────────────────────────────────────────
    test.describe('Homepage', () => {
        test('HP01 — Homepage opens with a page title and meta description', async ({ page, merchant }) => {
            await open(page, merchant, '/');
            expect((await page.title()).trim(), 'page title').not.toBe('');
            const description = await page.locator('meta[name="description"]').getAttribute('content').catch(() => null);
            expect((description || '').trim(), 'meta description').not.toBe('');
        });

        test('HP02 — Header shows a logo that links to the homepage', async ({ page, merchant, baseURL }) => {
            await open(page, merchant, '/');
            const origin = new URL(baseURL).origin;
            const home = page.locator(HEADER).first()
                .locator(`a[href="/"], a[href="${origin}"], a[href="${origin}/"], a[href^="/?"]`).filter({ visible: true });
            await expect(home.first(), 'a visible link to the homepage in the header').toBeVisible({ timeout: 15_000 });
        });

        test('HP03 — Header navigation links open', async ({ page, merchant, baseURL }) => {
            await open(page, merchant, '/');
            const links = await shop.internalLinks(page.locator(HEADER).first().locator('a[href]'), baseURL, 30);
            expect(links.length, 'links in the header').toBeGreaterThan(0);
            const broken = (await shop.statuses(page, links)).filter(r => r.status === 0 || r.status >= 400);
            test.info().annotations.push({ type: 'links checked', description: String(links.length) });
            expect(broken.map(b => `${b.path} → ${b.status || 'no response'}`), 'broken header links').toEqual([]);
        });

        test('HP04 — Footer links open', async ({ page, merchant, baseURL }) => {
            await open(page, merchant, '/');
            const links = await shop.internalLinks(page.locator(FOOTER).last().locator('a[href]'), baseURL, 40);
            expect(links.length, 'links in the footer').toBeGreaterThan(0);
            const broken = (await shop.statuses(page, links)).filter(r => r.status === 0 || r.status >= 400);
            test.info().annotations.push({ type: 'links checked', description: String(links.length) });
            expect(broken.map(b => `${b.path} → ${b.status || 'no response'}`), 'broken footer links').toEqual([]);
        });

        test('HP05 — Homepage images load', async ({ page, merchant }) => {
            await open(page, merchant, '/');
            await scrollThrough(page);
            await page.waitForLoadState('load', { timeout: 30_000 }).catch(() => {});
            const broken = await page.evaluate(() => [...document.images]
                .filter(img => img.getClientRects().length && img.currentSrc && img.complete && img.naturalWidth === 0)
                .map(img => img.currentSrc.split('?')[0]).slice(0, 10));
            expect(broken, 'images that failed to load').toEqual([]);
        });

        test('HP06 — No server errors while the homepage loads', async ({ page, merchant, baseURL }) => {
            const host = new URL(baseURL).hostname.replace(/^www\./, '');
            const errors = [], thirdParty = [];
            page.on('response', r => {
                if (r.status() < 500) return;
                const h = new URL(r.url()).hostname;
                (h.endsWith(host) || h.endsWith('shopify.com') || h.endsWith('shopifycdn.com') ? errors : thirdParty).push(`${r.status()} ${r.url().split('?')[0]}`);
            });
            const jsErrors = [];
            page.on('pageerror', e => jsErrors.push(String(e.message || e).split('\n')[0].slice(0, 150)));
            await open(page, merchant, '/');
            await scrollThrough(page);
            await page.waitForLoadState('load', { timeout: 30_000 }).catch(() => {});
            if (thirdParty.length) test.info().annotations.push({ type: 'third-party 5xx', description: thirdParty.slice(0, 5).join(' | ') });
            if (jsErrors.length) test.info().annotations.push({ type: 'js errors', description: `${jsErrors.length}: ${[...new Set(jsErrors)].slice(0, 3).join(' | ')}` });
            expect(errors, 'server errors (5xx) from the store').toEqual([]);
        });
    });

    // ── Search ───────────────────────────────────────────────────────────────
    test.describe('Search', () => {
        test('SR01 — Searching a product name finds the product', async ({ page, merchant }) => {
            const p = await shop.findProduct(page);
            const words = p.title.replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(w => w.length > 2).slice(0, 4).join(' ');
            await open(page, merchant, `/search?q=${encodeURIComponent(words)}&type=product`);
            await expect.poll(() => productHandlesIn(page), { message: `search for "${words}" should list ${p.handle}`, timeout: 15_000 })
                .toContain(p.handle);
        });

        test('SR02 — A search with no matches shows an empty result, not an error', async ({ page, merchant }) => {
            await open(page, merchant, '/search?q=qcnomatchzzx&type=product');
            await expect(main(page)).toBeVisible();
            expect(await productHandlesIn(page), 'products listed for a nonsense search').toEqual([]);
        });
    });

    // ── Collections ──────────────────────────────────────────────────────────
    test.describe('Collections', () => {
        test('CL01 — All-products collection lists products with prices', async ({ page, merchant }) => {
            await open(page, merchant, '/collections/all');
            await expect.poll(async () => (await productHandlesIn(page)).length, { message: 'products listed', timeout: 15_000 }).toBeGreaterThan(0);
            expect(await textOf(main(page)), 'a price on the collection page').toMatch(PRICE);
        });

        test('CL02 — Collections open and list products', async ({ page }) => {
            const res = await shop.request(page, 'get', '/collections.json?limit=50');
            const collections = res.ok() ? ((await res.json()).collections || []) : [];
            test.skip(!collections.length, 'The store does not publish /collections.json');
            const withProducts = collections.filter(c => c.products_count !== 0).slice(0, 10);
            const results = await shop.statuses(page, withProducts.map(c => `/collections/${c.handle}`));
            const broken = results.filter(r => r.status === 0 || r.status >= 400);
            test.info().annotations.push({ type: 'collections checked', description: withProducts.map(c => c.handle).join(', ') });
            expect(broken.map(b => `${b.path} → ${b.status || 'no response'}`), 'collections that fail to open').toEqual([]);
        });

        test('CL03 — Sorting by price changes the product order', async ({ page, merchant }) => {
            await open(page, merchant, '/collections/all?sort_by=price-ascending');
            const asc = await productHandlesIn(page);
            test.skip(asc.length < 2, 'Fewer than 2 products in /collections/all');
            await open(page, merchant, '/collections/all?sort_by=price-descending');
            const desc = await productHandlesIn(page);
            expect(desc[0], 'first product when sorted high-to-low vs low-to-high').not.toBe(asc[0]);
        });

        test('CL04 — The next page of a collection shows other products', async ({ page, merchant }) => {
            await open(page, merchant, '/collections/all');
            const next = page.locator('a[href*="page=2"]').first();
            test.skip(!(await next.count()), 'The collection fits on one page');
            const first = await productHandlesIn(page);
            await open(page, merchant, '/collections/all?page=2');
            const second = await productHandlesIn(page);
            expect(second.length, 'products on page 2').toBeGreaterThan(0);
            expect(second.filter(h => !first.includes(h)).length, 'products on page 2 not on page 1').toBeGreaterThan(0);
        });
    });

    // ── Product page ─────────────────────────────────────────────────────────
    test.describe('Product page', () => {
        test('PD01 — Product page shows the product title and price', async ({ page, merchant }) => {
            const p = await shop.findProduct(page);
            const variant = p.product.variants.find(v => v.id === p.variantId);
            await open(page, merchant, `/products/${p.handle}?variant=${p.variantId}`);
            await expect(page.locator('h1').first(), 'product title').toContainText(p.title.slice(0, 40), { ignoreCase: true, timeout: 15_000 });
            await expect.poll(async () => shop.showsAmount(await main(page).innerText(), shop.toCents(variant.price)),
                { message: `price ${shop.toCents(variant.price) / 100} on the page`, timeout: 15_000 }).toBe(true);
            test.info().annotations.push({ type: 'product', description: `${p.title} (/products/${p.handle})` });
        });

        test('PD02 — Product images load', async ({ page, merchant }) => {
            const p = await shop.findProduct(page);
            await open(page, merchant, `/products/${p.handle}`);
            await page.waitForLoadState('load', { timeout: 30_000 }).catch(() => {});
            const img = main(page).locator('img').filter({ visible: true }).first();
            await expect(img, 'a product image').toBeVisible({ timeout: 15_000 });
            await expect.poll(() => img.evaluate(el => el.complete && el.naturalWidth > 0), { message: 'the first product image loads', timeout: 15_000 }).toBe(true);
        });

        test('PD03 — Choosing a variant shows that variant and its price', async ({ page, merchant }) => {
            let p;
            try {
                p = await shop.findProduct(page, { accept: prod => (prod.variants || []).filter(v => v.available).length >= 2 });
            } catch { test.skip(true, 'No product with two in-stock variants'); }
            const avail = p.product.variants.filter(v => v.available);
            const other = avail.find(v => shop.toCents(v.price) !== shop.toCents(avail[0].price)) || avail[1];
            await open(page, merchant, `/products/${p.handle}?variant=${other.id}`);
            const idInput = page.locator('form[action*="/cart/add"] [name="id"]').first();
            await expect.poll(() => idInput.inputValue().catch(() => idInput.getAttribute('value')),
                { message: `variant ${other.title} selected from the URL`, timeout: 15_000 }).toBe(String(other.id));
            await expect.poll(async () => shop.showsAmount(await main(page).innerText(), shop.toCents(other.price)),
                { message: `price of ${other.title} shown`, timeout: 15_000 }).toBe(true);
            test.info().annotations.push({ type: 'product', description: `${p.title}: ${other.title}` });
        });

        test('PD04 — A sold-out variant cannot be added to the cart', async ({ page, merchant }) => {
            const products = await shop.listProducts(page);
            const prod = products.find(x => (x.variants || []).some(v => !v.available));
            test.skip(!prod, 'No sold-out variant in /products.json');
            const soldOut = prod.variants.find(v => !v.available);
            await open(page, merchant, `/products/${prod.handle}?variant=${soldOut.id}`);
            // The add-to-cart button (not e.g. a "notify me" button): hidden, disabled or relabelled sold out all count.
            const addable = page.locator('form[action*="/cart/add"] [type="submit"], button[name="add"]')
                .filter({ visible: true }).filter({ hasText: /add to (cart|bag|basket)|buy now/i });
            await expect.poll(async () => {
                for (const b of await addable.all()) if (await b.isEnabled().catch(() => false)) return false;
                return true;
            }, { message: `no enabled "add to cart" button for sold-out ${prod.title} (${soldOut.title})`, timeout: 15_000 }).toBe(true);
            test.info().annotations.push({ type: 'product', description: `${prod.title}: ${soldOut.title}` });
        });

        test('PD05 — The add-to-cart button adds the product to the cart', async ({ page, merchant }) => {
            const p = await shop.findProduct(page);
            await open(page, merchant, '/');
            await shop.clearCart(page);
            await open(page, merchant, `/products/${p.handle}?variant=${p.variantId}`);
            const button = addToCartButton(page);
            await expect(button, 'add-to-cart button').toBeEnabled({ timeout: 15_000 });
            await button.click();
            await expect.poll(async () => (await shop.getCart(page)).items.map(i => i.handle),
                { message: `${p.title} in the cart after clicking add to cart`, timeout: 15_000 }).toContain(p.handle);
            test.info().annotations.push({ type: 'product', description: p.title });
        });

        test('PD06 — Product page has product data for search engines', async ({ page, merchant }) => {
            const p = await shop.findProduct(page);
            await open(page, merchant, `/products/${p.handle}`);
            const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
            expect(blocks.some(b => /"@type"\s*:\s*"Product"/.test(b)), 'JSON-LD with @type Product').toBe(true);
        });
    });

    // ── Cart ─────────────────────────────────────────────────────────────────
    test.describe('Cart', () => {
        /** A fresh cart holding one in-stock product. */
        async function cartWithProduct(page, merchant) {
            await open(page, merchant, '/');
            await shop.clearCart(page);
            const p = await shop.findProduct(page);
            await shop.addToCart(page, p.variantId);
            test.info().annotations.push({ type: 'product', description: p.title });
            return p;
        }

        test('CT01 — Cart page lists the added product with its price', async ({ page, merchant }) => {
            const p = await cartWithProduct(page, merchant);
            const cart = await shop.getCart(page);
            await open(page, merchant, '/cart');
            await expect.poll(() => textOf(main(page)), { message: `${p.title} on the cart page`, timeout: 15_000 }).toContain(normalise(p.title).slice(0, 40));
            expect(shop.showsAmount(await main(page).innerText(), cart.total_price), `cart total ${cart.total_price / 100} on the cart page`).toBe(true);
        });

        test('CT02 — Changing the quantity updates the cart total', async ({ page, merchant }) => {
            await cartWithProduct(page, merchant);
            const cart = await shop.changeLine(page, 1, 2);
            expect(cart.item_count, 'items after setting quantity 2').toBe(2);
            await open(page, merchant, '/cart');
            await expect.poll(async () => shop.showsAmount(await main(page).innerText(), cart.total_price),
                { message: `new total ${cart.total_price / 100} on the cart page`, timeout: 15_000 }).toBe(true);
        });

        test('CT03 — Removing the product from the cart page empties the cart', async ({ page, merchant }) => {
            await cartWithProduct(page, merchant);
            await open(page, merchant, '/cart');
            // Themes use links, buttons or custom elements (Dawn's cart-remove-button, Minimog's m-cart-remove-button).
            const remove = main(page).locator(
                'a[href*="/cart/change"][href*="quantity=0"], cart-remove-button, m-cart-remove-button, ' +
                '[aria-label*="remove" i], [aria-label*="delete" i], [data-cart-remove], [class*="remove" i]'
            ).or(main(page).getByRole('button', { name: /^(remove|delete)$/i }))
                .or(main(page).getByText(/^\s*(remove|delete)\s*$/i))
                .filter({ visible: true }).first();
            await expect(remove, 'a remove control on the cart page').toBeVisible({ timeout: 15_000 });
            await remove.click();
            await expect.poll(async () => (await shop.getCart(page)).item_count, { message: 'items in the cart after removing', timeout: 15_000 }).toBe(0);
        });

        test('CT04 — An empty cart says so and links back to shopping', async ({ page, merchant }) => {
            await open(page, merchant, '/');
            await shop.clearCart(page);
            await open(page, merchant, '/cart');
            await expect.poll(() => textOf(main(page)), { message: 'empty-cart message', timeout: 15_000 }).toMatch(/empty|no items|nothing in|0 items/);
            const back = main(page).locator('a[href*="/collections"], a[href="/"], a[href*="/products"]').filter({ visible: true });
            expect(await back.count(), 'a link back to shopping').toBeGreaterThan(0);
        });
    });

    // ── Checkout ─────────────────────────────────────────────────────────────
    test.describe('Checkout', () => {
        test('CO01 — Checkout opens with the product in the order summary (no order placed)', async ({ page, merchant }) => {
            test.setTimeout(150_000);
            await open(page, merchant, '/');
            await shop.clearCart(page);
            const p = await shop.findProduct(page);
            await shop.addToCart(page, p.variantId);
            const { total_price: total } = await shop.getCart(page);
            // Stops on the checkout page: nothing is filled in and no order is placed.
            await page.goto('/checkout', { waitUntil: 'domcontentloaded' });
            await page.waitForURL(CHECKOUT_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
            await new CheckoutPage(page).waitForCheckoutLoad();
            const summary = async () => {
                const parts = [];
                for (const f of page.frames().filter(x => !x.isDetached())) parts.push(await f.locator('body').innerText({ timeout: 5_000 }).catch(() => ''));
                return normalise(parts.join('\n'));
            };
            // On mobile Shopify collapses the order summary to its total, so the product's name or the cart total counts.
            await expect.poll(async () => {
                const text = await summary();
                return text.includes(normalise(p.title).slice(0, 30)) || shop.showsAmount(text, total);
            }, { message: `${p.title} or the cart total ${total / 100} on the checkout page`, timeout: 30_000 }).toBe(true);
            test.info().annotations.push({ type: 'product', description: p.title });
        });
    });

    // ── Pages ────────────────────────────────────────────────────────────────
    test.describe('Pages', () => {
        test('PG01 — Policy pages open', async ({ page }) => {
            const required = ['/policies/privacy-policy', '/policies/refund-policy', '/policies/terms-of-service'];
            const results = await shop.statuses(page, [...required, '/policies/shipping-policy']);
            const shipping = results.pop();
            if (shipping.status >= 400) test.info().annotations.push({ type: 'note', description: `No shipping policy (${shipping.status})` });
            expect(results.filter(r => r.status === 0 || r.status >= 400).map(r => `${r.path} → ${r.status}`), 'policy pages that fail').toEqual([]);
        });

        test('PG02 — Contact page opens with a contact form (not submitted)', async ({ page, merchant }) => {
            const res = await shop.request(page, 'get', '/pages/contact');
            test.skip(res.status() === 404, 'No /pages/contact on this store');
            await open(page, merchant, '/pages/contact');
            const form = page.locator('form[action*="/contact"], form#ContactForm, form:has(textarea)').filter({ visible: true }).first();
            await expect(form, 'a visible contact form').toBeVisible({ timeout: 15_000 });
        });

        test('PG03 — A missing page shows the store\'s 404 page', async ({ page, merchant }) => {
            const res = await page.goto('/products/qc-console-no-such-product', { waitUntil: 'domcontentloaded' });
            expect(res && res.status(), 'HTTP status for a missing product').toBe(404);
            await dismissPopups(page, merchant);
            await expect(page.locator(HEADER).first(), 'the 404 page keeps the store header').toBeVisible();
        });

        test('PG04 — Customer login page opens (not signed in)', async ({ page }) => {
            const res = await page.goto('/account/login', { waitUntil: 'domcontentloaded' });
            expect(res && res.status(), '/account/login status').toBeLessThan(400);
            // Classic accounts show the form on the store; new customer accounts redirect to shopify.com.
            await expect(page.locator('input[type="email"], input[name="customer[email]"], input#CustomerEmail').filter({ visible: true }).first(),
                'an email field').toBeVisible({ timeout: 20_000 });
        });
    });

    // ── Technical ────────────────────────────────────────────────────────────
    test.describe('Technical', () => {
        test('TE01 — robots.txt and sitemap.xml are served', async ({ page }) => {
            const results = await shop.statuses(page, ['/robots.txt', '/sitemap.xml']);
            expect(results.filter(r => r.status !== 200).map(r => `${r.path} → ${r.status}`), 'robots.txt / sitemap.xml').toEqual([]);
        });

        test('TE02 — Homepage content arrives within 10 seconds', async ({ page }) => {
            const start = Date.now();
            await page.goto('/', { waitUntil: 'domcontentloaded' });
            const ms = Date.now() - start;
            test.info().annotations.push({ type: 'load time', description: `${(ms / 1000).toFixed(1)} s to DOMContentLoaded` });
            expect(ms, 'ms until the homepage DOM is ready').toBeLessThan(10_000);
        });

        test('TE03 — Product and collection pages have a main heading (h1)', async ({ page, merchant }) => {
            // Visually hidden h1s count (search engines read them); several h1s are noted, not failed.
            const p = await shop.findProduct(page);
            const counts = {};
            for (const path of [`/products/${p.handle}`, '/collections/all']) {
                await open(page, merchant, path);
                counts[path] = await page.locator('h1').count();
            }
            const many = Object.entries(counts).filter(([, n]) => n > 1).map(([path, n]) => `${path}: ${n} h1`);
            if (many.length) test.info().annotations.push({ type: 'note', description: `More than one h1: ${many.join(', ')}` });
            expect(Object.entries(counts).filter(([, n]) => n === 0).map(([path]) => path), 'pages with no h1').toEqual([]);
        });

        test('TE04 — Pages fit the screen width (no sideways scrolling)', async ({ page, merchant }) => {
            test.setTimeout(150_000);   // four full page loads
            const p = await shop.findProduct(page);
            const wide = [];
            for (const path of ['/', '/collections/all', `/products/${p.handle}`, '/cart']) {
                await open(page, merchant, path);
                await page.waitForLoadState('load', { timeout: 20_000 }).catch(() => {});
                const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
                if (over > 2) wide.push(`${path}: ${over}px wider than the screen`);
            }
            expect(wide, 'pages wider than the screen').toEqual([]);
        });
    });

    // ── Mobile ───────────────────────────────────────────────────────────────
    test.describe('Mobile', () => {
        test('MB01 — The mobile menu opens and shows navigation links', async ({ page, merchant }) => {
            test.skip(!test.info().project.name.includes('mobile'), 'Mobile only');
            await open(page, merchant, '/');
            const toggle = page.locator(HEADER).first().locator(
                'summary[aria-label*="menu" i], button[aria-label*="menu" i], [aria-controls*="menu" i], [aria-controls*="drawer" i], ' +
                'summary:has(.icon-hamburger), button:has(.icon-hamburger), .header__icon--menu, [data-action="toggle-menu"], ' +
                '[class*="menu-button" i], [class*="menu-toggle" i], [class*="nav-toggle" i], [class*="hamburger" i]'
            ).filter({ visible: true }).first();
            await expect(toggle, 'a menu button in the header').toBeVisible({ timeout: 15_000 });
            const named = await toggle.evaluate(el => {
                const control = el.closest('button, summary, a, [role="button"]') || el;
                return /^(BUTTON|SUMMARY|A)$/.test(control.tagName) || control.getAttribute('role') === 'button'
                    ? Boolean((control.getAttribute('aria-label') || control.innerText || '').trim()) : false;
            });
            if (!named) test.info().annotations.push({ type: 'accessibility', description: 'The menu toggle is not a labelled button: screen readers and keyboards can\'t use it' });
            const visibleLinks = () => page.locator('a[href*="/collections"], a[href*="/pages/"], a[href*="/products/"]').filter({ visible: true }).count();
            const before = await visibleLinks();
            await toggle.click();
            await expect.poll(visibleLinks, { message: 'navigation links visible after opening the menu', timeout: 10_000 }).toBeGreaterThan(before);
        });
    });
});
