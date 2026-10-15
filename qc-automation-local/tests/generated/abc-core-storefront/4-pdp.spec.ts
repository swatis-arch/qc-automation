// spec: specs/abc-core-storefront.md
// seed: tests/seed.spec.ts
import { test, expect } from '../../../fixtures/base';
import {
    TITLE_SUFFIX, addToCart, badge, chooseAlessia, clearCart, closeDrawer, drawer, handleOf, load, note,
    openEmpty, pdpPrice, pdpTitle, press, productJson, readCart, scrollWidth, sel, selectedVariantId, selectedVariantText, sizeButton,
    tap, variantByTitle, withCents,
} from './helpers';

test.describe('ABC core storefront — 4. Product page', () => {
    test('Product title, vendor and price match the product JSON', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'abc', 'ABC only');
        test.setTimeout(180_000);

        // 1. Open the Alessia PDP and fetch its JSON in the same context.
        const alessia = merchant.products.secondary;
        expect(await load(page, alessia.path)).toBe(200);
        await expect(pdpTitle(page, merchant)).toBeVisible({ timeout: 30_000 });
        const json = await productJson(page, handleOf(alessia.path));
        await expect(pdpTitle(page, merchant)).toHaveText(json.title);
        await expect(page.getByText('abc carpet & home', { exact: true }).first()).toBeVisible();
        await expect(page).toHaveTitle(`${json.title}${TITLE_SUFFIX}`);
        const crumbs = page.getByRole('navigation', { name: /breadcrumbs/i });
        await expect(crumbs.getByRole('link', { name: 'Shop' })).toHaveAttribute('href', '/');
        await expect(crumbs.getByRole('link', { name: 'Coffee & Side Tables' })).toBeVisible();
        await expect(crumbs).toContainText(json.title);

        // O9: the displayed price is the selected variant's price, not product.price (the lowest variant).
        const variantId = await selectedVariantId(page, merchant);
        const selected = json.variants.find((v: { id: number }) => String(v.id) === variantId);
        expect(selected, 'select[name=id] holds a variant of the product JSON').toBeTruthy();
        await expect(pdpPrice(page, merchant)).toContainText(withCents(selected.price));
        if (selected.price !== json.price) note('O9', `PDP shows ${withCents(selected.price)} for the default variant while product.price is ${withCents(json.price)} (cards show "from")`);

        // 2. Open the Delancey PDP with a generous wait for the H1 (O11).
        const delancey = merchant.products.default;
        expect(await load(page, delancey.path)).toBe(200);
        await expect(pdpTitle(page, merchant)).toBeVisible({ timeout: 90_000 });
        await expect(pdpTitle(page, merchant)).toHaveText(delancey.name);
        await expect(page).toHaveURL(/[?&]variant=\d+/, { timeout: 30_000 });
        const dj = await productJson(page, handleOf(delancey.path));
        const urlVariant = new URL(page.url()).searchParams.get('variant');
        const dv = dj.variants.find((v: { id: number }) => String(v.id) === urlVariant);
        expect(dv, '?variant= is a variant of the product JSON').toBeTruthy();
        await expect(pdpPrice(page, merchant)).toContainText(withCents(dv.price));
        const prices = dj.variants.map((v: { price: number }) => v.price);
        expect(dv.price).toBeGreaterThanOrEqual(Math.min(...prices));
        expect(dv.price).toBeLessThanOrEqual(Math.max(...prices));
    });

    test('Size dropdown and Color swatches update variant, price and URL', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'abc', 'ABC only');
        test.setTimeout(180_000);
        const handle = handleOf(merchant.products.secondary.path);

        // 1. Click the Size dropdown and read its options.
        await load(page, merchant.products.secondary.path);
        await expect(pdpTitle(page, merchant)).toBeVisible({ timeout: 30_000 });
        const tallDeep = await variantByTitle(page, handle, 'Tall / Deep Umber Brown');
        const tallLatte = await variantByTitle(page, handle, 'Tall / Latte Taupe');
        const dropdown = sizeButton(page, merchant);
        await dropdown.scrollIntoViewIfNeeded();
        await expect(dropdown).toHaveText('Short');
        await press(dropdown);
        await expect(dropdown).toHaveAttribute('aria-expanded', 'true');
        const options = page.locator(sel(merchant, 'pdpSizeOption'));
        await expect(options.filter({ hasText: /^\s*Short\s*$/ }).first()).toBeVisible();
        await expect(options.filter({ hasText: /^\s*Tall\s*$/ }).first()).toBeVisible();

        // 2. Choose 'Tall'.
        await press(options.filter({ hasText: /^\s*Tall\s*$/ }).first());
        await expect(dropdown).toHaveText('Tall');
        await expect(pdpPrice(page, merchant)).toContainText(withCents(tallDeep.price));
        await expect(page).toHaveURL(new RegExp(`[?&]variant=${tallDeep.id}\\b`));
        await expect.poll(() => selectedVariantText(page, merchant)).toBe('Tall / Deep Umber Brown');

        // 3. Click the swatch 'Latte Taupe'.
        const swatch = page.locator(sel(merchant, 'pdpSwatch')).filter({ hasText: 'Latte Taupe' }).first();
        await swatch.scrollIntoViewIfNeeded();
        await press(swatch);
        await expect(page.locator(sel(merchant, 'pdpSelectedOptionValue')).first()).toHaveText('Latte Taupe');
        await expect(page).toHaveURL(new RegExp(`[?&]variant=${tallLatte.id}\\b`));
        await expect.poll(() => selectedVariantText(page, merchant)).toBe('Tall / Latte Taupe');
        await expect(pdpPrice(page, merchant)).toContainText(withCents(tallLatte.price));
        await expect(pdpTitle(page, merchant)).toHaveText('Alessia Glazed Coffee Table');

        // 4. O3: visible Fabric swatch images on the Delancey PDP must not be broken.
        await load(page, merchant.products.default.path);
        await expect(pdpTitle(page, merchant)).toBeVisible({ timeout: 90_000 });
        const swatches = page.locator(sel(merchant, 'pdpSwatch')).locator('img');
        await expect.poll(() => swatches.count(), { timeout: 30_000 }).toBeGreaterThan(0);
        await page.waitForTimeout(3000);   // let the swatch thumbnails finish loading
        const brokenImages = await swatches.evaluateAll(imgs => imgs
            .filter((i: HTMLImageElement) => i.offsetParent !== null && i.complete && i.currentSrc && i.naturalWidth === 0)
            .map((i: HTMLImageElement) => i.currentSrc.split('/').pop()));
        note('O3', `${brokenImages.length} broken visible swatch image(s); first 5: ${brokenImages.slice(0, 5).join(', ') || 'none'}`);
        expect(brokenImages, `O3: ${brokenImages.length} visible swatch images are broken (first 5: ${brokenImages.slice(0, 5).join(', ')})`).toEqual([]);
    });

    test('Quantity stepper, gallery and tabs', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'abc', 'ABC only');
        test.setTimeout(150_000);
        await load(page, merchant.products.secondary.path);
        await expect(pdpTitle(page, merchant)).toBeVisible({ timeout: 30_000 });
        const main = page.getByRole('main');

        // 1. Read the quantity input and its buttons (scoped to main: the drawer has same-named buttons).
        const qty = main.locator(merchant.locators.get('quantityInput'));
        const plus = main.getByRole('button', { name: 'Increase quantity' });
        const minus = main.getByRole('button', { name: 'Decrease quantity' });
        await expect(qty).toHaveAttribute('aria-label', 'Product quantity');
        await expect(qty).toHaveValue('1');
        await expect(minus).toBeDisabled();

        // 2. Increase once, then decrease once.
        await tap(page, plus);
        await expect(qty).toHaveValue('2');
        await expect(minus).toBeEnabled();
        await tap(page, minus);
        await expect(qty).toHaveValue('1');
        await expect(minus).toBeDisabled();
        expect((await readCart(page)).item_count, 'changing the quantity does not touch the cart').toBe(0);

        // 3. Gallery: the main slider has no arrows of its own; its Next/Previous buttons belong to the thumbnail
        // strip (the other 'Next slide' buttons are the upsell slider and the lightbox).
        const thumbsBox = page.locator(sel(merchant, 'pdpThumbsSwiper'));
        const thumbs = page.locator(merchant.locators.get('galleryThumb'));
        const thumbCount = await thumbs.count();
        note('gallery', `${thumbCount} thumbnails`);
        expect(thumbCount).toBeGreaterThanOrEqual(3);
        await expect(thumbsBox.getByRole('button', { name: 'Previous slide' })).toBeDisabled();
        const activeSrc = () => page.locator(`${sel(merchant, 'pdpMainSwiper')} .swiper-slide-active img`).evaluate((i: HTMLImageElement) => i.currentSrc);
        const before = await activeSrc();
        await thumbs.nth(2).scrollIntoViewIfNeeded();
        await tap(page, thumbs.nth(2));
        await expect.poll(activeSrc).not.toBe(before);
        const loaded = await page.locator(`${sel(merchant, 'pdpMainSwiper')} .swiper-slide-active img`).evaluate((i: HTMLImageElement) => i.naturalWidth);
        expect(loaded, 'active gallery image loads').toBeGreaterThan(0);
        // The thumbnail strip's own Next button scrolls the strip and enables its Previous button.
        const stripNext = thumbsBox.getByRole('button', { name: 'Next slide' });
        if (await stripNext.isEnabled()) {
            await press(stripNext);
            await expect(thumbsBox.getByRole('button', { name: 'Previous slide' })).toBeEnabled();
        }

        // 4. Tabs: 'Shipping & Returns' then 'Description & Details'. Do not click 'MEASURING GUIDE'.
        const description = page.getByRole('tab', { name: 'Description & Details' });
        const shipping = page.getByRole('tab', { name: 'Shipping & Returns' });
        await shipping.scrollIntoViewIfNeeded();
        await expect(description).toHaveAttribute('aria-selected', 'true');
        const area = page.getByRole('tablist').first().locator('xpath=..');
        const descriptionText = await area.innerText();
        await press(shipping);
        await expect(shipping).toHaveAttribute('aria-selected', 'true');
        await expect(description).toHaveAttribute('aria-selected', 'false');
        await expect.poll(() => area.innerText(), { message: 'visible panel text changes' }).not.toBe(descriptionText);
        await press(description);
        await expect(description).toHaveAttribute('aria-selected', 'true');
        await expect(shipping).toHaveAttribute('aria-selected', 'false');
        note('O5', `tabpanel elements: ${await page.getByRole('tabpanel').count()}`);
        await expect(page.getByRole('link', { name: 'Print Tear Sheet' })).toHaveAttribute('href', /variant=\d+.*view=print/);
    });

    test('Add to cart adds exactly the selected variant (verified with /cart.js)', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'abc', 'ABC only');
        test.setTimeout(150_000);
        const handle = handleOf(merchant.products.secondary.path);

        // 1. Clear the cart, reload once, choose Tall and Latte Taupe.
        await openEmpty(page, merchant.products.secondary.path, p => pdpTitle(p, merchant));
        await expect(badge(page, merchant)).toHaveText('0');
        const variant = await variantByTitle(page, handle, 'Tall / Latte Taupe');
        await chooseAlessia(page, merchant, 'Tall', 'Latte Taupe');
        const url = page.url();

        // 2. Click 'Add to cart' once.
        await addToCart(page, merchant);
        await expect(drawer(page, merchant)).toBeAttached();
        const cart = await readCart(page);
        expect(cart.items).toHaveLength(1);
        const line = cart.items[0];
        expect(line.title).toBe('Alessia Glazed Coffee Table - Tall / Latte Taupe');
        expect(line.variant_id).toBe(variant.id);
        expect(line.quantity).toBe(1);
        expect(line.price).toBe(variant.price);
        expect(line.sku).toBe(variant.sku);
        await expect(badge(page, merchant)).toHaveText('1');
        const text = drawer(page, merchant);
        await expect(text).toContainText('Size: Tall');
        await expect(text).toContainText('Color: Latte Taupe');
        await expect(text).toContainText(withCents(variant.price));

        // 3. Close the drawer and re-check the page.
        await closeDrawer(page, merchant);
        expect(page.url()).toBe(url);
        await expect.poll(() => selectedVariantText(page, merchant)).toBe('Tall / Latte Taupe');
        const sticky = page.locator(merchant.locators.get('stickyAtc'));
        await expect(sticky).toContainText('Alessia Glazed Coffee Table');
        await expect(sticky).toContainText(withCents(variant.price));
        const after = await readCart(page);
        expect(after.items, 'no double add').toHaveLength(1);
        expect(after.item_count).toBe(1);
        await clearCart(page);
        expect((await readCart(page)).item_count).toBe(0);
    });

    test('Reviews section, sticky bar and related products (read-only)', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'abc', 'ABC only');
        test.setTimeout(150_000);
        await load(page, merchant.products.secondary.path);
        await expect(pdpTitle(page, merchant)).toBeVisible({ timeout: 30_000 });
        const json = await productJson(page, handleOf(merchant.products.secondary.path));
        const defaultPrice = withCents(json.variants[0].price);

        // 1. Scroll to 'Customer Reviews'. Nothing in the review widget is clicked.
        const heading = page.getByText('Customer Reviews', { exact: true }).first();
        await heading.scrollIntoViewIfNeeded();
        await expect(heading).toBeVisible();
        const zeroState = page.getByText("We're looking for stars!");
        if (await zeroState.isVisible()) {
            await expect(page.getByText('Let us know what you think')).toBeVisible();
            await expect(page.getByRole('button', { name: 'Be the first to write a review!' })).toBeVisible();
            note('reviews', 'zero-review state');
        } else {
            const yotpo = page.locator('[class*="yotpo"]');
            await expect(yotpo.first()).toBeAttached();
            note('reviews', 'populated Yotpo widget');
        }

        // 2. Scroll through the buy box and below with the mouse wheel.
        await page.evaluate(() => window.scrollTo(0, 0));
        const sticky = page.locator(merchant.locators.get('stickyAtc'));
        for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 700); await page.waitForTimeout(200); }
        await expect(sticky).toBeVisible();
        await expect(sticky).toContainText('Alessia Glazed Coffee Table');
        await expect(sticky).toContainText(defaultPrice);
        const pairs = page.getByText('Pairs Well With').first();
        await pairs.scrollIntoViewIfNeeded();
        await expect(pairs).toBeVisible();
        const section = page.locator(merchant.locators.get('recommendations')).filter({ hasText: 'Pairs Well With' }).first();
        const productLinks = section.locator('a[href*="/products/"]');
        await expect.poll(() => productLinks.count(), { timeout: 20_000 }).toBeGreaterThanOrEqual(3);
        expect(await section.innerText()).toMatch(/\$[\d,]+(\.\d\d)?/);
        const fpt = page.getByText('Frequently Purchased Together').first();
        if (await fpt.count()) await expect(fpt).toBeAttached();
        await page.getByText('Recently Viewed').first().scrollIntoViewIfNeeded();
        await expect(page.getByText('Recently Viewed').first()).toBeAttached();
        expect(await scrollWidth(page), 'layout does not overflow horizontally').toBeLessThanOrEqual(page.viewportSize()!.width);
    });
});
