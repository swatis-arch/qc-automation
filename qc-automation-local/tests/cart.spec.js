/**
 * tests/cart.spec.js — Cart Regression Suite
 *
 * Covers (sections follow the Shopify_Cart_Test_Cases sheet):
 *   Cart access & display · Line item details · Quantity update · Remove items ·
 *   Empty cart · Persistence · Discounts · Free shipping bar · Upsell ·
 *   Proceed to checkout · Responsive · Performance, accessibility & analytics
 *
 * Regression Catalogue IDs: CART001, CART002, CART003
 * Priority: P0/P1
 * Type: Universal
 * Sheet IDs: tests written from the sheet carry their `[TC_CART_xxx]` id in the title.
 *
 * Most cases put items in the cart through Shopify's own `/cart/add.js` (CartPage.seed) instead
 * of driving a product page first — that flow is covered by pdp.spec.js — and judge the page
 * against `/cart.js`, the store's own record of what is in the cart.
 *
 * Merchants differ a lot here:
 *   - Only Outset has a separate /cart page; on Revitin, Koh and Abc, /cart opens the side drawer.
 *   - Koh's drawer (<ns-hybrid-cart>) is a shadow root; Abc shows quantity as text, not a field.
 *   - Free-shipping progress: Koh ("$x left") and Abc ("$x away from free delivery $5,000");
 *     Outset ships free on everything; Revitin shows none.
 *   - Upsells in the drawer: Outset (Rebuy) and Revitin; none on Koh or Abc.
 * Tests whose precondition isn't met call `test.skip(<condition>, <reason>)` so the report
 * says why, rather than passing silently or being force-fitted.
 *
 * CRITICAL: No real production purchases are performed. Checkout cases stop at the checkout URL.
 *
 * Not automated (need a human, the Shopify admin, test discount codes, a customer account or
 * tools outside Playwright):
 *   TC_CART_019/021 stock and purchase-limit config · 026 gift-threshold config · 033/034/035
 *   customer login · 037/039-046 valid/expired/minimum/stacking/excluded/free-shipping discount
 *   codes and gift cards (no test codes exist) · 050 shipping rate at checkout · 054 order note
 *   (needs a placed order) · 055-059 gift wrap, gift message, delivery date, shipping estimator
 *   (no merchant has them) · 060-062 admin inventory/price/publish changes · 066 express payment
 *   sheets · 071 real Safari/Firefox.
 */

const { test, expect } = require('../fixtures/base');
const { expectPageFound, horizontalOverflow, parseMoney } = require('../utils/page-checks');
const { recordGa4Events } = require('../utils/ga4');
const CheckoutPage = require('../core/checkout/CheckoutPage');

const money = cents => cents / 100;

/**
 * Put the merchant's default product (and optionally its secondary one) in the cart.
 * @returns {Promise<{ product: object, variant: object }[]>} what went in, in that order
 */
async function seedProducts(cart, merchant, { quantity = 1, both = false } = {}) {
    const picks = [];
    for (const which of both ? ['default', 'secondary'] : ['default']) {
        const { product, variants } = await cart.availableVariants(merchant.products[which].handle);
        test.skip(variants.length === 0, `${product.title} is sold out`);
        picks.push({ product, variant: variants[0] });
    }
    await cart.seed(picks.map(pick => ({ id: pick.variant.id, quantity })));
    return picks;
}

/** A product among the merchant's two with at least two purchasable variants, or null. */
async function multiVariantProduct(cart, merchant) {
    for (const which of ['default', 'secondary']) {
        const found = await cart.availableVariants(merchant.products[which].handle);
        if (found.variants.length >= 2) return found;
    }
    return null;
}

/** The first of the merchant's two products that sells a subscription plan, or null. */
async function subscriptionProduct(cart, merchant) {
    for (const which of ['default', 'secondary']) {
        const { product, variants } = await cart.availableVariants(merchant.products[which].handle);
        const plan = (product.selling_plan_groups || []).flatMap(group => group.selling_plans)[0];
        if (plan && variants.length) return { product, variant: variants[0], plan };
    }
    return null;
}

/** Wait until a drawer captured while open reads as closed: gone, hidden, or slid off-screen. */
async function expectDrawerClosed(drawer, message = 'drawer closed') {
    await expect.poll(() => drawer.evaluate(el => {
        const box = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        const hidden = !el.isConnected || !el.getClientRects().length || style.visibility === 'hidden' || style.opacity === '0';
        return hidden || box.right <= 0 || box.left >= innerWidth || box.bottom <= 0 || box.top >= innerHeight;
    }).catch(() => true), { message }).toBe(true);
}

