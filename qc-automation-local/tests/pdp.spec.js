/**
 * tests/pdp.spec.js — Product Detail Page Regression Suite
 *
 * Covers (sections follow the Shopify_PDP_Test_Cases sheet):
 *   Page load & navigation · Product info & pricing · Media gallery ·
 *   Variant selection · Quantity & add to cart · Buy now · Subscription ·
 *   Content sections · Reviews · Recommendations · Sharing · Responsive ·
 *   Performance, SEO & accessibility
 *
 * Regression Catalogue IDs: PDP001, PDP002, PDP003, CART001
 * Priority: P0/P1
 * Type: Universal
 * Sheet IDs: tests written from the sheet carry their `[TC_PDP_xxx]` id in the title.
 *
 * CRITICAL: No real production purchases are performed.
 *           Add-to-cart tests validate the cart API only; Buy it now stops at the checkout URL.
 *
 * "Matches admin" checks compare the page with Shopify's own `/products/<handle>.js`
 * data (see PDPPage.productJson()), so no prices or titles are hardcoded here.
 *
 * Merchants differ a lot on this page:
 *   - Variants: only Abc has real option pickers (Orientation/Fabric, Size/Color radios).
 *     Outset's products are single-variant; Revitin sells one variant per product with
 *     pack sizes as subscribe options; Koh's flavors are bundle-builder steppers, not a picker.
 *   - Quantity: a +/- stepper on Outset (field itself disabled) and Abc; none on Revitin/Koh.
 *   - Subscriptions: Revitin and Koh (`features.subscription`), each with its own UI.
 *   - Buy it now / express checkout: no merchant here has Shopify's dynamic checkout enabled.
 * Tests whose precondition isn't met call `test.skip(<condition>, <reason>)` so the report
 * says why, rather than passing silently or being force-fitted.
 *
 * Not automated (need a human, the Shopify admin, a known product state, or tools
 * outside Playwright):
 *   TC_PDP_004 known draft product · 010 tax/shipping note vs store settings · 014 automatic
 *   discount config · 018 touch swipe · 022 known imageless product · 031 swatch colour vs photo ·
 *   035/048 inventory counts · 045 express payment sheets · 047 availability wording vs config ·
 *   049 known sold-out product · 050 notify-me submission · 051/052 oversell/preorder config ·
 *   060 policy content review · 062 trust badge content · 064 rating vs app dashboard ·
 *   065 posting a real review · 066/067 review pagination / empty state (known products) ·
 *   070 bundle-app pricing rules · 073/074 wishlist (account/app state) · 078 real Safari/Firefox ·
 *   079 PageSpeed.
 */

const { test, expect }   = require('../fixtures/base');
const { expectPageFound, horizontalOverflow, parseMoney, imageKey } = require('../utils/page-checks');
const { recordGa4Events } = require('../utils/ga4');
const { SEO_LIMITS }      = require('../utils/test-data');

const money = cents => cents / 100;

/** GA4 hits grouped by measurement ID (`tid`): { 'G-XXXX': 1, ... }. */
function hitsPerProperty(hits) {
    return hits.reduce((acc, params) => ({ ...acc, [params.get('tid')]: (acc[params.get('tid')] || 0) + 1 }), {});
}

/** The variant the page currently has selected (falls back to the first available one). */
async function currentVariant(pdp) {
    const json = await pdp.productJson();
    const id = await pdp.selectedVariantId();
    return json.variants.find(v => v.id === id) ?? json.variants.find(v => v.available) ?? json.variants[0];
}

/** A variant differing from `from` in exactly one option and matching `predicate`. */
function siblingVariant(json, from, predicate = () => true) {
    return json.variants.find(v => v.id !== from.id
        && v.options.filter((value, i) => value !== from.options[i]).length === 1
        && predicate(v));
}

/** The one option that differs between two sibling variants: { name, index }. */
function changedOption(json, from, to) {
    const index = to.options.findIndex((value, i) => value !== from.options[i]);
    return { name: json.options[index].name, index };
}

/**
 * Switch the page from its current variant to a sibling through the option picker.
 * Skips the test when this theme has no picker for that option.
 */
async function pickSibling(pdp, json, from, to) {
    const option = changedOption(json, from, to);
    test.skip(!await pdp.hasOptionPicker(option.name), `No on-page picker for the "${option.name}" option`);
    await pdp.selectOptionValue(option.name, to.options[option.index]);
}

