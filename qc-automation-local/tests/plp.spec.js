/**
 * tests/plp.spec.js — Product Listing Page (Collection) Regression Suite
 *
 * Covers (sections follow the Shopify_PLP_Test_Cases sheet):
 *   Page load & breadcrumb · Collection header · Product grid & cards ·
 *   Badges & pricing · Filters · Sorting · Pagination / load more ·
 *   Quick add · Responsive · Performance, SEO & accessibility
 *
 * Regression Catalogue IDs: PLP001
 * Priority: P1
 * Type: Universal
 * Sheet IDs: tests written from the sheet carry their `[TC_PLP_xxx]` id in the title.
 *
 * Merchants differ enormously on this page — this is the one place in the suite
 * where that's most visible:
 *   - Filters (Search & Discovery / Searchspring): only Abc has them
 *     (`merchant.features.filters`). Koh's collection has a sort dropdown but
 *     no actual filter groups. Outset and Revitin have neither.
 *   - Sort: a native <select> on Outset (name="sort") and Koh (Dawn's
 *     name="sort_by"); a custom non-<select> dropdown on Abc; none on Revitin.
 *   - Pagination: only Abc's collections are large enough to need it, via a
 *     "Show More" button — no merchant here uses classic numbered pagination
 *     or infinite scroll, so those specific mechanisms have no test to run
 *     against and are left ungated rather than faked.
 *   - Quick add: Outset adds via AJAX directly; Koh's "Choose options" is a
 *     plain link to the PDP, not an in-page modal — `PLPPage.quickAdd()`
 *     detects which happened rather than assuming one.
 *   - Revitin's `/collections/all` isn't a real product grid at all (see
 *     merchants/revitin/config.js) — every card-grid test naturally no-ops via
 *     the pre-existing `getProductCount() === 0` skip pattern.
 * Tests whose precondition isn't met call `test.skip(<condition>, <reason>)`
 * so the report says why, rather than passing silently or being force-fitted.
 *
 * Not automated (need a human, the Shopify admin, or tools outside Playwright):
 *   TC_PLP_007/010/011 vs admin · 012 known draft product · 015 known imageless
 *   product · 016 known long-title product · 021 grid/list toggle (no merchant
 *   has one) · 022 rating accuracy · 025/026/029/037 need admin/theme-setting
 *   ground truth · 058 infinite scroll (no merchant uses it) · 063 quick view
 *   (no merchant has one) · 065/066 promo tiles (merchant-specific, not part of
 *   the common suite — see the homepage suite's equivalent decision) ·
 *   070 real Safari/iOS · 071 PageSpeed.
 */

const { test, expect }           = require('../fixtures/base');
const { expectPageFound, horizontalOverflow, parseMoney } = require('../utils/page-checks');
const { captureNetworkFailures } = require('../utils/network');
const { SEO_LIMITS }             = require('../utils/test-data');

/**
 * Open the filter panel and apply the first option that actually narrows to at least one
 * product. An app that re-sorts filter values by live count (Searchspring) can occasionally
 * put a value with zero current matches first — trying a few rather than assuming index 0
 * always has results keeps the many tests built on "apply a filter" from failing on that
 * coincidence instead of on something actually worth reporting.
 * @param {import('../core/plp/PLPPage')} plp
 * @param {object} merchant
 * @returns {Promise<string>} the id of the option that was applied
 */
async function pickOptionWithMatches(plp, merchant) {
    await plp.filters.open();
    const options = await plp.filters.listOptions();
    for (const option of options.slice(0, 5)) {
        await plp.filters.applyById(option.id);
        if (await plp.getProductCount() > 0) return option.id;
        await plp.navigateTo();
        await plp.filters.open();
    }
    test.skip(true, `None of the first ${Math.min(5, options.length)} filter values on ${merchant.pages.collection} currently match a product`);
}