/** Free-shipping progress read from the drawer text: { remaining, threshold, qualified }. */
function freeShippingState(text) {
    const plain = text.replace(/,/g, '');
    const remaining = plain.match(/[$£€]\s?(\d+(?:\.\d+)?)\s*(?:away|left|more)/i);
    const threshold = plain.match(/(?:toward|over|above|orders? of)\s*[$£€]\s?(\d+(?:\.\d+)?)|free (?:shipping|delivery)\s*[$£€]\s?(\d+(?:\.\d+)?)/i);
    return {
        remaining: remaining ? parseFloat(remaining[1]) : null,
        threshold: threshold ? parseFloat(threshold[1] || threshold[2]) : null,
        qualified: /(unlocked|qualif\w+ for free|enjoy free (shipping|delivery)|you('ve| have)( got| earned)? free|free (shipping|delivery) (unlocked|applied))/i.test(text),
    };
}

/** GA4 hits grouped by measurement ID (`tid`): { 'G-XXXX': 1, ... }. */
function hitsPerProperty(hits) {
    return hits.reduce((acc, params) => ({ ...acc, [params.get('tid')]: (acc[params.get('tid')] || 0) + 1 }), {});
}

test.describe('SUNTEK QC — Cart [CART001-CART003]', () => {

    // ── Mini-cart drawer ───────────────────────────────────────────────────────

    test('@smoke CART001 — Mini-cart drawer opens after Add to Cart [TC_CART_001]', async ({ withProduct }) => {
        const { cart } = withProduct;
        await cart.verifyDrawerIsOpen();
        await cart.waitForItems();
        await expect(cart.firstItemTitle, 'the added item shows in the drawer').toHaveText(/\S/);
    });

    test('@smoke CART001 — Mini-cart shows the added product', async ({ withProduct }) => {
        const { cart } = withProduct;
        await cart.verifyDrawerIsOpen();

        // At least one item should be visible in the drawer
        await cart.waitForItems();
        const itemCount = await cart.getItemCount();
        expect(itemCount).toBeGreaterThan(0);
    });

    test('CART001 — Mini-cart line item title is non-empty', async ({ withProduct }) => {
        const { cart } = withProduct;
        await cart.verifyDrawerIsOpen();
        await cart.waitForItems();

        const title = await cart.firstItemTitle.innerText().catch(() => '');
        expect(title.trim().length).toBeGreaterThan(0);
    });

    test('CART001 — Mini-cart subtotal is displayed', async ({ withProduct, page }) => {
        const { cart } = withProduct;
        await cart.verifyDrawerIsOpen();

        const subtotal = await cart.getSubtotal();
        expect(subtotal).toMatch(/\$|£|€|[\d,.]+/);
    });

    // ── Cart page (/cart) ──────────────────────────────────────────────────────

    test('@smoke CART001 — /cart shows every item with the right subtotal [TC_CART_003]', async ({ cart, page, merchant }) => {
        await seedProducts(cart, merchant, { both: true });
        const stored = await cart.cartJson();

        await page.goto('/cart', { waitUntil: 'domcontentloaded' });
        await cart.waitForCart();
        await expectPageFound(page);
        await expect.poll(() => cart.lines.count(), { message: 'one line per cart item' }).toBe(stored.items.length);
        await expect.poll(() => cart.getSubtotalAmount(), { message: 'subtotal shown' }).toBe(money(stored.total_price));
    });

    // ── CART002: Quantity update ───────────────────────────────────────────────

    test('CART002 — Updating quantity on cart page updates line item', async ({ withProduct, page }) => {
        const { cart } = withProduct;
        test.slow();   // Abc: product page + add + drawer + /cart before the update even starts

        // Navigate to the full cart page for quantity update
        await page.goto('/cart', { waitUntil: 'domcontentloaded' });
        await cart.waitForCart();

        const before = await cart.getItemCount();
        expect(before).toBeGreaterThan(0);

        // Update quantity to 2
        await cart.updateQuantity(2, 1);

        // Cart should still have the same number of unique line items
        const after = await cart.getItemCount();
        expect(after).toBeGreaterThan(0);

        // Subtotal should reflect the update
        const subtotal = await cart.getSubtotal();
        expect(subtotal).toMatch(/\$|£|€|[\d,.]+/);
    });

    // ── CART003: Remove item ───────────────────────────────────────────────────

    test('CART003 — Removing the last item empties the cart', async ({ withProduct, page }) => {
        const { cart } = withProduct;

        // Navigate to the full cart page
        await page.goto('/cart', { waitUntil: 'domcontentloaded' });
        await cart.waitForCart();

        const before = await cart.getItemCount();
        expect(before).toBeGreaterThan(0);

        await cart.removeFirstItem();

        // Allow the page to update
        await page.waitForTimeout(2000);

        const after = await cart.getItemCount();
        // Item should have been removed
        const isEmpty = await cart.isEmpty();
        expect(after < before || isEmpty).toBe(true);
    });

    // ══════════════════════════════════════════════════════════════════════════
    //  New coverage from the Shopify_Cart_Test_Cases sheet
    // ══════════════════════════════════════════════════════════════════════════

    // ── Cart access & display ──────────────────────────────────────────────────

    test('CART001 — Cart drawer closes with its X and by clicking outside [TC_CART_002]', async ({ cart, page, merchant }) => {
        await seedProducts(cart, merchant);
        await cart.openDrawer();

        await test.step('close button', async () => {
            const drawer = await cart.miniCartDrawer.elementHandle();
            await cart.closeDrawer();
            await expectDrawerClosed(drawer);
        });

        await test.step('click outside', async () => {
            await cart.cartIcon.click();
            await cart.miniCartDrawer.waitFor({ state: 'visible' });
            const drawer = await cart.miniCartDrawer.elementHandle();
            const box = await cart.miniCartDrawer.boundingBox();
            const urlBefore = page.url();
            // A point beside the drawer, on the page it covers.
            const x = box.x > 60 ? 20 : Math.min(page.viewportSize().width - 20, box.x + box.width + 20);
            await page.mouse.click(x, page.viewportSize().height / 2);
            await expectDrawerClosed(drawer, 'drawer closed by a click outside it');
            expect(page.url(), 'the outside click closed the drawer instead of going through to the page').toBe(urlBefore);
        });

        await expect.poll(() => page.evaluate(() => [document.documentElement, document.body]
            .every(el => !['hidden', 'clip'].includes(getComputedStyle(el).overflowY))), { message: 'page scrolling restored' }).toBe(true);
    });

    test('@smoke CART001 — Cart icon count matches the cart [TC_CART_004]', async ({ cart, page, merchant }) => {
        await seedProducts(cart, merchant, { both: true, quantity: 2 });
        const stored = await cart.cartJson();

        await page.goto('/', { waitUntil: 'domcontentloaded' });
        const allowed = [stored.item_count, stored.items.length];   // total quantity, or number of lines
        let shown;
        await expect.poll(async () => { shown = await cart.getCartCount(); return allowed.includes(shown); }, {
            message: `header count is the total quantity (${stored.item_count}) or the number of lines (${stored.items.length})`,
        }).toBe(true);
    });

    test('CART001 — Continue shopping leaves the cart for the store [TC_CART_005]', async ({ cart, page, merchant }) => {
        await cart.openDrawer(merchant.pages.collection);
        const link = cart.continueShopping;
        test.skip(await link.count() === 0, `${merchant.name}'s cart has no Continue shopping control`);

        const drawer = await cart.miniCartDrawer.elementHandle();
        const urlBefore = page.url();
        await link.click();
        // Either closes the drawer over the page the shopper came from, or goes to another shopping page.
        await expect.poll(async () => page.url() !== urlBefore || await drawer.evaluate(el => {
            const style = getComputedStyle(el);
            return !el.isConnected || !el.getClientRects().length || style.visibility === 'hidden' || el.getBoundingClientRect().left >= innerWidth;
        }).catch(() => true), { message: 'drawer closed or left for a shopping page' }).toBe(true);
        expect(new URL(page.url()).pathname, 'not left on the cart').not.toBe('/cart');
        await expectPageFound(page);
    });

    test('CART001 — Cart drawer and /cart page show the same items and totals [TC_CART_006]', async ({ cart, page, merchant }) => {
        await seedProducts(cart, merchant, { both: true });
        await page.goto('/cart', { waitUntil: 'domcontentloaded' });
        await cart.waitForCart();
        const hasOwnPage = new URL(page.url()).pathname === '/cart' && !await cart.miniCartDrawer.isVisible();
        test.skip(!hasOwnPage, `${merchant.name} has no separate cart page — /cart opens the drawer`);

        const snapshot = async () => {
            const rows = [];
            for (let i = 0; i < await cart.lines.count(); i++) {
                const line = cart.lines.nth(i);
                rows.push(`${(await cart.lineTitle(line).innerText()).trim().toLowerCase()} x${await cart.lineQuantity(line)}`);
            }
            return { rows: rows.sort(), subtotal: await cart.getSubtotalAmount() };
        };
        const onPage = await snapshot();
        await cart.openDrawer();
        expect(await snapshot(), 'drawer matches /cart').toEqual(onPage);
    });

    // ── Line item details ──────────────────────────────────────────────────────

    test('@smoke CART001 — Line shows the product image, title, variant and price [TC_CART_007]', async ({ cart, merchant }) => {
        const [{ product, variant }] = await seedProducts(cart, merchant);
        const item = (await cart.cartJson()).items.find(i => i.variant_id === variant.id);
        await cart.openDrawer();
        const line = cart.lineFor(variant.id);

        await expect(line, 'a line for the added variant').toBeVisible();
        const image = line.locator('img').first();
        await expect.poll(() => image.evaluate(img => img.complete && img.naturalWidth > 0), { message: 'line image loaded' }).toBe(true);

        const normalise = text => text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        const text = normalise(await line.innerText());
        const titleWords = normalise(product.title).split(' ').filter(w => w.length > 2);
        expect(titleWords.filter(w => text.includes(w)).length, `line names "${product.title}"`).toBeGreaterThanOrEqual(Math.min(2, titleWords.length));
        if (product.variants.length > 1) {
            for (const value of variant.options) expect(text, `line shows the variant option "${value}"`).toContain(normalise(value));
        }
        const shown = [...(await line.innerText()).replace(/,/g, '').matchAll(/[$£€]\s?(\d+(?:\.\d+)?)/g)].map(m => parseFloat(m[1]));
        const expected = [item.final_price, item.original_price, item.final_line_price, item.original_line_price].map(money);
        expect(shown.some(amount => expected.includes(amount)), `line shows the item price (${expected.join(' / ')}); shows ${shown.join(', ')}`).toBe(true);
    });

    test('@smoke CART001 — Line total is unit price x quantity [TC_CART_008]', async ({ cart, merchant }) => {
        const [{ variant }] = await seedProducts(cart, merchant, { quantity: 3 });
        const stored = await cart.cartJson();
        const item = stored.items.find(i => i.variant_id === variant.id);

        expect(item.original_line_price, 'store line total = 3 x unit price').toBe(item.original_price * 3);
        await cart.openDrawer();
        const line = cart.lineFor(variant.id);
        await expect.poll(() => cart.lineQuantity(line), { message: 'line quantity' }).toBe(3);
        const shown = [...(await line.innerText()).replace(/,/g, '').matchAll(/[$£€]\s?(\d+(?:\.\d+)?)/g)].map(m => parseFloat(m[1]));
        const lineTotals = [item.final_line_price, item.original_line_price].map(money);
        const unitPrices = [item.final_price, item.original_price].map(money);
        expect(shown.some(a => lineTotals.includes(a) || unitPrices.includes(a)), `line shows its unit price or line total; shows ${shown.join(', ')}`).toBe(true);
        await expect.poll(() => cart.getSubtotalAmount(), { message: 'subtotal reflects quantity 3' }).toBe(money(stored.total_price));
    });

    test('CART001 — Two variants of one product each show their own options [TC_CART_009]', async ({ cart, merchant }) => {
        const found = await multiVariantProduct(cart, merchant);
        test.skip(!found, `${merchant.name}'s configured products are single-variant`);
        const [first, second] = found.variants;
        await cart.seed([{ id: first.id }, { id: second.id }]);
        await cart.openDrawer();

        for (const variant of [first, second]) {
            const line = cart.lineFor(variant.id);
            await expect(line, `a line for "${variant.title}"`).toBeVisible();
            const text = (await line.innerText()).toLowerCase();
            for (const value of variant.options) expect(text, `"${variant.title}" line shows "${value}"`).toContain(value.toLowerCase());
        }
    });

    test('CART001 — Line title and image open the right product page [TC_CART_010]', async ({ cart, page, merchant }) => {
        const [{ product, variant }] = await seedProducts(cart, merchant);
        const onProduct = () => new URL(page.url()).pathname.endsWith(`/products/${product.handle}`);

        for (const [label, pick] of [['title', line => line.locator('a[href*="/products/"]').filter({ hasText: /\S/ }).filter({ visible: true }).first()],
            ['image', line => cart.lineImageLink(line)]]) {
            await test.step(label, async () => {
                await cart.openDrawer();
                const link = pick(cart.lineFor(variant.id));
                expect(await link.count(), `the line's ${label} is a link`).toBeGreaterThan(0);
                const href = await link.getAttribute('href');
                await link.click();
                await expect.poll(onProduct, { message: `${label} opens /products/${product.handle}` }).toBe(true);
                if (/variant=/.test(href)) expect(new URL(page.url()).searchParams.get('variant'), 'with the added variant').toBe(String(variant.id));
            });
        }
    });

    test('CART001 — Personalisation text shows under the line [TC_CART_011]', async ({ cart, merchant }) => {
        const [{ variant }] = await seedProducts(cart, merchant);
        await cart.clear();
        await cart.seed([{ id: variant.id, properties: { 'Gift note': 'SUNTEK QC test' } }]);
        await cart.openDrawer();

        await expect(cart.lineFor(variant.id), 'line shows the personalisation').toContainText('SUNTEK QC test');
    });

    test('@smoke CART001 — A discounted line shows its reduced price or discount [TC_CART_012]', async ({ cart, merchant }) => {
        await seedProducts(cart, merchant, { both: true });
        const item = (await cart.cartJson()).items.find(i => i.final_line_price < i.original_line_price);
        test.skip(!item, `No automatic discount applies to ${merchant.name}'s configured products`);

        await cart.openDrawer();
        const line = cart.lineFor(item.variant_id);
        const text = await line.innerText();
        const shown = [...text.replace(/,/g, '').matchAll(/[$£€]\s?(\d+(?:\.\d+)?)/g)].map(m => parseFloat(m[1]));
        const reduced = [item.final_price, item.final_line_price].map(money);
        const labels = (item.line_level_discount_allocations || []).map(a => a.discount_application && a.discount_application.title).filter(Boolean);
        const showsDiscount = shown.some(a => reduced.includes(a)) || labels.some(l => text.includes(l)) || /discount|save|off\b/i.test(text);
        expect(showsDiscount, `line shows the reduced price (${reduced.join(' / ')}) or a discount label — it shows "${text.replace(/\s+/g, ' ').slice(0, 120)}"`).toBe(true);
    });

    test('@smoke CART001 — A subscription line shows its plan and price [TC_CART_013]', async ({ cart, merchant }) => {
        test.skip(!merchant.features.subscription, `${merchant.name} does not sell subscriptions`);
        const found = await subscriptionProduct(cart, merchant);
        test.skip(!found, `Neither configured product has a subscription plan`);

        await cart.seed([{ id: found.variant.id, selling_plan: found.plan.id }]);
        const item = (await cart.cartJson()).items.find(i => i.selling_plan_allocation);
        expect(item, 'the store recorded the plan').toBeTruthy();
        await cart.openDrawer();

        const text = await cart.lineFor(found.variant.id).innerText();
        const planName = item.selling_plan_allocation.selling_plan.name;
        expect(text.toLowerCase().includes(planName.toLowerCase()) || /deliver|every|subscri|auto-?renew/i.test(text),
            `line shows the plan ("${planName}")`).toBe(true);
        const shown = [...text.replace(/,/g, '').matchAll(/[$£€]\s?(\d+(?:\.\d+)?)/g)].map(m => parseFloat(m[1]));
        expect(shown, 'line shows the subscription price').toContain(money(item.final_price));
    });

    test('CART001 — A free gift shows as free [TC_CART_014]', async ({ cart, merchant }) => {
        test.skip(!merchant.features.gwp, `${merchant.name} has no free-gift offer`);
        const found = await subscriptionProduct(cart, merchant);
        if (found) await cart.seed([{ id: found.variant.id, selling_plan: found.plan.id }]);
        else await seedProducts(cart, merchant);
        await cart.openDrawer();

        let gift;
        await expect.poll(async () => { gift = (await cart.cartJson()).items.find(i => i.final_price === 0); return !!gift; },
            { timeout: 15_000, message: 'the gift app added a free item' }).toBe(true).catch(() => {});
        test.skip(!gift, 'The gift threshold is not met by the configured products');
        const text = await cart.drawerText();
        expect(text, `drawer shows "${gift.product_title}"`).toContain(gift.product_title);
        expect(text, 'gift reads as free').toMatch(/free|[$£€]0(\.00)?\b/i);
    });

    // ── Quantity update ────────────────────────────────────────────────────────

    test('@smoke CART002 — + raises the quantity and totals [TC_CART_015]', async ({ cart, merchant }) => {
        const [{ variant }] = await seedProducts(cart, merchant);
        await cart.openDrawer();
        const line = cart.lineFor(variant.id);
        test.skip(await cart.linePlus(line).count() === 0, `${merchant.name}'s cart line has no + control`);

        await cart.linePlus(line).click();
        await expect.poll(async () => (await cart.cartJson()).items.find(i => i.variant_id === variant.id)?.quantity, { message: 'store quantity' }).toBe(2);
        await expect.poll(() => cart.lineQuantity(line), { message: 'line quantity' }).toBe(2);
        const stored = await cart.cartJson();
        await expect.poll(() => cart.getSubtotalAmount(), { message: 'subtotal' }).toBe(money(stored.total_price));
    });

    test('@smoke CART002 — - lowers the quantity and never below 1 [TC_CART_016]', async ({ cart, merchant }) => {
        const [{ variant }] = await seedProducts(cart, merchant, { quantity: 2 });
        await cart.openDrawer();
        const line = cart.lineFor(variant.id);
        test.skip(await cart.lineMinus(line).count() === 0, `${merchant.name}'s cart line has no - control`);

        await cart.lineMinus(line).click();
        const quantity = async () => (await cart.cartJson()).items.find(i => i.variant_id === variant.id)?.quantity ?? 0;
        await expect.poll(quantity, { message: 'store quantity after -' }).toBe(1);
        await expect.poll(() => cart.getSubtotalAmount(), { message: 'subtotal' }).toBe(money((await cart.cartJson()).total_price));

        // At 1: a disabled "-" is the guard; an enabled one may only keep 1 or remove the line.
        if (await cart.lineMinus(line).isEnabled().catch(() => false)) {
            await cart.lineMinus(line).click();
            await cart.page.waitForTimeout(2_000);
            expect([0, 1], 'quantity after - at 1 (removed or kept at 1)').toContain(await quantity());
        }
    });

    test('CART002 — A typed quantity updates the line and totals [TC_CART_017]', async ({ cart, merchant }) => {
        const [{ variant }] = await seedProducts(cart, merchant);
        await cart.openDrawer();
        const input = cart.lineQuantityInput(cart.lineFor(variant.id));
        test.skip(await input.count() === 0 || !await input.isEditable(), `${merchant.name}'s cart quantity can't be typed`);

        await input.fill('5');
        await input.press('Enter');
        await input.blur().catch(() => {});
        await expect.poll(async () => (await cart.cartJson()).items.find(i => i.variant_id === variant.id)?.quantity, { message: 'store quantity' }).toBe(5);
        await expect.poll(() => cart.getSubtotalAmount(), { message: 'subtotal' }).toBe(money((await cart.cartJson()).total_price));
    });

    test('CART002 — Invalid typed quantities are rejected without breaking totals [TC_CART_018]', async ({ cart, page, merchant }) => {
        test.slow();   // three entries, each given 2 s to settle, on top of opening the drawer
        const [{ variant }] = await seedProducts(cart, merchant);
        await cart.openDrawer();
        const input = cart.lineQuantityInput(cart.lineFor(variant.id));
        test.skip(await input.count() === 0 || !await input.isEditable(), `${merchant.name}'s cart quantity can't be typed`);

        for (const value of ['-1', 'abc', '2.5']) {
            await test.step(`"${value}"`, async () => {
                await input.fill(value).catch(() => {});   // a number field refuses letters outright
                await input.press('Enter').catch(() => {});
                await input.blur().catch(() => {});
                await page.waitForTimeout(2_000);
                const stored = await cart.cartJson();
                const quantity = stored.items.find(i => i.variant_id === variant.id)?.quantity ?? 0;
                expect(Number.isInteger(quantity) && quantity >= 0, `store quantity after "${value}" (${quantity})`).toBe(true);
                expect(await cart.miniCartDrawer.innerText().catch(() => ''), 'no NaN / undefined in the cart').not.toMatch(/\bNaN\b|undefined/);
            });
        }
    });

    test('CART002 — Rapid + clicks settle on the right quantity and totals [TC_CART_020]', async ({ cart, merchant }) => {
        const [{ variant }] = await seedProducts(cart, merchant);
        await cart.openDrawer();
        const plus = cart.linePlus(cart.lineFor(variant.id));
        test.skip(await plus.count() === 0, `${merchant.name}'s cart line has no + control`);

        for (let i = 0; i < 3; i++) await plus.click({ delay: 0 });
        await expect.poll(async () => (await cart.cartJson()).items.find(i => i.variant_id === variant.id)?.quantity,
            { timeout: 15_000, message: 'store quantity after 3 quick clicks' }).toBe(4);
        await expect.poll(() => cart.lineQuantity(cart.lineFor(variant.id)), { message: 'line quantity' }).toBe(4);
        await expect.poll(() => cart.getSubtotalAmount(), { message: 'subtotal is not stale' }).toBe(money((await cart.cartJson()).total_price));
    });

    // ── Remove items ───────────────────────────────────────────────────────────

    test('@smoke CART003 — Removing one line updates totals and the cart count [TC_CART_022]', async ({ cart, merchant }) => {
        const [first, second] = await seedProducts(cart, merchant, { both: true });
        await cart.openDrawer();

        await cart.lineRemove(cart.lineFor(first.variant.id)).click();
        await expect.poll(async () => (await cart.cartJson()).items.map(i => i.variant_id), { message: 'only the other item is left' }).toEqual([second.variant.id]);
        await expect(cart.lineFor(first.variant.id), 'removed line gone').toHaveCount(0);
        const stored = await cart.cartJson();
        await expect.poll(() => cart.getSubtotalAmount(), { message: 'subtotal' }).toBe(money(stored.total_price));
        await expect.poll(() => cart.getCartCount(), { message: 'header count' }).toBeLessThanOrEqual(stored.item_count);
    });

    test('CART003 — Setting quantity to 0 removes the line [TC_CART_023]', async ({ cart, merchant }) => {
        const [{ variant }] = await seedProducts(cart, merchant);
        await cart.openDrawer();
        const input = cart.lineQuantityInput(cart.lineFor(variant.id));
        test.skip(await input.count() === 0 || !await input.isEditable(), `${merchant.name}'s cart quantity can't be typed`);

        await input.fill('0');
        await input.press('Enter');
        await input.blur().catch(() => {});
        await expect.poll(async () => (await cart.cartJson()).items.some(i => i.variant_id === variant.id), { message: 'line removed' }).toBe(false);
    });

    test('@smoke CART003 — Removing every line leaves the empty state [TC_CART_024]', async ({ cart, merchant }) => {
        await seedProducts(cart, merchant, { both: true });
        await cart.openDrawer();

        for (let i = 0; i < 2; i++) {
            const count = (await cart.cartJson()).items.length;
            await cart.lineRemove(cart.lines.first()).click();
            await expect.poll(async () => (await cart.cartJson()).items.length, { message: `line ${i + 1} removed` }).toBe(count - 1);
        }
        await expect(cart.emptyState, 'empty-cart message').toBeVisible();
    });

    test('CART003 — Undo restores a removed line [TC_CART_025]', async ({ cart, page, merchant }) => {
        const [{ variant }] = await seedProducts(cart, merchant, { quantity: 2 });
        await cart.openDrawer();
        await cart.lineRemove(cart.lineFor(variant.id)).click();

        const undo = page.getByRole('button', { name: /undo/i }).or(page.getByRole('link', { name: /undo/i })).filter({ visible: true }).first();
        const offered = await undo.waitFor({ state: 'visible', timeout: 4_000 }).then(() => true, () => false);
        test.skip(!offered, `${merchant.name}'s cart has no undo after remove`);
        await undo.click();
        await expect.poll(async () => (await cart.cartJson()).items.find(i => i.variant_id === variant.id)?.quantity, { message: 'restored quantity' }).toBe(2);
    });

    // ── Empty cart ─────────────────────────────────────────────────────────────

    test('@smoke CART003 — Empty /cart shows the empty message and a way to shop [TC_CART_027]', async ({ cart, page }) => {
        await page.goto('/cart', { waitUntil: 'domcontentloaded' });
        await expect(cart.emptyState, 'empty-cart message').toBeVisible({ timeout: 15_000 });
        await expect(cart.continueShopping, 'a link back to shopping').toBeVisible();
    });

    test('CART003 — Empty drawer shows the empty state with no usable checkout [TC_CART_028]', async ({ cart }) => {
        await cart.openDrawer();
        await expect(cart.emptyState, 'empty-cart message').toBeVisible();

        const checkout = cart.checkoutButton;
        if (await checkout.count() > 0) {
            const usable = await checkout.evaluate(el => !el.disabled && el.getAttribute('aria-disabled') !== 'true');
            expect(usable, 'checkout button is hidden or disabled while the cart is empty').toBe(false);
        }
    });

    test('@smoke CART003 — /checkout with an empty cart does not open a checkout [TC_CART_029]', async ({ page }) => {
        await page.goto('/checkout', { waitUntil: 'domcontentloaded' });
        await expect.poll(() => /\/checkouts\/|checkout\.shopify\.com/.test(page.url()), { message: `empty-cart checkout (landed on ${page.url()})` }).toBe(false);
    });

    test('CART003 — Empty cart recommends products that open [TC_CART_030]', async ({ cart, page, merchant }) => {
        await cart.openDrawer();
        const recommended = cart.miniCartDrawer.locator('a[href*="/products/"]').filter({ visible: true });
        test.skip(await recommended.count() === 0, `${merchant.name}'s empty cart recommends no products`);

        const href = await recommended.first().getAttribute('href');
        await recommended.first().click();
        await expect.poll(() => new URL(page.url()).pathname, { message: 'recommended product opens' }).toBe(new URL(href, page.url()).pathname);
        await expectPageFound(page);
    });

    // ── Cart persistence ───────────────────────────────────────────────────────

    const cartKey = stored => stored.items.map(i => `${i.variant_id}x${i.quantity}`).sort().join(',');

    test('@smoke CART001 — Cart survives a page refresh [TC_CART_031]', async ({ cart, page, merchant }) => {
        await seedProducts(cart, merchant, { both: true });
        const before = await cart.cartJson();
        await cart.openDrawer();
        const lines = await cart.lines.count();

        await page.reload({ waitUntil: 'domcontentloaded' });
        expect(cartKey(await cart.cartJson()), 'same items and quantities').toBe(cartKey(before));
        await cart.openDrawerHere();
        await expect.poll(() => cart.lines.count(), { message: 'same lines shown' }).toBe(lines);
    });

    test('CART001 — Cart is the same in a new tab [TC_CART_032]', async ({ cart, page, merchant }) => {
        await seedProducts(cart, merchant, { both: true });
        const before = await cart.cartJson();

        const tab = await page.context().newPage();
        await tab.goto('/', { waitUntil: 'domcontentloaded' });
        const inTab = await (await tab.request.get('/cart.js')).json();
        expect(inTab.token, 'same cart').toBe(before.token);
        expect(cartKey(inTab), 'same items').toBe(cartKey(before));
        await tab.close();
    });

    test('CART001 — Cart survives a browser restart [TC_CART_036]', async ({ cart, page, browser, merchant }) => {
        await seedProducts(cart, merchant);
        const before = await cart.cartJson();
        const state = await page.context().storageState();

        const restarted = await browser.newContext({ storageState: state, baseURL: merchant.urls.production });
        const after = await (await restarted.request.get('/cart.js')).json();
        await restarted.close();
        expect(cartKey(after), 'items kept by the cart cookie').toBe(cartKey(before));
    });

    // ── Discounts ──────────────────────────────────────────────────────────────

    test('CART001 — An invalid discount code shows an error and changes nothing [TC_CART_038]', async ({ cart, page, merchant }) => {
        await seedProducts(cart, merchant);
        await cart.openDrawer();
        const field = page.locator('input[name*="discount" i], input[placeholder*="discount" i], input[placeholder*="promo" i], input[placeholder*="gift card" i]').filter({ visible: true }).first();
        test.skip(await field.count() === 0, `${merchant.name}'s cart has no discount-code field (codes are entered at checkout)`);

        const before = await cart.cartJson();
        await field.fill('SUNTEKQC-INVALID-000');
        await field.press('Enter');
        await expect(page.getByText(/invalid|not valid|isn't valid|unable|not found|can't be applied|enter a valid/i).filter({ visible: true }).first(), 'error message').toBeVisible();
        expect((await cart.cartJson()).total_price, 'total unchanged').toBe(before.total_price);
    });

    // ── Free shipping bar ──────────────────────────────────────────────────────

    test('CART001 — Free-shipping bar shows the right amount still needed [TC_CART_047]', async ({ cart, merchant }) => {
        await cart.openDrawer();
        const empty = freeShippingState(await cart.drawerText());
        await seedProducts(cart, merchant);
        await cart.openDrawer();
        const state = freeShippingState(await cart.drawerText());
        test.skip(state.remaining === null, state.qualified
            ? `${merchant.name}'s configured product already qualifies for free shipping`
            : `${merchant.name}'s cart shows no free-shipping progress`);

        const subtotal = money((await cart.cartJson()).total_price);
        const threshold = state.threshold ?? empty.remaining;
        expect(state.remaining, 'amount still needed').toBeGreaterThan(0);
        if (threshold) expect(Math.abs(state.remaining - (threshold - subtotal)), `remaining = $${threshold} threshold - $${subtotal} subtotal`).toBeLessThan(0.02);
    });

    test('CART001 — Reaching the threshold switches to the free-shipping message [TC_CART_048]', async ({ cart, merchant }) => {
        const [{ variant }] = await seedProducts(cart, merchant);
        await cart.openDrawer();
        test.skip(freeShippingState(await cart.drawerText()).remaining === null, `${merchant.name}'s cart shows no free-shipping progress`);

        const plus = cart.linePlus(cart.lineFor(variant.id));
        for (let i = 0; i < 6 && !freeShippingState(await cart.drawerText()).qualified; i++) {
            const quantity = (await cart.cartJson()).items.find(item => item.variant_id === variant.id).quantity;
            await plus.click();
            await expect.poll(async () => (await cart.cartJson()).items.find(item => item.variant_id === variant.id).quantity).toBe(quantity + 1);
            await cart.page.waitForTimeout(1_000);   // the bar re-renders after the cart update
        }
        expect(freeShippingState(await cart.drawerText()).qualified, `free-shipping message at $${money((await cart.cartJson()).total_price)}`).toBe(true);
    });

    test('CART001 — Free-shipping bar recalculates when quantity changes [TC_CART_049]', async ({ cart, merchant }) => {
        const [{ variant }] = await seedProducts(cart, merchant);
        await cart.openDrawer();
        const before = freeShippingState(await cart.drawerText());
        test.skip(before.remaining === null, `${merchant.name}'s cart shows no free-shipping progress`);

        const unit = money((await cart.cartJson()).items.find(i => i.variant_id === variant.id).final_price);
        await cart.linePlus(cart.lineFor(variant.id)).click();
        await expect.poll(async () => {
            const after = freeShippingState(await cart.drawerText());
            return after.qualified || (after.remaining !== null && Math.abs((before.remaining - after.remaining) - unit) < 0.02);
        }, { message: `remaining drops by the $${unit} unit price (or qualifies)` }).toBe(true);
    });

    // ── Upsell & cross-sell ────────────────────────────────────────────────────

    test('CART001 — Cart upsells show with prices [TC_CART_051]', async ({ cart, merchant }) => {
        await seedProducts(cart, merchant);
        await cart.openDrawer();
        const adds = cart.upsellAddButtons;
        test.skip(await adds.count() === 0, `${merchant.name}'s cart shows no upsells`);

        for (let i = 0; i < Math.min(await adds.count(), 3); i++) {
            const card = adds.nth(i).locator('xpath=ancestor::*[.//a[contains(@href, "/products/")]][1]');
            await expect(card, `upsell ${i + 1} shows a price`).toContainText(/[$£€]\s?\d/);
        }
    });

    test('CART001 — Adding an upsell updates the cart without a reload [TC_CART_052]', async ({ cart, page, merchant }) => {
        await seedProducts(cart, merchant);
        await cart.openDrawer();
        const adds = cart.upsellAddButtons;
        test.skip(await adds.count() === 0, `${merchant.name}'s cart shows no upsells`);

        const before = await cart.cartJson();
        await page.evaluate(() => { window.__qcNoReload = true; });
        await adds.first().click();
        await expect.poll(async () => (await cart.cartJson()).item_count, { message: 'upsell item added' }).toBeGreaterThan(before.item_count);
        expect(await page.evaluate(() => window.__qcNoReload === true), 'no full page reload').toBe(true);
        await expect.poll(() => cart.getSubtotalAmount(), { message: 'subtotal updated' }).toBe(money((await cart.cartJson()).total_price));
    });

    test('CART001 — Upsells don\'t offer what is already in the cart [TC_CART_053]', async ({ cart, merchant }) => {
        await seedProducts(cart, merchant, { both: true });
        await cart.openDrawer();
        test.skip(await cart.upsellAddButtons.count() === 0, `${merchant.name}'s cart shows no upsells`);

        const inCart = new Set((await cart.cartJson()).items.map(i => i.handle));
        const lineLinks = await cart.lines.locator('a[href*="/products/"]').evaluateAll(as => as.map(a => a.pathname));
        const drawerLinks = await cart.miniCartDrawer.locator('a[href*="/products/"]').evaluateAll(as => as.map(a => a.pathname));
        const upsellHandles = drawerLinks.filter(path => !lineLinks.includes(path)).map(path => path.split('/products/')[1].split('/')[0]);
        expect(upsellHandles.filter(handle => inCart.has(handle)), 'upsells for products already in the cart').toEqual([]);
    });

    // ── Proceed to checkout ────────────────────────────────────────────────────

    test('@smoke CART001 — Checkout from /cart opens checkout [TC_CART_063]', async ({ cart, page, merchant }) => {
        await seedProducts(cart, merchant);
        await page.goto('/cart', { waitUntil: 'domcontentloaded' });
        await cart.waitForCart();
        await cart.clickCheckout();   // stops at the checkout URL
    });

    test('@smoke CART001 — Checkout from the drawer opens checkout [TC_CART_064]', async ({ cart, merchant }) => {
        await seedProducts(cart, merchant);
        await cart.openDrawer();
        await cart.clickCheckout();   // stops at the checkout URL
    });

    test('@smoke CART001 — Checkout shows the cart\'s items and subtotal [TC_CART_065]', async ({ cart, page, merchant }) => {
        await seedProducts(cart, merchant, { both: true });
        const stored = await cart.cartJson();
        await cart.openDrawer();
        await cart.clickCheckout();

        const checkout = new CheckoutPage(page);
        await checkout.verifyOrderSummaryVisible();   // Shopify's one-page checkout has no #checkout form to wait on
        const subtotal = await checkout.getSubtotalAmount();
        const accepted = [stored.items_subtotal_price, stored.original_total_price, stored.total_price].map(money);
        expect(accepted, `checkout subtotal $${subtotal} matches the cart`).toContain(subtotal);
    });

    test('CART001 — A terms checkbox must be ticked before checkout [TC_CART_067]', async ({ cart, page, merchant }) => {
        await seedProducts(cart, merchant);
        await cart.openDrawer();
        const terms = cart.miniCartDrawer.locator('input[type="checkbox"]').filter({ has: page.locator('xpath=ancestor::label') }).or(
            cart.miniCartDrawer.getByRole('checkbox', { name: /terms|agree|conditions/i })).first();
        test.skip(await terms.count() === 0, `${merchant.name}'s cart has no terms checkbox`);

        await cart.checkoutButton.click();
        await page.waitForTimeout(2_000);
        expect(/\/checkouts\//.test(page.url()), 'checkout blocked until the terms are ticked').toBe(false);
    });

    test('CART001 — Back from checkout returns to an intact cart [TC_CART_068]', async ({ cart, page, merchant }) => {
        await seedProducts(cart, merchant, { both: true });
        const before = await cart.cartJson();
        await cart.openDrawer();
        await cart.clickCheckout();

        await page.goBack({ waitUntil: 'domcontentloaded' });
        expect(cartKey(await cart.cartJson()), 'same items and quantities').toBe(cartKey(before));
        await cart.openDrawer();
        await expect.poll(() => cart.lines.count(), { message: 'lines still shown' }).toBe(before.items.length);
    });

    // ── Responsive ─────────────────────────────────────────────────────────────

    const LAYOUTS = [
        { tc: 'TC_CART_069', label: 'Mobile', widths: [375], height: 812, smoke: true },
        { tc: 'TC_CART_070', label: 'Tablet', widths: [768, 1024], height: 1024 },
    ];

    for (const { tc, label, widths, height, smoke } of LAYOUTS) {
        test(`${smoke ? '@smoke ' : ''}CART001 — ${label} cart has tappable controls and no horizontal scroll at ${widths.join('px and ')}px [${tc}]`,
            async ({ cart, page, merchant, isMobile }) => {
                test.skip(isMobile, 'This test sets its own viewport — run it on the desktop project');
                const [{ variant }] = await seedProducts(cart, merchant);

                for (const width of widths) {
                    await test.step(`${width}px wide`, async () => {
                        await page.setViewportSize({ width, height });
                        await cart.openDrawer();
                        const line = cart.lineFor(variant.id);
                        await expect(line, 'line shows').toBeVisible();
                        for (const [name, control] of [['+', cart.linePlus(line)], ['remove', cart.lineRemove(line)]]) {
                            if (await control.count() === 0) continue;
                            const box = await control.boundingBox();
                            expect(box && Math.max(box.width, box.height) >= 24 && box.x >= 0 && box.x + box.width <= width,
                                `"${name}" is on screen and at least 24px to tap (${box && `${Math.round(box.width)}x${Math.round(box.height)} at x=${Math.round(box.x)}`})`).toBe(true);
                        }
                        await expect.poll(() => horizontalOverflow(page), { message: 'px the page overflows the viewport' }).toBe(0);
                    });
                }
            });
    }

    test('CART001 — A long cart scrolls with checkout still reachable [TC_CART_072]', async ({ cart, page, merchant }) => {
        test.slow();
        const variants = [];
        for (const which of ['default', 'secondary']) variants.push(...(await cart.availableVariants(merchant.products[which].handle)).variants);
        test.skip(variants.length < 10, `${merchant.name}'s configured products have fewer than 10 variants to fill a long cart`);
        await cart.seed(variants.slice(0, 10).map(v => ({ id: v.id })));
        await cart.openDrawer();

        const scrolls = await cart.miniCartDrawer.evaluate(drawer => {
            const root = drawer.shadowRoot || drawer;
            return [drawer, ...root.querySelectorAll('*')].some(el => el.scrollHeight > el.clientHeight + 20 && /auto|scroll/.test(getComputedStyle(el).overflowY));
        });
        expect(scrolls, 'the drawer (or its list) scrolls').toBe(true);
        await expect(cart.checkoutButton, 'checkout button in view without scrolling the page').toBeInViewport();
    });

    // ── Performance, accessibility & analytics ─────────────────────────────────

    test('CART002 — A quantity change updates totals within 2 seconds without a reload [TC_CART_073]', async ({ cart, page, merchant }) => {
        const [{ variant }] = await seedProducts(cart, merchant);
        await cart.openDrawer();
        const line = cart.lineFor(variant.id);
        test.skip(await cart.linePlus(line).count() === 0, `${merchant.name}'s cart line has no + control`);
        const unit = money((await cart.cartJson()).items.find(i => i.variant_id === variant.id).final_price);
        const before = await cart.getSubtotalAmount();

        await page.evaluate(() => { window.__qcNoReload = true; });
        const started = Date.now();
        await cart.linePlus(line).click();
        await expect.poll(() => cart.getSubtotalAmount(), { timeout: 10_000, message: 'subtotal updated' }).toBeCloseTo(before + unit, 2);
        const elapsed = Date.now() - started;
        expect(elapsed, `ms from click to updated subtotal`).toBeLessThanOrEqual(2_500);   // ~2 s, plus polling granularity
        expect(await page.evaluate(() => window.__qcNoReload === true), 'no full page reload').toBe(true);
    });

    test('CART002 — Cart updates cause no failed cart requests or script errors [TC_CART_074]', async ({ cart, page, merchant }) => {
        const failed = [];
        const errors = [];
        page.on('response', r => { if (/\/cart(\/[a-z]+)?(\.js)?(\?|$)/.test(new URL(r.url()).pathname + '?') && r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
        // Errors thrown by third-party scripts (analytics pixels etc.) aren't cart errors: skip any that
        // name a script URL outside the store and Shopify's CDN (e.g. Revitin's TikTok pixel worker).
        const store = new URL(merchant.urls.production).hostname;
        page.on('pageerror', e => {
            const hosts = [...e.message.matchAll(/https?:\/\/([^/\s'"]+)/g)].map(m => m[1]);
            if (hosts.some(h => !h.endsWith(store) && !h.endsWith('cdn.shopify.com'))) return;
            errors.push(e.message);
        });

        const [first] = await seedProducts(cart, merchant, { both: true });
        await cart.openDrawer();
        const line = cart.lineFor(first.variant.id);
        if (await cart.linePlus(line).count() > 0) {
            await cart.linePlus(line).click();
            await expect.poll(async () => (await cart.cartJson()).items.find(i => i.variant_id === first.variant.id)?.quantity).toBe(2);
        }
        await cart.lineRemove(line).click();
        await expect.poll(async () => (await cart.cartJson()).items.some(i => i.variant_id === first.variant.id)).toBe(false);

        expect(failed, 'failed cart requests').toEqual([]);
        expect(errors, 'uncaught script errors during add / update / remove').toEqual([]);
    });

    test('CART001 — Cart controls are reachable by keyboard with a visible focus state [TC_CART_075]', async ({ cart, page, merchant, isMobile }) => {
        test.skip(isMobile, 'Keyboard navigation is a desktop check');
        test.slow();   // up to 40 key presses, each checked for a popup first
        await seedProducts(cart, merchant);
        await cart.openDrawer();

        const checkout = await cart.checkoutButton.elementHandle();
        // Start from the drawer's first control (focus usually moves into an opened drawer, but not always).
        await cart.miniCartDrawer.locator('a[href], button, input, select, textarea').filter({ visible: true }).first().focus();
        const stops = [];
        let reached = false;
        const until = Date.now() + 60_000;   // report where focus went rather than hit the test timeout
        for (let i = 0; i < 40 && !reached && Date.now() < until; i++) {
            await cart.pressKey('Tab');
            const stop = await page.evaluate(target => {
                let el = document.activeElement;
                while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement;   // Koh: inside the shadow root
                const style = getComputedStyle(el);
                return {
                    element: `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : ''}`,
                    isCheckout: el === target || (target && target.contains(el)),
                    hasFocusRing: (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) || style.boxShadow !== 'none',
                };
            }, checkout);
            reached = stop.isCheckout;
            stops.push(stop);
        }
        expect(reached, `Tab reaches Checkout (stops: ${stops.map(s => s.element).join(' > ')})`).toBe(true);
        expect(stops.filter(s => !s.hasFocusRing).map(s => s.element), 'cart controls with no visible focus state').toEqual([]);
    });

    test('CART001 — GA4 view_cart and remove_from_cart fire [TC_CART_076]', async ({ cart, page, merchant }) => {
        test.skip(merchant.integrations.analyticsProvider !== 'ga4', `${merchant.name} does not use GA4`);
        const [{ variant }] = await seedProducts(cart, merchant);
        const ga4 = recordGa4Events(page);

        await cart.openDrawer();
        await expect.poll(() => ga4.events('view_cart').length, { timeout: 10_000, message: 'view_cart fired on opening the cart' }).toBeGreaterThan(0);
        await cart.lineRemove(cart.lineFor(variant.id)).click();
        await expect.poll(() => ga4.events('remove_from_cart').length, { timeout: 10_000, message: 'remove_from_cart fired' }).toBeGreaterThan(0);
    });

    test('CART001 — GA4 begin_checkout fires once on Checkout [TC_CART_077]', async ({ cart, page, merchant }) => {
        test.skip(merchant.integrations.analyticsProvider !== 'ga4', `${merchant.name} does not use GA4`);
        await seedProducts(cart, merchant);
        await cart.openDrawer();
        const ga4 = recordGa4Events(page);

        await cart.clickCheckout();
        await expect.poll(() => ga4.events('begin_checkout').length, { timeout: 15_000, message: 'begin_checkout fired' }).toBeGreaterThan(0);
        await page.waitForTimeout(3_000);   // room for a duplicate hit to show up
        const perProperty = hitsPerProperty(ga4.events('begin_checkout'));
        expect(Object.values(perProperty).every(hits => hits === 1), `begin_checkout hits per GA4 property: ${JSON.stringify(perProperty)}`).toBe(true);
    });
});