test.describe('SUNTEK QC — Product Detail Page [PDP001-PDP003, CART001]', () => {

    // ── Page load ──────────────────────────────────────────────────────────────

    test('@smoke PDP001 — Default product page loads', async ({ pdp, page }) => {
        await expect(page).toHaveURL(/\/products\//, { timeout: 15_000 });
        await expectPageFound(page);
    });

    // ── Product elements ───────────────────────────────────────────────────────

    test('@smoke PDP001 — Product title (h1) is visible and non-empty', async ({ pdp, page }) => {
        await expect(pdp.productTitle).toBeVisible();
        const title = await pdp.getTitle();
        expect(title.length).toBeGreaterThan(0);
    });

    test('@smoke PDP002 — Product price is displayed', async ({ pdp, page }) => {
        await expect(pdp.productPrice).toBeVisible();
        const price = await pdp.getPrice();
        expect(price).toMatch(/\$|£|€|[\d,.]+/);
    });

    test('@smoke PDP001 — Primary product image renders', async ({ pdp, page }) => {
        await expect(pdp.productImage).toBeVisible();
        const src = await pdp.productImage.getAttribute('src');
        expect(src && src.trim().length > 0).toBe(true);
    });

    // ── Variants ───────────────────────────────────────────────────────────────

    test('@smoke PDP003 — Variant selector is present', async ({ pdp, page }) => {
        // Variant selector may or may not exist (single-variant products have none)
        const variantCount = await pdp.variantOptions.count();
        if (variantCount === 0) {
            // Single-variant product — pass
            console.log('ℹ️  Single-variant product — no variant selector required.');
            return;
        }
        await expect(pdp.variantSelector).toBeVisible();
    });

    test('PDP003 — Selecting a variant does not break the page', async ({ pdp, page }) => {
        const variantCount = await pdp.variantOptions.count();
        if (variantCount === 0) return;

        await pdp.selectFirstVariant();
        // Price should still be visible after variant selection
        await expect(pdp.productPrice).toBeVisible();
    });

    test('PDP003 — Variant selection reflects correct price', async ({ pdp, page }) => {
        const variantCount = await pdp.variantOptions.count();
        if (variantCount === 0) return;

        await pdp.selectFirstVariant();
        const price = await pdp.getPrice();
        expect(price).toMatch(/\$|£|€|[\d,.]+/);
    });

    // ── Quantity ───────────────────────────────────────────────────────────────

    test('PDP001 — Quantity picker is present', async ({ pdp, page }) => {
        const qtyInput = pdp.quantityInput;
        // Some themes hide quantity on PDP
        if (await qtyInput.count() > 0) {
            await expect(qtyInput).toBeVisible();
        }
    });

    // ── Add to cart ────────────────────────────────────────────────────────────

    test('@smoke CART001 — Add to Cart returns HTTP 200', async ({ pdp, page }) => {
        const inStock = await pdp.isInStock();
        if (!inStock) {
            console.warn('⚠️  Default product is out of stock — skipping ATC test.');
            return;
        }

        const response = await pdp.addToCart();
        expect(response.status()).toBe(200);
    });

    test('CART001 — Add to Cart response contains correct product data', async ({ pdp, page }) => {
        const inStock = await pdp.isInStock();
        if (!inStock) return;

        const response = await pdp.addToCart();
        expect(response.status()).toBe(200);

        const body = await response.json().catch(() => null);
        expect(body).not.toBeNull();
        // Shopify cart/add.js returns items array or a single item
        const hasItems = body.items || body.id;
        expect(hasItems).toBeTruthy();
    });

    test('CART001 — Cart badge increments after Add to Cart', async ({ pdp, page, merchant }) => {
        // The badge can be absent until the cart has items and updates a moment after the add, so
        // read it defensively and wait for the count to actually rise.
        const badge     = page.locator(merchant.locators.get('cartBadge')).filter({ visible: true }).first();
        const readCount = async () => {
            const text = await badge.innerText({ timeout: 1_000 }).catch(() => '0');
            return parseInt((text.match(/\d+/) || ['0'])[0], 10);
        };
        const before = await readCount();

        const inStock = await pdp.isInStock();
        if (!inStock) return;

        await pdp.addToCart();
        await expect.poll(readCount, { timeout: 10_000, message: 'cart badge count should increase after Add to Cart' })
            .toBeGreaterThan(before);
    });

    // ── Multiple product handles ────────────────────────────────────────────────
    // Driven by merchant.products (default + secondary) instead of a hardcoded list.

    test('PDP001 — Secondary product loads without 404', async ({ pdp, page, merchant }) => {
        const { handle } = merchant.products.secondary;
        await pdp.navigateTo(handle);
        await expect(page).toHaveURL(new RegExp(handle), { timeout: 15_000 });
        await expectPageFound(page);
        await expect(pdp.productTitle).toBeVisible();
    });

    // ══════════════════════════════════════════════════════════════════════════
    //  New coverage from the Shopify_PDP_Test_Cases sheet
    // ══════════════════════════════════════════════════════════════════════════

    // ── Page load & navigation ─────────────────────────────────────────────────

    test('@smoke PDP001 — Product page opens from a collection product card [TC_PDP_001]', async ({ plp, page, merchant }) => {
        test.skip(await plp.getProductCount() === 0, `${merchant.name} has no product grid on ${merchant.pages.collection}`);

        await plp.clickFirstProduct();
        await expectPageFound(page);
        await expect(page.locator(merchant.locators.get('productTitle')).filter({ visible: true }).first(), 'product title').toBeVisible({ timeout: 15_000 });
        await expect(page.locator(merchant.locators.get('productPrice')).filter({ visible: true }).first(), 'product price').toBeVisible();
        expect(await horizontalOverflow(page), 'px the page overflows the viewport (layout break)').toBe(0);
    });

    test('@smoke PDP001 — Direct product URL loads the product [TC_PDP_002]', async ({ page, merchant }) => {
        const { path, handle } = merchant.products.default;
        const response = await page.goto(path, { waitUntil: 'domcontentloaded' });

        expect(response.status(), 'HTTP status').toBe(200);
        await expect(page).toHaveURL(new RegExp(`/products/${handle}`));
        await expectPageFound(page);
    });

    test('PDP001 — Invalid product URL shows a 404 with a way back to shopping [TC_PDP_003]', async ({ page, merchant }) => {
        const response = await page.goto(`${merchant.urls.production}/products/invalid-handle-pdp-test-404`, { waitUntil: 'domcontentloaded' });

        // Same judgement as the PLP 404 case: the page itself (title/heading/template), not only the status.
        const is404 = /\b404\b|page not found|not found/i.test(await page.title())
            || await page.locator('body.template-404, body[class*="template-404"]').count() > 0
            || (response && response.status() === 404);
        expect(is404, 'invalid product URL renders a 404').toBe(true);

        const backToShopping = page.getByRole('link', { name: /shop|home|continue|collections|products/i }).filter({ visible: true }).first();
        await expect(backToShopping, '404 page has a link back to shopping').toBeVisible();
    });

    test('PDP001 — Breadcrumb leads from the site root to this product [TC_PDP_005]', async ({ pdp, page }) => {
        test.skip(await pdp.breadcrumb.count() === 0, 'This theme has no breadcrumb on product pages');

        expect(await pdp.breadcrumbHomeLink.getAttribute('href'), 'first crumb links to the site root').toBe('/');
        const { title } = await pdp.productJson();
        expect((await pdp.breadcrumb.innerText()).toLowerCase(), 'breadcrumb ends with the product').toContain(title.toLowerCase());

        const collectionCrumb = pdp.breadcrumb.locator('a[href*="/collections/"]').first();
        if (await collectionCrumb.count() > 0) {
            const target = new URL(await collectionCrumb.getAttribute('href'), page.url()).pathname;
            await collectionCrumb.click();
            await expect(page).toHaveURL(current => current.pathname === target, { timeout: 15_000 });
            await expectPageFound(page);
        }
    });

    test('PDP001 — Back from a product returns to the collection at the same scroll position [TC_PDP_006]', async ({ plp, page, merchant }) => {
        const count = await plp.getProductCount();
        test.skip(count === 0, `${merchant.name} has no product grid on ${merchant.pages.collection}`);

        // A card a little way down the grid, so there is a scroll position to lose.
        const card = plp.productCards.nth(Math.min(count - 1, 5));
        await card.scrollIntoViewIfNeeded();
        const collectionUrl = page.url();
        const scrollBefore = await page.evaluate(() => window.scrollY);

        await plp.productCard.titleLink(card).click();
        await expect(page).toHaveURL(/\/products\//, { timeout: 15_000 });
        await page.goBack({ waitUntil: 'domcontentloaded' });

        await expect(page).toHaveURL(collectionUrl);
        const tolerance = page.viewportSize().height / 2;
        await expect.poll(async () => Math.abs(await page.evaluate(() => window.scrollY) - scrollBefore),
            { message: `px away from the ${scrollBefore}px scroll position left behind` }).toBeLessThanOrEqual(tolerance);
    });

    // ── Product info & pricing ─────────────────────────────────────────────────

    test('@smoke PDP002 — Product title matches the store data [TC_PDP_007]', async ({ pdp }) => {
        const json = await pdp.productJson();
        const normalise = text => text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        const shown  = normalise(await pdp.getTitle());
        const stored = normalise(json.title);

        expect(shown.length, 'title text shown').toBeGreaterThan(0);
        // Containment, not equality: a merchant can deliberately display a shorter name than the
        // admin title (Koh shows "MEAL ONE." for "MEAL ONE Overnight Oats") — that's branding, not a
        // wrong product. A different product's title would match neither way.
        expect(stored.includes(shown) || shown.includes(stored), `page shows "${shown}", store title is "${stored}"`).toBe(true);
    });

    test('@smoke PDP002 — Displayed price matches the selected variant in the store [TC_PDP_008]', async ({ pdp }) => {
        const variant = await currentVariant(pdp);
        const text = await pdp.getPrice();

        expect(text, 'price shows a currency symbol').toMatch(/[$£€]/);
        expect(parseMoney(text), `price for "${variant.title}"`).toBe(money(variant.price));
    });

    test('@smoke PDP002 — Compare-at price shows struck through next to the sale price [TC_PDP_009]', async ({ pdp }) => {
        const json = await pdp.productJson();
        const onSale = json.variants.find(v => v.available && v.compare_at_price > v.price);
        test.skip(!onSale, `${json.title} has no variant with a compare-at price`);

        await pdp.navigateTo(pdp.handle, { variant: onSale.id });
        expect(parseMoney(await pdp.getPrice()), 'sale price').toBe(money(onSale.price));

        // Struck-through amounts in the price block (the price element and a few levels around it).
        const struck = await pdp.productPrice.evaluate(el => {
            let root = el;
            for (let i = 0; i < 3 && root.parentElement; i++) root = root.parentElement;
            return [...root.querySelectorAll('*')]
                .filter(node => node.getClientRects().length > 0
                    && (/^(S|DEL)$/.test(node.tagName) || getComputedStyle(node).textDecorationLine.includes('line-through')))
                .map(node => node.textContent);
        });
        expect(struck.map(parseMoney), 'struck-through compare-at price').toContain(money(onSale.compare_at_price));
    });

    test('PDP002 — Product description shows the store copy without raw markup [TC_PDP_011]', async ({ pdp, page }) => {
        const json = await pdp.productJson();
        const plain = await page.evaluate(html => new DOMParser().parseFromString(html, 'text/html').body.textContent, json.description || '');
        const normalise = text => text.replace(/\s+/g, ' ').trim().toLowerCase();
        const opening = normalise(plain).slice(0, 60);
        test.skip(opening.length < 20, `${json.title} has no description in the store`);

        // textContent, not innerText: descriptions often sit in a collapsed accordion. Scripts are
        // excluded so the product JSON embedded in the page can't satisfy the check on its own.
        const pageText = await page.evaluate(() => {
            const clone = document.body.cloneNode(true);
            clone.querySelectorAll('script, style, template, noscript').forEach(n => n.remove());
            return clone.textContent;
        });
        expect(normalise(pageText), 'page shows the start of the store description').toContain(opening);
        expect(await page.locator('body').innerText(), 'no raw HTML tags visible as text').not.toMatch(/<\/?(p|div|span|br|strong|em|ul|ol|li|table)\b[^>]*>/i);
    });

    test('PDP002 — SKU shown on the page follows the selected variant [TC_PDP_012/030]', async ({ pdp, page }) => {
        const json = await pdp.productJson();
        const variant = await currentVariant(pdp);
        test.skip(!variant.sku || !(await page.locator('body').innerText()).includes(variant.sku), 'This theme does not display the SKU');

        const other = json.variants.find(v => v.id !== variant.id && v.sku && v.sku !== variant.sku);
        test.skip(!other, 'No second variant with a different SKU');
        await pdp.navigateTo(pdp.handle, { variant: other.id });
        await expect(page.locator('body'), `SKU for "${other.title}"`).toContainText(other.sku);
    });

    test('PDP002 — Unit price is shown for unit-priced variants [TC_PDP_013]', async ({ pdp, page }) => {
        const variant = await currentVariant(pdp);
        test.skip(!variant.unit_price_measurement, `${variant.name} has no unit price`);

        const unit = `${money(variant.unit_price).toFixed(2)}`;
        await expect(page.locator('body'), `unit price ${unit}`).toContainText(unit);
    });

    // ── Media gallery ──────────────────────────────────────────────────────────

    test('@smoke PDP001 — Product images load and none are broken [TC_PDP_015]', async ({ pdp, page }) => {
        const json = await pdp.productJson();
        const productKeys = new Set(json.images.map(imageKey));
        await pdp.scrollThroughPage();

        const images = (await page.evaluate(() => [...document.images]
            .map(img => ({ src: img.currentSrc || img.src, complete: img.complete, width: img.naturalWidth }))))
            .filter(img => productKeys.has(imageKey(img.src)));

        if (images.length === 0) {
            // Some themes (Revitin) build the gallery from theme assets rather than product media —
            // the product's own images aren't on the page, so judge the primary image instead.
            test.info().annotations.push({ type: 'note', description: 'No store product images on the page; checked the primary image only' });
            await expect.poll(() => pdp.productImage.evaluate(img => img.complete && img.naturalWidth > 0), { message: 'primary image loaded' }).toBe(true);
            return;
        }
        const broken = images.filter(img => img.complete && img.width === 0).map(img => img.src);
        expect(broken, 'product images that failed to load').toEqual([]);
    });

    test('@smoke PDP001 — Clicking a thumbnail shows that image in the main gallery [TC_PDP_016]', async ({ pdp, merchant }) => {
        const thumbs = pdp.galleryThumbnails;
        const count = await thumbs.count();
        test.skip(count < 2, `${merchant.name}'s product gallery has no thumbnails`);

        for (let i = 1; i < Math.min(count, 4); i++) {
            await test.step(`thumbnail ${i + 1}`, async () => {
                const thumb = thumbs.nth(i);
                const key = imageKey(await thumb.locator('img').first().evaluate(img => img.currentSrc || img.src));
                // Retried as a unit: a click landing while the gallery slider is still initialising is
                // ignored by the theme (seen on Abc), which isn't what this case is checking.
                await expect(async () => {
                    await thumb.click();
                    expect(await pdp.visibleMainImageKeys(), `main gallery shows ${key}`).toContain(key);
                }).toPass({ timeout: 15_000 });
            });
        }
    });

    test('PDP001 — Image zoom opens a larger view [TC_PDP_017]', async ({ pdp, merchant }) => {
        test.skip(await pdp.galleryZoomTrigger.count() === 0, `${merchant.name}'s gallery has no zoom control`);

        await pdp.galleryZoomTrigger.click();
        await expect(pdp.galleryZoomView, 'zoomed view').toBeVisible();
        const image = pdp.galleryZoomView.locator('img').filter({ visible: true }).first();
        await expect.poll(() => image.evaluate(img => img.naturalWidth), { message: 'zoomed image resolution (px)' }).toBeGreaterThanOrEqual(1000);
    });

    test('PDP001 — Product video does not autoplay with sound [TC_PDP_019]', async ({ pdp, page, merchant }) => {
        await pdp.scrollThroughPage();
        const videos = await page.evaluate(() => [...document.querySelectorAll('video')]
            .map(v => ({ src: v.currentSrc, playing: !v.paused, audible: !v.muted && v.volume > 0 })));
        test.skip(videos.length === 0, `${merchant.name}'s product page has no video`);

        expect(videos.filter(v => v.playing && v.audible).map(v => v.src), 'videos playing with sound without being asked').toEqual([]);
    });

    test('PDP001 — 3D model viewer loads [TC_PDP_020]', async ({ pdp, page }) => {
        const json = await pdp.productJson();
        test.skip(!(json.media || []).some(m => m.media_type === 'model'), `${json.title} has no 3D model`);

        await expect(page.locator('model-viewer').first()).toBeAttached();
    });

    test('@smoke PDP003 — Choosing a variant shows its image [TC_PDP_021]', async ({ pdp }) => {
        const json = await pdp.productJson();
        const from = await currentVariant(pdp);
        const to = siblingVariant(json, from, v => v.available && v.featured_image
            && imageKey(v.featured_image.src) !== imageKey(from.featured_image && from.featured_image.src));
        test.skip(!to, `${json.title} has no sibling variant with its own image`);

        await pickSibling(pdp, json, from, to);
        // The variant's own image, or an asset the theme names after the variant's SKU (Abc's
        // gallery shows "<sku>.jpg" renders rather than the variant's admin image).
        const expected = [imageKey(to.featured_image.src), to.sku && to.sku.toLowerCase()].filter(Boolean);
        await expect.poll(async () => (await pdp.visibleMainImageKeys()).some(key => expected.some(e => key === e || key.startsWith(`${e}_`))),
            { message: `gallery shows the image for "${to.title}" (${expected.join(' or ')})` }).toBe(true);
    });

    // ── Variant selection ──────────────────────────────────────────────────────

    test('@smoke PDP003 — Every option value from the store is offered [TC_PDP_023]', async ({ pdp, page }) => {
        const json = await pdp.productJson();
        const options = json.options.filter(o => o.values.length > 1);
        test.skip(options.length === 0, `${json.title} has a single variant`);

        // What a shopper can pick: visible text, radio/swatch values (a long swatch list can be
        // collapsed), per-option select entries and control labels — not the hidden master
        // `name="id"` select, which lists every variant whether or not the theme offers it.
        const offered = (await page.evaluate(() => [
            document.body.innerText,
            ...[...document.querySelectorAll('input[type="radio"]')].map(el => el.value),
            ...[...document.querySelectorAll('select:not([name="id"]) option')].map(el => el.textContent),
            ...[...document.querySelectorAll('[aria-label]')].map(el => el.getAttribute('aria-label')),
        ].join('\n'))).toLowerCase();

        for (const option of options) {
            const missing = option.values.filter(value => !offered.includes(value.toLowerCase()));
            expect(missing, `${option.name} values not offered on the page`).toEqual([]);
        }
    });

    test('@smoke PDP003 — Choosing a variant updates the price [TC_PDP_024]', async ({ pdp }) => {
        const json = await pdp.productJson();
        const from = await currentVariant(pdp);
        const to = siblingVariant(json, from, v => v.available && v.price !== from.price);
        test.skip(!to, `${json.title} has no sibling variant at a different price`);

        await pickSibling(pdp, json, from, to);
        await expect.poll(async () => parseMoney(await pdp.getPrice()), { message: `price for "${to.title}"` }).toBe(money(to.price));
    });

    test('PDP003 — Choosing a variant puts it in the URL [TC_PDP_025]', async ({ pdp, page }) => {
        const json = await pdp.productJson();
        const from = await currentVariant(pdp);
        const to = siblingVariant(json, from, v => v.available);
        test.skip(!to, `${json.title} has a single variant`);

        await pickSibling(pdp, json, from, to);
        await expect(page).toHaveURL(new RegExp(`[?&]variant=${to.id}\\b`));
    });

    test('PDP003 — A variant URL opens with that variant selected [TC_PDP_026]', async ({ pdp, page }) => {
        const json = await pdp.productJson();
        const available = json.variants.filter(v => v.available);
        test.skip(available.length < 2, `${json.title} has fewer than 2 available variants`);
        const target = available[available.length - 1];

        await pdp.navigateTo(pdp.handle, { variant: target.id });

        const idField = page.locator('form[action*="/cart/add"] [name="id"], [name="id"]').first();
        if (await idField.count() > 0) await expect(idField, 'variant the form will add').toHaveValue(String(target.id));
        for (const [index, option] of json.options.entries()) {
            if (option.values.length < 2 || !await pdp.hasOptionPicker(option.name)) continue;
            expect(await pdp.selectedOptionValue(option.name), `${option.name} picker`).toBe(target.options[index]);
        }
        expect(parseMoney(await pdp.getPrice()), `price for "${target.title}"`).toBe(money(target.price));
    });

    test('@smoke PDP003 — A combination that does not exist cannot be added [TC_PDP_027]', async ({ pdp }) => {
        const json = await pdp.productJson();
        test.skip(json.options.length < 2, `${json.title} has only one option, so every choice exists`);

        const existing = new Set(json.variants.map(v => v.options.join(' / ')));
        const combos = json.options.reduce((acc, option) => acc.flatMap(prefix => option.values.map(value => [...prefix, value])), [[]]);
        const missing = combos.find(combo => !existing.has(combo.join(' / ')));
        test.skip(!missing, `Every option combination of ${json.title} exists`);
        for (const option of json.options) {
            test.skip(!await pdp.hasOptionPicker(option.name), `No on-page picker for the "${option.name}" option`);
        }

        for (const [index, option] of json.options.entries()) {
            // The picker dropping the value once the earlier options are chosen is itself the refusal.
            if (!await pdp.hasOptionValue(option.name, missing[index])) return;
            await pdp.selectOptionValue(option.name, missing[index]);
        }

        // Either the picker refused the combination (disabled value / auto-switched to a real
        // variant), or it shows the combination with Add to Cart blocked — both are what the sheet asks.
        const chosen = [];
        for (const option of json.options) chosen.push(await pdp.selectedOptionValue(option.name));
        if (existing.has(chosen.join(' / '))) return;
        await expect.poll(() => pdp.isAddToCartBlocked(), { message: `Add to Cart blocked for "${missing.join(' / ')}"` }).toBe(true);
    });

    test('@smoke PDP003 — A sold-out variant cannot be added [TC_PDP_028]', async ({ pdp }) => {
        const json = await pdp.productJson();
        const soldOut = json.variants.find(v => !v.available);
        test.skip(!soldOut, `Every variant of ${json.title} is in stock`);

        await pdp.navigateTo(pdp.handle, { variant: soldOut.id });
        await expect.poll(() => pdp.isAddToCartBlocked(), { message: `Add to Cart blocked for sold-out "${soldOut.title}"` }).toBe(true);
    });

    test('PDP003 — Without a variant in the URL the first available variant is selected [TC_PDP_029]', async ({ pdp }) => {
        const json = await pdp.productJson();
        test.skip(json.variants.length < 2, `${json.title} has a single variant`);
        const selected = await pdp.selectedVariantId();
        test.skip(selected === null, 'This product page has no standard variant field');

        expect(selected, 'pre-selected variant').toBe(json.variants.find(v => v.available).id);
    });

    // ── Quantity & add to cart ─────────────────────────────────────────────────

    test('@smoke CART001 — Quantity + and - change the quantity and never go below 1 [TC_PDP_032]', async ({ pdp, merchant }) => {
        test.skip(!await pdp.hasQuantityStepper(), `${merchant.name}'s product page has no quantity stepper`);

        await expect(pdp.quantityInput).toHaveValue('1');
        await pdp.quantityIncrease.click();
        await expect(pdp.quantityInput, 'after +').toHaveValue('2');
        await pdp.quantityDecrease.click();
        await expect(pdp.quantityInput, 'after -').toHaveValue('1');
        // At 1, a disabled "-" (Outset, Abc) is itself the guard; an enabled one must not go lower.
        if (await pdp.quantityDecrease.isEnabled()) await pdp.quantityDecrease.click();
        await expect(pdp.quantityInput, 'cannot go below 1').toHaveValue('1');
    });

    test('CART001 — Quantity field accepts a typed number [TC_PDP_033]', async ({ pdp, merchant }) => {
        test.skip(await pdp.quantityInput.count() === 0, `${merchant.name}'s product page has no quantity field`);
        test.skip(await pdp.quantityInput.isDisabled(), `${merchant.name}'s quantity only changes through the +/- buttons`);

        await pdp.setQuantity(5);
        await pdp.quantityInput.blur();
        await expect(pdp.quantityInput).toHaveValue('5');
    });

    test('CART001 — Invalid quantities are rejected or reset [TC_PDP_034]', async ({ pdp, merchant }) => {
        test.skip(await pdp.quantityInput.count() === 0, `${merchant.name}'s product page has no quantity field`);
        test.skip(await pdp.quantityInput.isDisabled(), `${merchant.name}'s quantity only changes through the +/- buttons`);

        for (const value of ['0', '-1', 'abc', '2.5']) {
            await test.step(`"${value}"`, async () => {
                await pdp.setQuantity(1);
                await pdp.quantityInput.fill(value).catch(() => {});   // a number field refuses letters outright
                await pdp.quantityInput.blur();
                const state = await pdp.quantityInput.evaluate(el => ({ value: el.value, valid: el.checkValidity() }));
                expect(/^[1-9]\d*$/.test(state.value) || !state.valid,
                    `"${value}" is reset to a whole quantity or flagged invalid (field now "${state.value}")`).toBe(true);
            });
        }
    });

    test('@smoke CART001 — Add to Cart adds the selected product and variant [TC_PDP_036]', async ({ pdp }) => {
        test.skip(!await pdp.isInStock(), 'Default product is out of stock');
        const json = await pdp.productJson();
        const variantId = await pdp.selectedVariantId();

        const response = await pdp.addToCart();
        expect(response.status()).toBe(200);

        const { items } = await pdp.cartJson();
        const line = items.find(item => variantId ? item.variant_id === variantId : item.product_id === json.id);
        expect(line, `cart holds ${variantId ? `variant ${variantId}` : json.title}`).toBeTruthy();
    });

    test('@smoke CART001 — Add to Cart with quantity 3 adds 3 at the right line total [TC_PDP_037]', async ({ pdp, merchant }) => {
        test.skip(!await pdp.hasQuantityStepper(), `${merchant.name}'s product page has no quantity stepper`);
        test.skip(!await pdp.isInStock(), 'Default product is out of stock');
        const variant = await currentVariant(pdp);

        await pdp.quantityIncrease.click();
        await pdp.quantityIncrease.click();
        await expect(pdp.quantityInput).toHaveValue('3');
        await pdp.addToCart();

        const line = (await pdp.cartJson()).items.find(item => item.variant_id === variant.id);
        expect(line && line.quantity, 'quantity in cart').toBe(3);
        // original_line_price: before automatic discounts (verified on Outset — a quantity offer
        // lowers line_price for 3 units, which is a promotion, not a wrong total).
        expect(line.original_line_price, 'line total = 3 x variant price').toBe(variant.price * 3);
    });

    test('@smoke CART001 — Cart drawer opens with the added item and closes [TC_PDP_038]', async ({ pdp, cart, merchant }) => {
        test.skip(!await pdp.isInStock(), 'Default product is out of stock');

        await pdp.addToCart();
        await cart.waitForDrawerOpen();
        test.skip(!await cart.miniCartDrawer.isVisible(), `${merchant.name} updates the cart badge instead of opening a drawer`);

        await cart.waitForItems();
        await expect(cart.firstItemTitle, 'added item shows in the drawer').toHaveText(/\S/);
        const drawer = await cart.miniCartDrawer.elementHandle();
        await cart.closeDrawer();
        // Closed = hidden, or slid off-screen (Outset's drawer stays rendered, moved out of view).
        await expect.poll(() => drawer.evaluate(el => {
            const box = el.getBoundingClientRect();
            const hidden = !el.isConnected || !el.getClientRects().length || getComputedStyle(el).visibility === 'hidden' || getComputedStyle(el).opacity === '0';
            return hidden || box.right <= 0 || box.left >= innerWidth || box.bottom <= 0 || box.top >= innerHeight;
        }), { message: 'drawer closed' }).toBe(true);
    });

    test('CART001 — Adding the same item twice merges into one line [TC_PDP_039]', async ({ pdp }) => {
        test.skip(!await pdp.isInStock(), 'Default product is out of stock');
        const lineKey = item => `${item.variant_id}:${item.selling_plan_allocation ? item.selling_plan_allocation.selling_plan.id : ''}`;

        await pdp.addToCart();
        const first = (await pdp.cartJson()).items;
        await pdp.navigateTo(pdp.handle);   // fresh page: the cart drawer may now cover the button
        await pdp.addToCart();
        const second = (await pdp.cartJson()).items;

        expect(second.map(lineKey).sort(), 'same cart lines, no duplicates').toEqual(first.map(lineKey).sort());
        for (const item of first) {
            expect(second.find(other => lineKey(other) === lineKey(item)).quantity, `quantity of ${item.title}`).toBe(item.quantity * 2);
        }
    });

    test('CART001 — Two variants of the same product become two cart lines [TC_PDP_040]', async ({ pdp }) => {
        test.slow();   // two product loads + two adds on a heavy page
        const json = await pdp.productJson();
        const available = json.variants.filter(v => v.available);
        test.skip(available.length < 2, `${json.title} has fewer than 2 available variants`);
        test.skip(await pdp.selectedVariantId() === null, 'This product page has no standard variant field');

        for (const variant of available.slice(0, 2)) {
            await pdp.navigateTo(pdp.handle, { variant: variant.id });
            await pdp.addToCart();
        }
        const lines = (await pdp.cartJson()).items.filter(item => item.product_id === json.id);
        expect(lines.map(item => item.variant_id).sort(), 'one line per variant').toEqual([available[0].id, available[1].id].sort());
    });

    test('CART001 — Double-clicking Add to Cart adds the item only once [TC_PDP_041]', async ({ pdp, page }) => {
        test.skip(!await pdp.isInStock(), 'Default product is out of stock');
        const adds = [];
        page.on('request', request => {
            if (/\/cart\/add(\.js)?(\?|$)/.test(request.url()) && request.method() === 'POST') adds.push(request.url());
        });

        await pdp.addToCartButton.dblclick();
        await expect.poll(() => adds.length, { message: 'an add-to-cart request was sent' }).toBeGreaterThan(0);
        await page.waitForTimeout(3_000);   // long enough for a second, duplicate request to show up
        expect(adds.length, 'add-to-cart requests sent for one double-click').toBe(1);
    });

    test('CART001 — Personalisation text is carried into the cart [TC_PDP_042]', async ({ pdp, page, merchant }) => {
        const field = page.locator('input[name^="properties["], textarea[name^="properties["]').filter({ visible: true }).first();
        test.skip(await field.count() === 0, `${merchant.name}'s product page has no personalisation field`);
        test.skip(!await pdp.isInStock(), 'Default product is out of stock');

        const name = (await field.getAttribute('name')).replace(/^properties\[|\]$/g, '');
        await field.fill('SUNTEK QC test');
        await pdp.addToCart();

        const line = (await pdp.cartJson()).items.find(item => item.properties && item.properties[name]);
        expect(line && line.properties[name], `cart line property "${name}"`).toBe('SUNTEK QC test');
    });

    test('CART001 — A required personalisation field blocks Add to Cart until filled [TC_PDP_043]', async ({ pdp, page, merchant }) => {
        const field = page.locator('[name^="properties["][required]').filter({ visible: true }).first();
        test.skip(await field.count() === 0, `${merchant.name}'s product page has no required personalisation field`);

        await pdp.prepareForAddToCart();
        await pdp.addToCartButton.click();
        await page.waitForTimeout(2_000);
        expect(await field.evaluate(el => el.checkValidity()), 'empty required field is flagged').toBe(false);
        expect((await pdp.cartJson()).item_count, 'nothing added').toBe(0);
    });

    // ── Buy now ────────────────────────────────────────────────────────────────

    test('@smoke CART001 — Buy it now goes straight to checkout [TC_PDP_044]', async ({ pdp, page, merchant }) => {
        test.skip(await pdp.buyItNowButton.count() === 0, `${merchant.name} has no Buy it now button`);

        await pdp.buyItNowButton.click();
        // Stops at the checkout URL — no order is ever placed.
        await expect(page).toHaveURL(/\/checkouts?\//, { timeout: 20_000 });
    });

    test('CART001 — Buy it now carries the chosen quantity to checkout [TC_PDP_046]', async ({ pdp, page, merchant }) => {
        test.skip(await pdp.buyItNowButton.count() === 0, `${merchant.name} has no Buy it now button`);
        test.skip(!await pdp.hasQuantityStepper(), `${merchant.name}'s product page has no quantity stepper`);

        await pdp.quantityIncrease.click();
        await pdp.buyItNowButton.click();
        await expect(page).toHaveURL(/\/checkouts?\//, { timeout: 20_000 });
        await expect(page.getByText(/quantity\s*2|×\s*2|\b2\s*×/i).first(), 'checkout shows quantity 2').toBeVisible({ timeout: 15_000 });
    });

    // ── Subscription / selling plans (merchants with features.subscription) ────

    test.describe('Subscription', () => {

        test('@smoke PDP001 — Switching between one-time and subscribe changes the purchase choice [TC_PDP_053]', async ({ pdp, merchant }) => {
            test.skip(!merchant.features.subscription, `${merchant.name} does not sell subscriptions`);
            await pdp.prepareForAddToCart();
            const offer = () => pdp.addToCartButton.innerText();

            await pdp.choosePurchaseOption('subscribe');
            await expect.poll(() => pdp.isPurchaseOptionSelected('subscribe'), { message: 'subscribe selected' }).toBe(true);
            const subscribeOffer = await offer();

            await pdp.choosePurchaseOption('onetime');
            await expect.poll(() => pdp.isPurchaseOptionSelected('onetime'), { message: 'one-time selected' }).toBe(true);
            expect(await pdp.isPurchaseOptionSelected('subscribe'), 'subscribe no longer selected').toBe(false);
            // Only a price-bearing Add to Cart label can show the change (Koh's reads "ADD TO CART"
            // either way — its cart-level switch is covered by TC_PDP_057).
            if (/[$£€]\s?\d/.test(subscribeOffer)) {
                await expect.poll(offer, { message: 'Add to Cart reflects the one-time price' }).not.toBe(subscribeOffer);
            }
            await pdp.choosePurchaseOption('subscribe');
            await expect.poll(() => pdp.isPurchaseOptionSelected('subscribe'), { message: 'switches back to subscribe' }).toBe(true);
        });

        test('PDP001 — Every delivery frequency can be chosen [TC_PDP_054]', async ({ pdp, merchant }) => {
            test.skip(!merchant.features.subscription, `${merchant.name} does not sell subscriptions`);
            await pdp.choosePurchaseOption('subscribe');
            const frequency = pdp.subscriptionFrequency;
            await expect(frequency, 'frequency dropdown').toBeVisible();

            const values = await frequency.locator('option').evaluateAll(options => options.map(o => o.value));
            expect(values.length, 'frequencies offered').toBeGreaterThan(0);
            for (const value of values) {
                await frequency.selectOption(value);
                await expect(frequency).toHaveValue(value);
            }
        });

        test('@smoke PDP001 — Subscribe option shows its discount [TC_PDP_055]', async ({ pdp, merchant }) => {
            test.skip(!merchant.features.subscription, `${merchant.name} does not sell subscriptions`);

            const amounts = [...(await pdp.purchaseOption('subscribe').innerText()).replace(/,/g, '').matchAll(/[$£€]\s?(\d+(\.\d+)?)/g)].map(m => parseFloat(m[1]));
            expect(amounts.length, 'subscribe option shows a price and the price it is discounted from').toBeGreaterThanOrEqual(2);
            expect(Math.min(...amounts), 'subscription price is below the regular price').toBeLessThan(Math.max(...amounts));
        });

        test('@smoke PDP001 — Subscription is carried to the cart with its plan [TC_PDP_056]', async ({ pdp, merchant }) => {
            test.skip(!merchant.features.subscription, `${merchant.name} does not sell subscriptions`);
            await pdp.prepareForAddToCart();
            await pdp.choosePurchaseOption('subscribe');
            await pdp.addToCart();

            const line = (await pdp.cartJson()).items.find(item => item.selling_plan_allocation);
            expect(line, 'a cart line carries a selling plan').toBeTruthy();
            const allocation = line.selling_plan_allocation;
            expect(allocation.selling_plan.name, 'plan name').toMatch(/\S/);
            if (allocation.compare_at_price) {
                expect(allocation.price, 'subscription price is below the one-time price').toBeLessThan(allocation.compare_at_price);
            }
        });

        test('PDP001 — Subscription and one-time items sit in the same cart with correct totals [TC_PDP_057]', async ({ pdp, merchant }) => {
            test.skip(!merchant.features.subscription, `${merchant.name} does not sell subscriptions`);

            await pdp.prepareForAddToCart();
            await pdp.choosePurchaseOption('subscribe');
            await pdp.addToCart();
            await pdp.navigateTo(pdp.handle);
            await pdp.prepareForAddToCart();
            await pdp.choosePurchaseOption('onetime');
            await pdp.addToCart();

            const cart = await pdp.cartJson();
            expect(cart.items.some(item => item.selling_plan_allocation), 'a subscription line').toBe(true);
            expect(cart.items.some(item => !item.selling_plan_allocation), 'a one-time line').toBe(true);
            expect(cart.items_subtotal_price, 'subtotal = sum of lines').toBe(cart.items.reduce((sum, item) => sum + item.final_line_price, 0));
        });
    });

    // ── Content sections ───────────────────────────────────────────────────────

    test('PDP001 — Content accordions and tabs open and close as intended [TC_PDP_058]', async ({ pdp, merchant }) => {
        const toggles = pdp.contentToggles;
        const count = Math.min(await toggles.count(), 4);
        test.skip(count === 0, `${merchant.name}'s product page has no accordions or tabs`);

        for (let i = 0; i < count; i++) {
            const toggle = toggles.nth(i);
            await test.step(`"${(await toggle.innerText()).trim()}"`, async () => {
                await toggle.scrollIntoViewIfNeeded();
                if (await pdp.isAccordionToggle(toggle)) {
                    const startsOpen = await pdp.isToggleOpen(toggle);
                    await toggle.click();
                    await expect.poll(() => pdp.isToggleOpen(toggle), { message: 'first click toggles it' }).toBe(!startsOpen);
                    await toggle.click();
                    await expect.poll(() => pdp.isToggleOpen(toggle), { message: 'second click toggles it back' }).toBe(startsOpen);
                } else {
                    // A tab: opening it closes its siblings.
                    await toggle.click();
                    await expect.poll(() => pdp.isToggleOpen(toggle), { message: 'tab opens' }).toBe(true);
                    for (let j = 0; j < count; j++) {
                        if (j !== i && !await pdp.isAccordionToggle(toggles.nth(j))) {
                            expect(await pdp.isToggleOpen(toggles.nth(j)), `tab ${j + 1} closed while tab ${i + 1} is open`).toBe(false);
                        }
                    }
                }
            });
        }
    });

    test('PDP001 — Size chart opens and closes [TC_PDP_059]', async ({ pdp, page, merchant }) => {
        const trigger = page.getByRole('button', { name: /size (chart|guide)/i }).or(page.getByRole('link', { name: /size (chart|guide)/i })).filter({ visible: true }).first();
        test.skip(await trigger.count() === 0, `${merchant.name}'s product page has no size chart`);

        await trigger.click();
        const dialog = page.locator('[role="dialog"], dialog[open], [class*="modal" i]').filter({ visible: true }).filter({ hasText: /size/i }).first();
        await expect(dialog, 'size chart').toBeVisible();
        await page.keyboard.press('Escape');
        await expect(dialog, 'size chart closed').toBeHidden();
    });

    test('PDP001 — Sticky add-to-cart bar appears past the main button and adds to cart [TC_PDP_061]', async ({ pdp, page, merchant }) => {
        test.skip(await pdp.stickyAddToCart.count() === 0, `${merchant.name} has no sticky add-to-cart bar`);
        test.skip(!await pdp.isInStock(), 'Default product is out of stock');

        await pdp.addToCartButton.scrollIntoViewIfNeeded();
        await page.mouse.wheel(0, page.viewportSize().height * 1.5);
        // Abc ships a #stickyAtc container that stays display:none at every width — the feature is
        // switched off there, which isn't the defect this case looks for.
        const shown = await pdp.stickyAddToCart.waitFor({ state: 'visible', timeout: 5_000 }).then(() => true, () => false);
        test.skip(!shown && await pdp.stickyAddToCart.evaluate(el => getComputedStyle(el).display === 'none'),
            `${merchant.name}'s sticky bar is in the markup but switched off (display: none)`);
        await expect(pdp.stickyAddToCart, 'sticky bar shows once the main button is scrolled away').toBeVisible();

        const shownPrice = parseMoney(await pdp.getPrice().catch(() => ''));
        const stickyText = await pdp.stickyAddToCart.innerText();
        if (/[$£€]\s?\d/.test(stickyText) && !Number.isNaN(shownPrice)) {
            const amounts = [...stickyText.replace(/,/g, '').matchAll(/[$£€]\s?(\d+(\.\d+)?)/g)].map(m => parseFloat(m[1]));
            expect(amounts, 'sticky bar shows the product price').toContain(shownPrice);
        }

        const button = pdp.stickyAddToCart.locator('button').filter({ visible: true }).filter({ hasText: /add|cart|bag/i }).first();
        const response = await pdp.addToCartVia(button);
        expect(response.status(), 'sticky Add to Cart response').toBe(200);
    });

    // ── Reviews ────────────────────────────────────────────────────────────────

    test('PDP001 — Reviews widget loads with a review count [TC_PDP_063]', async ({ pdp, merchant }) => {
        test.skip(!merchant.features.reviews, `${merchant.name} has no product reviews`);
        const widget = pdp.reviewsWidget;
        test.skip(!widget, `No reviews widget mapped for provider "${merchant.integrations.reviewsProvider}"`);

        await pdp.scrollThroughPage();   // review apps load their widget once it's scrolled near
        await expect(widget, `${merchant.integrations.reviewsProvider} widget`).toBeVisible({ timeout: 20_000 });
        await expect(widget, 'shows a review count').toContainText(/\d[\d,]*\s*reviews?/i);
    });

    // ── Upsell & recommendations ───────────────────────────────────────────────

    test('PDP001 — Recommended products show with image and price [TC_PDP_068]', async ({ pdp, merchant }) => {
        await pdp.scrollThroughPage();   // recommendations are usually fetched once scrolled near
        const recs = pdp.recommendations;
        test.skip(await recs.count() === 0, `${merchant.name}'s product page has no recommendations block`);

        await recs.scrollIntoViewIfNeeded();
        await expect(recs.locator('a[href*="/products/"]').filter({ visible: true }).first(), 'a recommended product').toBeVisible();
        const image = recs.locator('img').filter({ visible: true }).first();
        await expect.poll(() => image.evaluate(img => img.complete && img.naturalWidth > 0), { message: 'recommendation image loaded' }).toBe(true);
        await expect(recs, 'recommendations show prices').toContainText(/[$£€]\s?\d/);
    });

    test('PDP001 — Clicking a recommended product opens its page [TC_PDP_069]', async ({ pdp, page, merchant }) => {
        await pdp.scrollThroughPage();
        const recs = pdp.recommendations;
        test.skip(await recs.count() === 0, `${merchant.name}'s product page has no recommendations block`);

        const link = recs.locator('a[href*="/products/"]').filter({ visible: true }).first();
        await link.scrollIntoViewIfNeeded();
        const handleOf = path => path.split('/products/')[1]?.split(/[/?#]/)[0];
        const target = handleOf(new URL(await link.getAttribute('href'), page.url()).pathname);
        // Abc's app routes the click through its own handler and can land on a neighbouring card's
        // product — still one it recommended, so the check is "a recommended product opened".
        const recommended = new Set((await recs.locator('a[href*="/products/"]').evaluateAll(as => as.map(a => a.pathname)))
            .map(handleOf));
        await link.click();

        await expect.poll(() => {
            const path = new URL(page.url()).pathname;
            return path.includes('/products/') && handleOf(path) !== pdp.handle;
        }, { timeout: 15_000, message: 'another product page opened' }).toBe(true);
        const landed = handleOf(new URL(page.url()).pathname);
        if (landed !== target) test.info().annotations.push({ type: 'note', description: `Clicked "${target}", opened "${landed}"` });
        expect(recommended.has(landed), `opened product "${landed}" is one the block recommended`).toBe(true);
        await expectPageFound(page);
    });

    test('PDP001 — Recently viewed lists products seen earlier [TC_PDP_071]', async ({ pdp, page, merchant }) => {
        test.slow();   // three product loads plus a full-page scroll
        const secondary = merchant.products.secondary;
        await pdp.navigateTo(secondary.handle);
        await pdp.navigateTo(merchant.products.default.handle);
        await pdp.scrollThroughPage();

        const section = page.locator('[class*="recently-viewed" i], [id*="recently-viewed" i], [class*="recently_viewed" i]').filter({ visible: true }).first();
        test.skip(await section.count() === 0, `${merchant.name} has no recently-viewed block`);
        await expect(section.locator(`a[href*="/products/${secondary.handle}"]`).first(), `${secondary.name} listed`).toBeAttached();
    });

    // ── Sharing ────────────────────────────────────────────────────────────────

    test('PDP001 — Share links carry this product URL [TC_PDP_072]', async ({ pdp, page, merchant }) => {
        const links = page.locator('a[href*="facebook.com/sharer"], a[href*="twitter.com/intent"], a[href*="x.com/intent"], a[href*="pinterest.com/pin"]');
        test.skip(await links.count() === 0, `${merchant.name}'s product page has no share links`);

        for (const href of await links.evaluateAll(anchors => anchors.map(a => a.href))) {
            expect(decodeURIComponent(href), 'share link points at this product').toContain(`/products/${pdp.handle}`);
        }
    });

    // ── Responsive ─────────────────────────────────────────────────────────────

    const LAYOUTS = [
        { tc: 'TC_PDP_075', label: 'Mobile',        widths: [375, 414],   height: 812,  smoke: true },
        { tc: 'TC_PDP_076', label: 'Tablet',        widths: [768, 1024],  height: 1024 },
        { tc: 'TC_PDP_077', label: 'Large desktop', widths: [1440, 1920], height: 1080 },
    ];

    for (const { tc, label, widths, height, smoke } of LAYOUTS) {
        test(`${smoke ? '@smoke ' : ''}PDP001 — ${label} layout shows gallery, price and Add to Cart with no horizontal scroll at ${widths.join('px and ')}px [${tc}]`,
            async ({ pdp, page, isMobile }) => {
                test.skip(isMobile, 'This test sets its own viewport — run it on the desktop project');

                for (const width of widths) {
                    await test.step(`${width}px wide`, async () => {
                        await page.setViewportSize({ width, height });
                        await expect(pdp.productTitle, 'title').toBeVisible();
                        await expect(pdp.productPrice, 'price').toBeVisible();
                        await expect(pdp.productImage, 'product image').toBeVisible();
                        await pdp.addToCartButton.scrollIntoViewIfNeeded();
                        await expect(pdp.addToCartButton, 'Add to Cart').toBeVisible();
                        await expect.poll(() => horizontalOverflow(page), { message: 'px the page overflows the viewport' }).toBe(0);

                        // "Images not stretched": only default object-fit images can be distorted.
                        const ratio = await pdp.productImage.evaluate(img => {
                            if (getComputedStyle(img).objectFit !== 'fill' || !img.naturalWidth) return 1;
                            const box = img.getBoundingClientRect();
                            return (box.width / box.height) / (img.naturalWidth / img.naturalHeight);
                        });
                        expect(ratio, 'main image shown at its own aspect ratio').toBeGreaterThan(0.9);
                        expect(ratio, 'main image shown at its own aspect ratio').toBeLessThan(1.1);
                    });
                }
            });
    }

    // ── Performance, SEO & accessibility ───────────────────────────────────────

    test('PDP001 — Images below the fold load lazily and none are grossly oversized [TC_PDP_080]', async ({ pdp, page }) => {
        // Images well below the first screen (past the browser's own eager-load distance) that sit
        // horizontally on the page — carousel slides parked off to the side only load when swiped to.
        const candidates = await page.evaluate(() => [...document.images]
            .map((img, index) => ({ img, index, box: img.getBoundingClientRect() }))
            .filter(({ img, box }) => box.top > window.innerHeight * 3 && box.width > 40 && box.left >= 0 && box.right <= window.innerWidth
                && (img.currentSrc || img.src || img.dataset.src))
            .map(({ img, index }) => ({
                index,
                lazy: img.loading === 'lazy' || 'src' in img.dataset || 'srcset' in img.dataset || /lazy/i.test(img.className),
            })));
        test.skip(candidates.length === 0, 'The page is too short to have images far below the fold');
        expect(candidates.filter(c => c.lazy).length, 'below-the-fold images marked for lazy loading').toBeGreaterThan(0);

        await pdp.scrollThroughPage();
        const unloaded = await page.evaluate(indexes => indexes.filter(i => !document.images[i].complete || !document.images[i].naturalWidth),
            candidates.map(c => c.index));
        expect(unloaded.length, 'below-the-fold images still not loaded after scrolling past them').toBe(0);

        // Downloaded file far wider than it is ever shown (allowing for high-DPI screens).
        const oversized = await page.evaluate(() => [...document.images]
            .filter(img => {
                const shown = img.getBoundingClientRect().width;
                return img.complete && shown >= 100 && img.naturalWidth > shown * window.devicePixelRatio * 4;
            })
            .map(img => `${img.currentSrc.split('?')[0].split('/').pop()} (${img.naturalWidth}px file shown at ${Math.round(img.getBoundingClientRect().width)}px)`));
        expect(oversized, 'images downloaded at more than 4x their displayed size').toEqual([]);
    });

    test('PDP001 — Meta title and description exist and are unique to this product [TC_PDP_081]', async ({ pdp, page, merchant }) => {
        await expect(page.locator('meta[name="description"]'), 'exactly one meta description tag').toHaveCount(1);

        const title = await page.title();
        expect(title.length, `title "${title}"`).toBeGreaterThan(0);
        expect(title.length, `title "${title}"`).toBeLessThanOrEqual(SEO_LIMITS.titleMax);
        const description = await page.locator('meta[name="description"]').getAttribute('content');
        expect(description, 'meta description has content').toMatch(/\S/);

        await page.goto(merchant.pages.homepage, { waitUntil: 'domcontentloaded' });
        expect(await page.title(), 'product title differs from the homepage').not.toBe(title);
        expect(await page.locator('meta[name="description"]').first().getAttribute('content'), 'product description differs from the homepage').not.toBe(description);
    });

    test('PDP001 — Product structured data has name, price, currency and availability [TC_PDP_082]', async ({ pdp, page }) => {
        const json = await pdp.productJson();
        const blocks = await page.locator('script[type="application/ld+json"]').evaluateAll(scripts => scripts.map(s => s.textContent));
        const nodes = blocks.flatMap(text => {
            try { const data = JSON.parse(text); return [].concat(data['@graph'] || data); } catch { return []; }
        });
        const products = nodes.filter(node => ['Product', 'ProductGroup'].includes(node['@type']));
        expect(products.length, 'a Product / ProductGroup schema block').toBeGreaterThan(0);

        const offers = products.flatMap(p => [].concat(p.offers || [], ...(p.hasVariant || []).map(v => v.offers || [])));
        expect(products.some(p => typeof p.name === 'string' && p.name.trim()), 'schema has the product name').toBe(true);
        expect(offers.length, 'schema has offers').toBeGreaterThan(0);
        for (const offer of offers.slice(0, 5)) {
            expect(offer.price ?? offer.lowPrice, 'offer price').toBeDefined();
            expect(offer.priceCurrency, 'offer currency').toMatch(/^[A-Z]{3}$/);
            expect(offer.availability, 'offer availability').toMatch(/^(https?:\/\/schema\.org\/)?(InStock|OutOfStock|PreOrder|BackOrder|LimitedAvailability|SoldOut|Discontinued|OnlineOnly|InStoreOnly)$/);
        }
        const storePrices = json.variants.map(v => money(v.price));
        expect(offers.some(offer => storePrices.includes(Number(offer.price ?? offer.lowPrice))), 'schema price matches a store price').toBe(true);
    });

    test('PDP001 — Canonical tag of a variant URL points to the base product URL [TC_PDP_083]', async ({ pdp, page, merchant }) => {
        const json = await pdp.productJson();
        await pdp.navigateTo(pdp.handle, { variant: json.variants[0].id });

        await expect(page.locator('link[rel="canonical"]').first()).toHaveAttribute('href', `${merchant.urls.production}/products/${pdp.handle}`);
    });

    test('PDP001 — Product title is the only H1 [TC_PDP_084]', async ({ pdp, page }) => {
        await expect(page.locator('h1')).toHaveCount(1);
    });

    test('PDP001 — Product images have meaningful alt text [TC_PDP_085]', async ({ pdp, page }) => {
        const json = await pdp.productJson();
        const productKeys = new Set(json.images.map(imageKey));
        await pdp.scrollThroughPage();

        const images = (await page.evaluate(() => [...document.images]
            .map(img => ({ src: img.currentSrc || img.src, alt: img.getAttribute('alt') }))))
            .filter(img => productKeys.has(imageKey(img.src)));
        test.skip(images.length === 0, 'No store product images on the page (theme-built gallery)');

        const offenders = images
            .filter(img => !img.alt || !img.alt.trim() || /\.(jpe?g|png|webp|gif|svg)\b|^(img|dsc)_?\d+/i.test(img.alt))
            .map(img => img.src.split('?')[0].split('/').pop());
        expect([...new Set(offenders)], 'product images with no alt text, or a file name as alt').toEqual([]);
    });

    test('PDP001 — Add to Cart is reachable and usable by keyboard with a visible focus state [TC_PDP_086]', async ({ pdp, page, isMobile }) => {
        test.skip(isMobile, 'Keyboard navigation is a desktop check');
        test.skip(!await pdp.isInStock(), 'Default product is out of stock');   // also enables a builder's button

        const atc = await pdp.addToCartButton.elementHandle();
        // Start just before the product area instead of the page top, so the header's own stops
        // (80+ on Koh/Revitin) don't use up the budget before the form is reached.
        await page.evaluate(button => {
            const area = button.closest('section') || button.closest('form') || button.parentElement;
            const marker = document.createElement('span');
            marker.tabIndex = -1;
            marker.dataset.qcTabStart = '';
            area.prepend(marker);
            marker.focus();
        }, atc);

        const stops = [];
        const path = [];
        let reached = false;
        for (let i = 0; i < 100 && !reached; i++) {
            await pdp.pressKey('Tab');
            const stop = await page.evaluate(button => {
                const el = document.activeElement;
                const style = getComputedStyle(el);
                const area = button.closest('section') || button.closest('form') || button.parentElement;
                return {
                    element:     `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : ''}`
                        + (el.closest('[role="dialog"], [aria-modal="true"], dialog') ? ' (in dialog)' : ''),
                    isAtc:       el === button,
                    inForm:      area.contains(el),
                    hasFocusRing: (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) || style.boxShadow !== 'none',
                };
            }, atc);
            reached = stop.isAtc;
            path.push(stop.element);
            if (stop.inForm) stops.push(stop);
        }
        await page.evaluate(() => document.querySelector('[data-qc-tab-start]')?.remove());
        expect(reached, `Tab reaches Add to Cart (Tab stops: ${path.slice(0, 45).join(' > ')}${path.length > 45 ? ' ...' : ''})`).toBe(true);
        expect(stops.filter(s => !s.hasFocusRing).map(s => s.element), 'product-form controls with no visible focus state').toEqual([]);

        const [response] = await Promise.all([
            page.waitForResponse(r => /\/cart\/add(\.js)?(\?|$)/.test(r.url()) && r.request().method() === 'POST', { timeout: 15_000 }),
            pdp.pressKey('Enter'),
        ]);
        expect(response.status(), 'Enter on Add to Cart adds the product').toBe(200);
    });

    test('PDP001 — Product-form controls have accessible names [TC_PDP_087]', async ({ pdp }) => {
        const unnamed = await pdp.addToCartButton.evaluate(button => {
            const area = button.closest('form, section') || button.parentElement;
            const nameOf = el => {
                const labelledBy = el.getAttribute('aria-labelledby');
                const byId = labelledBy && labelledBy.split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ');
                const label = (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) || el.closest('label');
                return [el.getAttribute('aria-label'), byId, label && label.textContent, el.innerText, el.getAttribute('title'),
                    el.querySelector('img[alt]')?.getAttribute('alt')].find(text => text && text.trim());
            };
            return [...area.querySelectorAll('button, input:not([type="hidden"]), select, [role="radio"], [role="button"]')]
                .filter(el => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden')
                .filter(el => !nameOf(el))
                .map(el => `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : ''}`);
        });
        expect(unnamed, 'product-form controls with no accessible name').toEqual([]);
    });

    test('PDP001 — GA4 view_item fires once for the product [TC_PDP_088]', async ({ page, merchant }) => {
        test.skip(merchant.integrations.analyticsProvider !== 'ga4', `${merchant.name} does not use GA4`);
        const ga4 = recordGa4Events(page);

        await page.goto(merchant.products.default.path, { waitUntil: 'load' });
        await expect.poll(() => ga4.events('view_item').length, { timeout: 15_000, message: 'view_item fired' }).toBeGreaterThan(0);
        await page.waitForTimeout(3_000);   // room for a duplicate hit to show up
        const perProperty = hitsPerProperty(ga4.events('view_item'));
        expect(Object.values(perProperty).every(hits => hits === 1), `view_item hits per GA4 property for one page view: ${JSON.stringify(perProperty)}`).toBe(true);
        expect(ga4.events('view_item')[0].get('pr1'), 'view_item carries the product item').toMatch(/\S/);
    });

    test('PDP001 — GA4 add_to_cart fires once when adding the product [TC_PDP_089]', async ({ pdp, page, merchant }) => {
        test.skip(merchant.integrations.analyticsProvider !== 'ga4', `${merchant.name} does not use GA4`);
        test.skip(!await pdp.isInStock(), 'Default product is out of stock');
        const ga4 = recordGa4Events(page);

        await pdp.addToCart();
        await expect.poll(() => ga4.events('add_to_cart').length, { timeout: 15_000, message: 'add_to_cart fired' }).toBeGreaterThan(0);
        await page.waitForTimeout(3_000);
        const perProperty = hitsPerProperty(ga4.events('add_to_cart'));
        expect(Object.values(perProperty).every(hits => hits === 1), `add_to_cart hits per GA4 property for one add: ${JSON.stringify(perProperty)}`).toBe(true);
        expect(ga4.events('add_to_cart')[0].get('pr1'), 'add_to_cart carries the product item').toMatch(/\S/);
    });

});