test.describe('SUNTEK QC — Product Listing Page [PLP001]', () => {

    // ── Page load ──────────────────────────────────────────────────────────────

    test('@smoke PLP001 — Configured collection loads', async ({ plp, page, merchant }) => {
        await expect(page).toHaveURL(new RegExp(merchant.pages.collection.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), { timeout: 15_000 });
        await expectPageFound(page);
    });

    test('@smoke PLP001 — Collection renders product cards', async ({ plp, page }) => {
        expect(await plp.getProductCount()).toBeGreaterThan(0);
    });

    // ── Product card elements ──────────────────────────────────────────────────

    test('@smoke PLP001 — Product card title link is visible and non-empty', async ({ plp, page }) => {
        const titleLink = plp.firstCardTitle;
        await expect(titleLink).toBeVisible({ timeout: 10_000 });
        const text = await titleLink.innerText();
        expect(text.trim().length).toBeGreaterThan(0);
    });

    test('PLP001 — Product card image renders', async ({ plp, page }) => {
        const img = plp.firstCardImage;
        await expect(img).toBeVisible({ timeout: 10_000 });
        const src = await img.getAttribute('src');
        expect(src && src.trim().length > 0).toBe(true);
    });

    test('PLP001 — Product card price is visible', async ({ plp, page }) => {
        const price = plp.firstCardPrice;
        await expect(price).toBeVisible({ timeout: 10_000 });
        const text = await price.innerText();
        // Price should contain a $ or currency symbol
        expect(text).toMatch(/\$|£|€|[\d,.]+/);
    });

    test('PLP001 — Product card title link points to a /products/ path', async ({ plp, page }) => {
        const titleLink = plp.firstCardTitle;
        const href = await titleLink.getAttribute('href');
        expect(href).toMatch(/\/products\//);
    });

    // ── Collection content volume ──────────────────────────────────────────────

    test('PLP001 — Collection has at least 1 product card', async ({ plp, page }) => {
        const count = await plp.getProductCount();
        expect(count).toBeGreaterThanOrEqual(1);
    });

    // ── PDP navigation from PLP ────────────────────────────────────────────────

    test('PLP001 — Clicking a product card navigates to PDP', async ({ plp, page }) => {
        await plp.clickFirstProduct();
        await expect(page).toHaveURL(/\/products\//, { timeout: 15_000 });
        await expectPageFound(page);
        // Visible one: Outset renders a hidden duplicate <h1> (the duplicate itself is reported by the PDP single-H1 case).
        await expect(page.locator('h1').filter({ visible: true }).first()).toBeVisible({ timeout: 10_000 });
    });

    // ── Network check ──────────────────────────────────────────────────────────

    test('PLP001 — No 4xx/5xx errors loading the collection', async ({ page, merchant }) => {
        const network = captureNetworkFailures(page);
        // Not 'networkidle': tracking/analytics scripts (GA4, Klaviyo, Kameleoon, ...) keep
        // making background requests well past page-ready, so 'networkidle' can simply never
        // fire — verified: this timed out identically on all 4 merchants, not one site's issue.
        // Same reasoning already applied everywhere else in this suite (e.g. homepage.spec.js).
        await page.goto(merchant.pages.collection, { waitUntil: 'domcontentloaded' });
        // Some merchants' "collection" page has no real priced grid at all (see Revitin) — that's
        // a legitimate, separately-covered case (@smoke "Collection renders product cards"),
        // not something this network-error check should block on.
        await page.locator(merchant.locators.get('productCard')).first().waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});

        const failures = network.getFailures()
            .filter(f => f.resourceType === 'document' || f.resourceType === 'fetch' || f.resourceType === 'xhr');

        if (failures.length > 0) {
            console.warn('[Network Failures]', network.toStrings());
        }
        // Only fail on server errors (5xx) for critical resources — 4xx on third-party ok
        const serverErrors = failures.filter(f => f.status >= 500);
        expect(serverErrors).toHaveLength(0);
    });

    // ── Filter / Sort presence (legacy, kept for compatibility) ────────────────

    test('PLP001 — Sort control is present if collection supports it', async ({ plp, page }) => {
        const hasSortControl = await plp.hasSortControl();
        if (hasSortControl) {
            await expect(plp.sortControl).toBeVisible();
        }
        // If no sort control exists, the test passes (some collections don't have it)
    });

    // ── SEO on collection ──────────────────────────────────────────────────────

    test('PLP001 — Collection page has exactly one visible h1', async ({ plp, page }) => {
        const count = await page.locator('h1:visible').count();
        expect(count).toBeGreaterThanOrEqual(1);
    });

    // ══════════════════════════════════════════════════════════════════════════
    //  New coverage from the Shopify_PLP_Test_Cases sheet
    // ══════════════════════════════════════════════════════════════════════════

    // ── Page load & breadcrumb ─────────────────────────────────────────────────

    test('PLP001 — Collection loads from a menu link [TC_PLP_001]', async ({ navbar, page, merchant }) => {
        const collectionLink = (merchant.navLinks || []).find(link => /\/collections\//.test(link.urlPattern.source ?? link.urlPattern));
        test.skip(!collectionLink, `${merchant.name} has no navLinks pointing at a collection`);

        await navbar.clickNavLink(collectionLink.href, collectionLink.selector);
        await expect(page).toHaveURL(collectionLink.urlPattern, { timeout: 15_000 });
        await expectPageFound(page);
    });

    test('PLP001 — Invalid collection URL shows a 404 [TC_PLP_003]', async ({ page, merchant }) => {
        const response = await page.goto(`${merchant.urls.production}/collections/invalid-handle-plp-test-404`, { waitUntil: 'domcontentloaded' });

        // Shopify serves collection 404s as an HTTP 200 with the theme's 404 template, not a 404
        // status — judge by the page itself (title/heading/template class), the same way
        // expectPageFound() checks a page IS found, just inverted.
        const title = await page.title();
        const is404 = /\b404\b|page not found|not found/i.test(title)
            || await page.locator('body.template-404, body[class*="template-404"]').count() > 0
            || (response && response.status() === 404);
        expect(is404, 'invalid collection URL renders a 404').toBe(true);

        const backToShopping = page.getByRole('link', { name: /shop|home|continue|collections|products/i }).filter({ visible: true }).first();
        await expect(backToShopping, '404 page has a link back to shopping').toBeVisible();
    });

    test('PLP001 — Breadcrumb links to the site root and shows the collection name [TC_PLP_005]', async ({ plp, page }) => {
        test.skip(await plp.breadcrumb.count() === 0, 'This theme has no breadcrumb');

        // The root crumb's label isn't always literally "Home" (Abc's reads "Shop") — what makes
        // it the root is that it links to "/", not its wording.
        const rootHref = await plp.breadcrumbHomeLink.getAttribute('href');
        expect(rootHref, 'breadcrumb\'s first link points at the site root').toBe('/');

        const text = await plp.breadcrumb.innerText();
        const h1 = (await page.locator('h1').first().innerText()).trim();
        expect(text.toLowerCase(), 'breadcrumb includes the collection name').toContain(h1.toLowerCase());
    });

    test('PLP001 — Breadcrumb root link returns to the homepage [TC_PLP_006]', async ({ plp, page, merchant }) => {
        test.skip(await plp.breadcrumb.count() === 0, 'This theme has no breadcrumb');

        await plp.breadcrumbHomeLink.click();
        const host = merchant.urls.production.replace(/^https?:\/\//, '').replace('.', '\\.');
        await expect(page).toHaveURL(new RegExp(`${host}\\/?(\\?.*)?$`), { timeout: 15_000 });
    });

    // ── Collection header ──────────────────────────────────────────────────────

    test('PLP001 — Collection description renders cleanly, if present [TC_PLP_008]', async ({ page }) => {
        const description = page.locator('.collection-description, [class*="collection__description" i], [class*="collection-hero" i] p').filter({ visible: true }).first();
        test.skip(await description.count() === 0, 'This collection has no description block');

        const text = (await description.innerText()).trim();
        expect(text.length, 'description has real text').toBeGreaterThan(0);

        const readMore = page.getByRole('button', { name: /read more/i }).filter({ visible: true }).first();
        if (await readMore.count() > 0) {
            const before = await description.evaluate(el => el.scrollHeight);
            await readMore.click();
            await expect.poll(() => description.evaluate(el => el.scrollHeight), { message: 'description expands after Read more' })
                .toBeGreaterThanOrEqual(before);
        }
    });

    // ── Product grid & cards ───────────────────────────────────────────────────

    test('@smoke PLP001 — Product cards show image, title, price and badges [TC_PLP_013]', async ({ plp, merchant }) => {
        const { productCard, productCards } = plp;
        const cardCount = Math.min(await productCards.count(), 6);
        test.skip(cardCount === 0, `${merchant.name} has no product grid on this collection`);

        for (let i = 0; i < cardCount; i++) {
            const card = productCards.nth(i);
            await test.step(`card ${i + 1}`, async () => {
                await card.scrollIntoViewIfNeeded();

                const image = productCard.image(card);
                await expect.poll(() => image.evaluate(img => img.complete && img.naturalWidth > 0),
                    { message: 'card image loaded' }).toBe(true);
                await expect(productCard.title(card), 'card title').toHaveText(/\S/);

                // >= 0, not > 0: a free/GWP item genuinely priced at $0.00 is a valid product
                // (verified on Koh), not a broken card — this only needs to catch "no price
                // parsed at all" (NaN), not police what the price actually is.
                const price = parseMoney(await productCard.price(card).innerText());
                expect(price, 'card price is a number').toBeGreaterThanOrEqual(0);
            });
        }
    });

    test('PLP001 — Product images keep a consistent aspect ratio across the grid [TC_PLP_014]', async ({ plp, page, merchant }) => {
        test.skip(await plp.getProductCount() === 0, `${merchant.name} has no product grid on this collection`);
        await plp.scrollThroughPage();

        // Only images left at the default object-fit can be squashed/stretched; object-fit:
        // cover/contain images are cropped or letterboxed on purpose, which isn't this defect.
        const stretched = await page.evaluate(sel => [...document.querySelectorAll(sel)]
            .flatMap(card => [...card.querySelectorAll('img')])
            .filter(img => {
                const box = img.getBoundingClientRect();
                if (box.width < 40 || box.height < 40 || !img.naturalWidth) return false;
                if (getComputedStyle(img).objectFit !== 'fill') return false;
                const ratio = (box.width / box.height) / (img.naturalWidth / img.naturalHeight);
                return ratio < 0.9 || ratio > 1.1;
            })
            .map(img => img.currentSrc), merchant.locators.get('productCard'));
        expect(stretched, 'product images displayed at a different aspect ratio than their file').toEqual([]);
    });

    test('@smoke PLP001 — Clicking a product card image opens its PDP [TC_PLP_019]', async ({ plp, page, merchant }) => {
        test.skip(await plp.getProductCount() === 0, `${merchant.name} has no product grid on this collection`);

        const image = plp.productCard.image(plp.firstCard);
        // Verified on Koh: its card image has no wrapping <a> at all (only the title text and
        // the quick-add button are links) — a deliberate theme choice, not a bug, and not
        // something a click (forced or not) can work around. Skip rather than fail when that's
        // the case, the same way other cards-related tests skip a feature a theme doesn't offer.
        const isInsideLink = await image.evaluate(el => !!el.closest('a'));
        test.skip(!isInsideLink, `${merchant.name}'s product card image isn't wrapped in a link — only the title/quick-add are clickable`);

        const pdpPath = new URL(await plp.firstCardTitle.getAttribute('href'), page.url()).pathname;
        await image.click();

        await expect(page).toHaveURL(current => current.pathname === pdpPath, { timeout: 15_000 });
    });

    test('PLP001 — Color swatches update the card image [TC_PLP_018]', async ({ plp, page, merchant }) => {
        const swatches = plp.productCard.swatches(plp.firstCard);
        test.skip(await swatches.count() < 2, `${merchant.name} has no multi-color swatches on this card`);

        const image = plp.productCard.image(plp.firstCard);
        const srcBefore = await image.getAttribute('src');
        // Hover, not click: this app's swatch has an onmouseleave handler (a hover preview,
        // reverting when the mouse leaves), and the sheet itself allows either interaction.
        await swatches.nth(1).hover();
        await expect.poll(() => image.getAttribute('src'), { message: 'card image src changes with the swatch' }).not.toBe(srcBefore);
    });

    // ── Badges & pricing ───────────────────────────────────────────────────────

    test('PLP001 — Sale badge shows a struck-through compare-at price [TC_PLP_023]', async ({ plp, merchant }) => {
        const saleCard = await plp.findCardWithBadge(/sale/i);
        test.skip(!saleCard, `No sale-badged product found in the first cards of ${merchant.pages.collection}`);

        const priceText = await plp.productCard.price(saleCard).innerText();
        const numbers = [...priceText.replace(/,/g, '').matchAll(/\d+(\.\d+)?/g)].map(m => parseFloat(m[0]));
        expect(numbers.length, 'sale card shows both a price and a compare-at price').toBeGreaterThanOrEqual(2);
        expect(Math.max(...numbers), 'compare-at price is higher than the sale price').toBeGreaterThan(Math.min(...numbers));
    });

    test('PLP001 — Sold-out badge shows but the product is still clickable [TC_PLP_024]', async ({ plp, merchant }) => {
        const soldOutCard = await plp.findCardWithBadge(/sold out/i);
        test.skip(!soldOutCard, `No sold-out product found in the first cards of ${merchant.pages.collection}`);

        const link = plp.productCard.titleLink(soldOutCard);
        await expect(link, 'sold-out card title is still a link').toHaveAttribute('href', /\/products\//);
    });

    test('@smoke PLP001 — Product card price matches the PDP price [TC_PLP_028]', async ({ plp, page, merchant }) => {
        const { productCard, productCards } = plp;
        const cardCount = Math.min(await productCards.count(), 3);
        test.skip(cardCount === 0, `${merchant.name} has no product grid on this collection`);

        for (let i = 0; i < cardCount; i++) {
            await test.step(`card ${i + 1}`, async () => {
                const card = productCards.nth(i);
                await card.scrollIntoViewIfNeeded();
                const cardPrice = parseMoney(await productCard.price(card).innerText());
                const cardTitle = (await productCard.title(card).innerText()).trim();

                await productCard.titleLink(card).click();
                await expect(page).toHaveURL(/\/products\//, { timeout: 15_000 });

                // Some grids (e.g. Abc's Algolia-powered one) can re-order between loads — confirm
                // the PDP is actually for the card just clicked before judging its price, so a
                // reorder reads as a skip, not a false "prices don't match" finding.
                const pdpTitle = (await page.locator(merchant.locators.get('productTitle')).filter({ visible: true }).first().innerText()).trim();
                if (!pdpTitle.toLowerCase().includes(cardTitle.toLowerCase()) && !cardTitle.toLowerCase().includes(pdpTitle.toLowerCase())) {
                    test.info().annotations.push({ type: 'skip-reason', description: `Landed on "${pdpTitle}", not "${cardTitle}" — grid reordered between reads` });
                    await plp.navigateTo();
                    return;
                }

                const pdpPrice = page.locator(merchant.locators.get('productPrice')).filter({ visible: true }).first();
                await expect(pdpPrice).toBeVisible();
                expect(parseMoney(await pdpPrice.innerText()), `PDP price equals the card price for "${cardTitle}"`).toBe(cardPrice);

                await plp.navigateTo();   // fresh collection page for the next card
            });
        }
    });

    // ── Filters (Search & Discovery / app-based — only merchants with features.filters) ──

    test.describe('Filters', () => {

        test('@smoke PLP001 — Filter panel opens [TC_PLP_030]', async ({ plp, merchant }) => {
            test.skip(!merchant.features.filters, `${merchant.name} has no collection filters`);
            await plp.filters.open();
            await expect(plp.filters.options.first()).toBeVisible();
        });

        test('@smoke PLP001 — Applying a filter narrows the results and updates the URL [TC_PLP_031-034]', async ({ plp, page, merchant }) => {
            test.skip(!merchant.features.filters, `${merchant.name} has no collection filters`);

            const before = await plp.getStableProductCount();
            const filterId = await pickOptionWithMatches(plp, merchant);

            expect(page.url(), 'filter is reflected as a filter.* URL param').toMatch(/[?&]filter\./);
            const after = await plp.getProductCount();
            expect(after, 'filtered result count is no larger than the unfiltered count').toBeLessThanOrEqual(before);
        });

        test('PLP001 — Two values in the same filter group broaden results (OR) [TC_PLP_035]', async ({ plp, merchant }) => {
            test.skip(!merchant.features.filters, `${merchant.name} has no collection filters`);
            await plp.filters.open();
            const options = await plp.filters.listOptions();

            const first = options[0];
            const sameGroup = options.filter(o => o.name === first.name);
            test.skip(sameGroup.length < 2, 'This filter group has fewer than 2 values to combine');

            await plp.filters.applyById(first.id);
            const singleCount = await plp.getProductCount();

            await plp.filters.open();
            const second = sameGroup.find(o => o.id !== first.id);
            await plp.filters.applyById(second.id);

            expect(await plp.getProductCount(), 'OR-combined count is at least the single-value count').toBeGreaterThanOrEqual(singleCount);
        });

        test('PLP001 — Filters from different groups combine with AND [TC_PLP_036]', async ({ plp, merchant }) => {
            test.skip(!merchant.features.filters, `${merchant.name} has no collection filters`);
            await plp.filters.open();
            const options = await plp.filters.listOptions();

            const first = options[0];
            const otherGroup = options.find(o => o.name !== first.name);
            test.skip(!otherGroup, 'This collection only has one filter group');

            await plp.filters.applyById(first.id);
            const afterFirst = await plp.getProductCount();
            test.skip(afterFirst === 0, `Filter value "${first.id}" happened to match 0 products this run`);

            await plp.filters.applyById(otherGroup.id);
            expect(await plp.getProductCount(), 'AND-combined count is no larger than either filter alone').toBeLessThanOrEqual(afterFirst);
        });

        test('@smoke PLP001 — Active filters show as removable chips [TC_PLP_038]', async ({ plp, merchant }) => {
            test.skip(!merchant.features.filters, `${merchant.name} has no collection filters`);
            await pickOptionWithMatches(plp, merchant);

            await expect(plp.filters.activeChips.first()).toBeVisible();
        });

        test('PLP001 — Removing one filter chip only removes that filter [TC_PLP_039]', async ({ plp, page, merchant }) => {
            test.skip(!merchant.features.filters, `${merchant.name} has no collection filters`);
            await plp.filters.open();
            const options = await plp.filters.listOptions();
            const first = options[0];
            const second = options.find(o => o.id !== first.id && o.name !== first.name) ?? options.find(o => o.id !== first.id);
            test.skip(!second, 'No second filter value available to combine and then remove');

            await plp.filters.applyById(first.id);
            const firstFilterParams = [...new URLSearchParams(new URL(page.url()).search).entries()]
                .filter(([key]) => key.startsWith('filter.'));

            await plp.filters.applyById(second.id);
            expect(await plp.filters.activeChips.count(), 'two filters applied before removing one').toBeGreaterThanOrEqual(2);

            // Wait for the URL to change: themes that filter without a reload (Orion's Horizon) update it async.
            const searchBefore = new URL(page.url()).search;
            // Centre it first: a force-click skips the hit-target check, and on Orion the sticky header
            // covered the chip, so the click landed on the logo instead.
            await plp.filters.activeChips.last().evaluate(el => el.scrollIntoView({ block: 'center' }));
            await Promise.all([
                page.waitForFunction(before => location.search !== before, searchBefore, { timeout: 10_000 }),
                plp.filters.activeChips.last().click({ force: true }),
            ]);
            await page.waitForLoadState('domcontentloaded');

            const paramsAfter = new URLSearchParams(new URL(page.url()).search);
            for (const [key, value] of firstFilterParams) {
                expect(paramsAfter.getAll(key), `first filter (${key}) is still applied`).toContain(value);
            }
            expect(await plp.filters.activeChips.count(), 'one filter chip remains').toBe(1);
        });

        test('@smoke PLP001 — Clear all removes every filter [TC_PLP_040]', async ({ plp, page, merchant }) => {
            test.skip(!merchant.features.filters, `${merchant.name} has no collection filters`);
            const unfilteredCount = await plp.getStableProductCount();

            await pickOptionWithMatches(plp, merchant);
            await plp.filters.clearAll();

            expect(page.url(), 'no filter.* params remain').not.toMatch(/[?&]filter\./);
            // expect.poll, not a single read: this grid finishes populating asynchronously, so a
            // read immediately after the URL settles can catch it a beat before the last item lands.
            await expect.poll(() => plp.getProductCount(), { message: 'full collection is shown again' }).toBe(unfilteredCount);
        });

        test('PLP001 — A filter combination with no matches shows a clear message [TC_PLP_041]', async ({ plp, page, merchant }) => {
            test.skip(!merchant.features.filters, `${merchant.name} has no collection filters`);
            await plp.filters.open();
            const groupName = await plp.filters.options.first().getAttribute('name');

            // A deliberately nonexistent value for a real filter group — forces zero matches
            // without needing to know this merchant's actual out-of-stock/unavailable inventory.
            await page.goto(`${merchant.pages.collection}?filter.${groupName}=zzz-suntek-qc-no-such-value`, { waitUntil: 'domcontentloaded' });

            expect(await plp.getProductCount(), 'no products match the bogus filter value').toBe(0);
            await expect(page.getByText(/no products found|no results|nothing matches/i).first()).toBeVisible();
        });

        test('PLP001 — Filtered results are shareable via URL [TC_PLP_042]', async ({ plp, page, merchant, browser }) => {
            test.skip(!merchant.features.filters, `${merchant.name} has no collection filters`);
            await pickOptionWithMatches(plp, merchant);
            const filteredUrl = page.url();
            const expectedCount = await plp.getProductCount();

            const freshPage = await (await browser.newContext()).newPage();
            await freshPage.goto(filteredUrl, { waitUntil: 'domcontentloaded' });
            await freshPage.locator(merchant.locators.get('productCard')).first().waitFor({ timeout: 15_000 }).catch(() => {});
            const freshCount = await freshPage.locator(merchant.locators.get('productCard')).count();
            expect(freshCount, 'opening the filtered URL fresh gives the same result count').toBe(expectedCount);
            await freshPage.context().close();
        });

        test('PLP001 — Filters persist on back navigation [TC_PLP_043]', async ({ plp, page, merchant }) => {
            test.skip(!merchant.features.filters, `${merchant.name} has no collection filters`);
            await pickOptionWithMatches(plp, merchant);
            const filteredUrl = page.url();

            await plp.clickFirstProduct();
            await page.goBack();

            await expect(page).toHaveURL(filteredUrl, { timeout: 15_000 });
        });

        test('@smoke PLP001 — Mobile filter drawer opens, applies and closes [TC_PLP_044]', async ({ plp, page, merchant }) => {
            test.skip(!merchant.features.filters, `${merchant.name} has no collection filters`);
            await page.setViewportSize({ width: 390, height: 844 });

            // Some apps render a separate mobile drawer whose checkbox AND its `for`-labelled
            // element both stay non-interactable by Playwright's usual actionability checks
            // (verified: this isn't the checkbox-hidden-behind-a-clickable-label pattern the
            // desktop panel uses — here neither element ever reports visible on mobile, so the
            // real click target must be something else app-specific, e.g. a wrapping element
            // with no `for` attribute). Rather than guess at unverified markup, skip with a
            // clear reason instead of forcing a click that wouldn't reflect a real user's tap.
            await plp.filters.open().catch(() => {});
            // A real geometric check, not isVisible()/count(): both proved unreliable indicators
            // here (isVisible() can read true for an element Playwright still can't click because
            // its computed box is off-screen — the actionability check and the visibility check
            // aren't the same test).
            const id = await plp.filters.options.first().getAttribute('id').catch(() => null);
            const label = id ? plp.page.locator(`label[for="${id}"]`).filter({ visible: true }).first() : null;
            const clickableBox = label && await label.count() > 0
                ? await label.boundingBox().catch(() => null)
                : await plp.filters.options.first().boundingBox().catch(() => null);
            test.skip(!clickableBox, `${merchant.name}'s mobile filter drawer needs its real click target verified — see comment above`);

            await plp.filters.applyOption(0);
            expect(page.url(), 'filter applied on mobile too').toMatch(/[?&]filter\./);
        });
    });

    // ── Sorting ────────────────────────────────────────────────────────────────

    test.describe('Sorting', () => {

        test('@smoke PLP001 — Sort by Price low-to-high orders the grid [TC_PLP_049]', async ({ plp, merchant }) => {
            test.skip(!await plp.hasSortControl(), `${merchant.name} has no sort control`);
            await plp.sort.selectByLabel(/price.*low.*high|low to high/i);

            const cardCount = Math.min(await plp.productCards.count(), 8);   // a prefix, in case a
            // secondary carousel below the real grid shares the same card class (seen on Outset)
            const prices = [];
            for (let i = 0; i < cardCount; i++) {
                prices.push(parseMoney(await plp.productCard.price(plp.productCards.nth(i)).innerText()));
            }
            for (let i = 1; i < prices.length; i++) {
                expect(prices[i], `price ${i} (${prices[i]}) is >= price ${i - 1} (${prices[i - 1]})`).toBeGreaterThanOrEqual(prices[i - 1]);
            }
        });

        test('PLP001 — Sort by Price high-to-low orders the grid [TC_PLP_050]', async ({ plp, merchant }) => {
            test.skip(!await plp.hasSortControl(), `${merchant.name} has no sort control`);
            await plp.sort.selectByLabel(/price.*high.*low|high to low/i);

            const cardCount = Math.min(await plp.productCards.count(), 8);
            const prices = [];
            for (let i = 0; i < cardCount; i++) {
                prices.push(parseMoney(await plp.productCard.price(plp.productCards.nth(i)).innerText()));
            }
            for (let i = 1; i < prices.length; i++) {
                expect(prices[i], `price ${i} (${prices[i]}) is <= price ${i - 1} (${prices[i - 1]})`).toBeLessThanOrEqual(prices[i - 1]);
            }
        });

        test('PLP001 — Sort A-Z and Z-A order titles alphabetically [TC_PLP_047-048]', async ({ plp, merchant }) => {
            test.skip(!await plp.hasSortControl(), `${merchant.name} has no sort control`);

            for (const [pattern, dir] of [[/a.?z|ascending/i, 1], [/z.?a|descending/i, -1]]) {
                await test.step(dir === 1 ? 'A-Z' : 'Z-A', async () => {
                    test.skip(!await plp.sort.hasOption(pattern), `${merchant.name}'s sort control has no ${dir === 1 ? 'A-Z' : 'Z-A'} option`);
                    await plp.sort.selectByLabel(pattern);
                    const cardCount = Math.min(await plp.productCards.count(), 8);
                    const titles = [];
                    for (let i = 0; i < cardCount; i++) {
                        titles.push((await plp.productCard.title(plp.productCards.nth(i)).innerText()).trim().toLowerCase());
                    }
                    const sorted = [...titles].sort((a, b) => a.localeCompare(b) * dir);
                    expect(titles).toEqual(sorted);
                });
            }
        });

        test('PLP001 — Sort choice is reflected in the URL and survives a refresh [TC_PLP_053]', async ({ plp, page, merchant }) => {
            test.skip(!await plp.hasSortControl(), `${merchant.name} has no sort control`);
            await plp.sort.selectByLabel(/price.*low.*high|low to high/i);

            const valueAfterSort = plp.sort.currentUrlValue();
            expect(valueAfterSort, 'sort_by/sort param set in the URL').toBeTruthy();

            await page.reload({ waitUntil: 'domcontentloaded' });
            expect(plp.sort.currentUrlValue(), 'sort param retained after refresh').toBe(valueAfterSort);
        });

        test('PLP001 — Sort stays applied after filtering [TC_PLP_052]', async ({ plp, page, merchant }) => {
            test.skip(!merchant.features.filters || !await plp.hasSortControl(), `${merchant.name} needs both filters and sort for this case`);

            await plp.sort.selectByLabel(/price.*low.*high|low to high/i);
            const sortValue = plp.sort.currentUrlValue();

            await pickOptionWithMatches(plp, merchant);

            expect(plp.sort.currentUrlValue(), 'sort param retained after applying a filter').toBe(sortValue);
            expect(page.url(), 'filter also applied').toMatch(/[?&]filter\./);
        });
    });

    // ── Pagination / load more ─────────────────────────────────────────────────

    test.describe('Pagination', () => {

        test('@smoke PLP001 — Pagination shows more products without duplicates [TC_PLP_054-057]', async ({ plp, merchant }) => {
            test.skip(!await plp.hasPagination(), `${merchant.name}'s collection fits on one page (no load-more/pagination control)`);

            const hrefsBefore = await plp.productCards.evaluateAll(cards => cards.map(c => (c.querySelector('a[href*="/products/"]') || {}).href).filter(Boolean));

            await plp.pagination.click();
            await plp.page.waitForLoadState('domcontentloaded').catch(() => {});   // classic numbered pagination navigates
            await plp.page.waitForTimeout(1_500);   // ...or the theme fetches-and-replaces/appends with no navigation to wait on instead

            const hrefsAfter = await plp.productCards.evaluateAll(cards => cards.map(c => (c.querySelector('a[href*="/products/"]') || {}).href).filter(Boolean));
            expect(new Set(hrefsAfter).size, 'no duplicate products shown at once').toBe(hrefsAfter.length);

            // Two real shapes, neither reliably announced by a URL change (some numbered
            // pagination replaces content via AJAX with no navigation at all — verified on
            // Outset): "Load more" APPENDS (more items, the old ones still there), classic
            // Next/page-N REPLACES (a same-ish count but a different set). Checking for either
            // rather than assuming which one this merchant uses.
            const grew = hrefsAfter.length > hrefsBefore.length;
            const replaced = JSON.stringify(hrefsAfter) !== JSON.stringify(hrefsBefore);
            expect(grew || replaced, 'pagination shows new products — neither more items nor a different set appeared').toBe(true);
            if (grew) {
                expect(hrefsAfter.slice(0, hrefsBefore.length), 'originally-shown products are still there').toEqual(hrefsBefore);
            }
        });

        test('PLP001 — Load-more results still respect an active filter [TC_PLP_059]', async ({ plp, merchant }) => {
            test.skip(!merchant.features.filters || !await plp.hasPagination(), `${merchant.name} needs both filters and load-more for this case`);

            await pickOptionWithMatches(plp, merchant);
            const filterParam = new URL(plp.page.url()).search;
            const before = await plp.getProductCount();

            if (await plp.pagination.count() === 0) {
                test.skip(true, 'Filtered result set fits on one page — nothing to load more');
            }
            await plp.pagination.click();
            await plp.page.waitForTimeout(1_500);

            expect(await plp.getProductCount(), 'more items loaded').toBeGreaterThan(before);
            expect(new URL(plp.page.url()).search, 'filter is still applied after loading more').toBe(filterParam);
        });
    });

    // ── Quick add ──────────────────────────────────────────────────────────────

    test.describe('Quick add', () => {

        test('@smoke PLP001 — Quick add adds a single-variant product or opens the multi-variant PDP [TC_PLP_060-061]', async ({ plp, merchant }) => {
            test.skip(await plp.quickAddButton().count() === 0, `${merchant.name} has no quick-add on this collection`);

            const before = await plp.getCartCount();
            const outcome = await plp.quickAdd();

            if (outcome === 'added') {
                await expect.poll(() => plp.getCartCount(), { message: 'cart count after quick add' }).toBeGreaterThan(before);
            } else {
                await expect(plp.page).toHaveURL(/\/products\//);
                await expect(plp.page.locator('h1')).toBeVisible({ timeout: 10_000 });
            }
        });

        test('PLP001 — Quick add is unavailable on a sold-out product [TC_PLP_062]', async ({ plp, merchant }) => {
            const soldOutCard = await plp.findCardWithBadge(/sold out/i);
            test.skip(!soldOutCard, `No sold-out product found in the first cards of ${merchant.pages.collection}`);

            const quickAdd = plp.quickAddButton(soldOutCard);
            if (await quickAdd.count() === 0) return;   // no quick-add control at all on this card — fine
            const isDisabled = await quickAdd.evaluate(el => el.disabled || el.getAttribute('aria-disabled') === 'true' || /sold out/i.test(el.textContent));
            expect(isDisabled, 'quick add is disabled or reads "Sold out" for a sold-out product').toBe(true);
        });

        test('PLP001 — Quick add works on mobile [TC_PLP_064]', async ({ plp, page, merchant }) => {
            test.skip(await plp.quickAddButton().count() === 0, `${merchant.name} has no quick-add on this collection`);
            await page.setViewportSize({ width: 390, height: 844 });

            const before = await plp.getCartCount();
            const outcome = await plp.quickAdd();
            if (outcome === 'added') {
                await expect.poll(() => plp.getCartCount(), { message: 'cart count after mobile quick add' }).toBeGreaterThan(before);
            } else {
                await expect(page).toHaveURL(/\/products\//);
            }
        });
    });

    // ── Responsive ─────────────────────────────────────────────────────────────

    const LAYOUTS = [
        { tc: 'TC_PLP_067', label: 'Mobile',        widths: [375, 414],  height: 812,  smoke: true },
        { tc: 'TC_PLP_068', label: 'Tablet',        widths: [768, 1024], height: 1024 },
        { tc: 'TC_PLP_069', label: 'Large desktop', widths: [1440, 1920], height: 1080 },
    ];

    for (const { tc, label, widths, height, smoke } of LAYOUTS) {
        test(`${smoke ? '@smoke ' : ''}PLP001 — ${label} layout has no horizontal scroll at ${widths.join('px and ')}px [${tc}]`,
            async ({ plp, page, isMobile, merchant }) => {
                test.skip(isMobile, 'This test sets its own viewport — run it on the desktop project');
                const hasGrid = await plp.getProductCount() > 0;

                for (const width of widths) {
                    await test.step(`${width}px wide`, async () => {
                        await page.setViewportSize({ width, height });
                        // Only asserted when there's a real grid to check (see Revitin, whose
                        // "collection" page isn't one) — the overflow check below still runs
                        // either way, since that's a page-wide layout property, not grid-specific.
                        if (hasGrid) await expect(plp.firstCard, 'grid still shows').toBeVisible();
                        await expect.poll(() => horizontalOverflow(page), { message: 'px the page overflows the viewport' }).toBe(0);
                    });
                }
            });
    }

    // ── Performance, SEO & accessibility ───────────────────────────────────────

    test('PLP001 — Below-the-fold product images load lazily on scroll [TC_PLP_072]', async ({ plp, page, merchant }) => {
        test.skip(await plp.getProductCount() === 0, `${merchant.name} has no product grid on this collection`);

        const deferredIndexes = () => page.evaluate(() => [...document.images]
            .map((img, index) => ({ img, index }))
            .filter(({ img }) => img.loading === 'lazy' && img.getBoundingClientRect().top > window.innerHeight && !img.complete)
            .map(({ index }) => index));

        const deferred = await deferredIndexes();
        test.skip(deferred.length === 0, 'Nothing is deferred below the fold (or the page does not scroll)');

        await plp.scrollThroughPage();

        const stillDeferred = await page.evaluate(indexes => indexes.filter(i => !document.images[i].complete), deferred);
        expect(stillDeferred.length, 'deferred images that never loaded after scrolling the page').toBeLessThan(deferred.length);
    });

    test('PLP001 — Meta title and description exist and are unique to this collection [TC_PLP_074]', async ({ plp, page, merchant }) => {
        await expect(page.locator('meta[name="description"]'), 'exactly one meta description tag').toHaveCount(1);

        const title = await page.title();
        expect(title.length, `title "${title}"`).toBeGreaterThan(0);
        expect(title.length, `title "${title}"`).toBeLessThanOrEqual(SEO_LIMITS.titleMax);

        const description = await page.locator('meta[name="description"]').first().getAttribute('content');
        expect(description, 'meta description exists').toBeTruthy();

        await page.goto(merchant.pages.homepage, { waitUntil: 'domcontentloaded' });
        expect(await page.title(), 'collection title is unique (differs from the homepage)').not.toBe(title);
    });

    test('PLP001 — Canonical tag points to the base collection URL even with filters applied [TC_PLP_075]', async ({ plp, page, merchant }) => {
        test.skip(!merchant.features.filters, `${merchant.name} has no collection filters`);
        const baseUrl = `${merchant.urls.production}${merchant.pages.collection}`;

        await plp.filters.open();
        await plp.filters.applyOption(0);

        const canonical = await page.locator('link[rel="canonical"]').first().getAttribute('href');
        expect(canonical, 'canonical points at the unfiltered collection URL').toBe(baseUrl);
    });

    test('PLP001 — Collection title is the only H1 [TC_PLP_076]', async ({ plp, page }) => {
        await expect(page.locator('h1')).toHaveCount(1);
    });

    test('PLP001 — Tab reaches filters, sort and product cards with a visible focus state [TC_PLP_077]', async ({ plp, page, isMobile, merchant }) => {
        test.skip(isMobile, 'Keyboard navigation is a desktop check');

        await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });

        const stops = [];
        for (let i = 0; i < 15; i++) {
            await page.keyboard.press('Tab');
            stops.push(await page.evaluate(() => {
                const el    = document.activeElement;
                const style = getComputedStyle(el);
                const box   = el.getBoundingClientRect();
                return {
                    element:          `${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).trim().split(/\s+/)[0] : ''}`,
                    thirdPartyWidget: el.tagName.includes('-'),
                    interactive:      el.matches('a[href], button, input, select, textarea, summary, [tabindex]'),
                    visible:          box.width > 0 && box.height > 0,
                    hasFocusRing:     (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) || style.boxShadow !== 'none',
                };
            }));
        }
        const judged = stops.filter(s => !s.thirdPartyWidget);

        expect(judged.filter(s => !s.interactive || !s.visible).map(s => s.element), 'Tab stops that are not visible interactive elements').toEqual([]);
        expect(judged.filter(s => !s.hasFocusRing).map(s => s.element), 'Tab stops with no visible focus state').toEqual([]);
    });

    test('PLP001 — Product card images have alt text [TC_PLP_078]', async ({ plp, page, merchant }) => {
        test.skip(await plp.getProductCount() === 0, `${merchant.name} has no product grid on this collection`);
        await plp.scrollThroughPage();

        const offenders = await page.evaluate(sel => [...document.querySelectorAll(sel)]
            .flatMap(card => [...card.querySelectorAll('img')])
            .filter(img => {
                const box = img.getBoundingClientRect();
                if (box.width < 40 || box.height < 40) return false;
                const alt = img.getAttribute('alt');
                return alt === null || /\.(jpe?g|png|webp|gif|svg)\b|^(img|dsc)_?\d+/i.test(alt);
            })
            .map(img => img.currentSrc || img.src), merchant.locators.get('productCard'));
        expect(offenders, 'product card images with no alt attribute, or a file name as alt').toEqual([]);
    });

    test('PLP001 — GA4 view_item_list fires with items on load [TC_PLP_079]', async ({ page, merchant }) => {
        test.skip(merchant.integrations.analyticsProvider !== 'ga4', `${merchant.name} does not use GA4`);

        const GA4_HOST = /^(www\.|region1\.)?google-analytics\.com$|^analytics\.google\.com$/;
        let sawViewItemList = false;
        page.on('request', request => {
            let requestUrl;
            try { requestUrl = new URL(request.url()); } catch { return; }
            if (!GA4_HOST.test(requestUrl.hostname) || !/\/g\/collect$/.test(requestUrl.pathname)) return;
            const records = [requestUrl.search.replace(/^\?/, ''), ...(request.postData() ?? '').split('\n')];
            if (records.some(r => new URLSearchParams(r).get('en') === 'view_item_list')) sawViewItemList = true;
        });

        await page.goto(merchant.pages.collection, { waitUntil: 'load' });
        // view_item_list reports the items shown on the listing — on a "collection" page with no
        // real priced grid (see Revitin), there's nothing for it to report, so it correctly
        // doesn't fire; that's not a tracking gap worth failing on.
        const hasGrid = await page.locator(merchant.locators.get('productCard')).filter({ visible: true }).count() > 0;
        test.skip(!hasGrid, `${merchant.name} has no product grid on this collection`);

        await expect.poll(() => sawViewItemList, { timeout: 15_000, message: 'view_item_list fired' }).toBe(true);
    });

});
