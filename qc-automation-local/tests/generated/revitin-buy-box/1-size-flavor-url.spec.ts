// spec: specs/revitin-buy-box.md
// seed: tests/seed.spec.ts
import { test, expect } from '../../../fixtures/base';
import {
    ACTIVE, PDP_TITLE, addButton, expectAddLabel, clickNav, expectPdpUrl, familyCard, flavorChip, mainButton, oneTimeCard, openPdp,
    pdpPath, readCart, reviewBadge, sizeTab, travelButton, travelPackLabel, travelPackPrice, trioCard,
} from './helpers';
import type { Page } from '@playwright/test';

// Desktop gallery: one [data-swap-flavor] group per flavor inside .image_update_container; the shown one has
// computed opacity 1 (the other 0). The mobile slider and the lower banner use the same attribute, so scope it.
const galleryGroup = (page: Page, flavor: 'Citrus' | 'Mint') =>
    page.locator(`.image_update_container [data-swap-flavor="${flavor}"]`);

// File names + alt text of every <img> in the gallery group(s) that are currently shown.
const shownGalleryImages = (page: Page) =>
    page.locator('.image_update_container [data-swap-flavor]').evaluateAll(groups =>
        groups.filter(g => getComputedStyle(g).opacity === '1').flatMap(g =>
            [...g.querySelectorAll('img')].map(i => `${(i.currentSrc || i.src).split('/').pop()} ${i.alt}`.trim())));

// Frequency combobox sits inside the Trio card; assert on its checked <option>.
const trioFrequency = (page: Page) => trioCard(page).getByRole('combobox').locator('option:checked');

test.describe('Revitin buy box — 1. Size, flavor and URL', () => {
    test('Default PDP state', { tag: '@smoke' }, async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'revitin', 'Revitin buy box only');

        // 1. Open /products/revitin-natural-toothpaste on a fresh context; popups are closed by the fixture.
        await openPdp(page, pdpPath(merchant));
        await expect(page.getByRole('heading', { name: 'Revitin Natural Toothpaste', level: 3 })).toBeVisible();
        // The count grows over time (881 on 2026-10-13), so match the shape, not the number.
        await expect(reviewBadge(page)).toBeVisible();
        await expect(page).toHaveTitle(PDP_TITLE);
        await expect(sizeTab(page, 'Full Size')).toHaveClass(ACTIVE);
        await expect(sizeTab(page, 'Travel Size')).not.toHaveClass(ACTIVE);
        await expect(flavorChip(page, 'Citrus')).toHaveClass(ACTIVE);
        await expect(flavorChip(page, 'Mint')).not.toHaveClass(ACTIVE);
        await expect(flavorChip(page, 'Variety')).not.toHaveClass(ACTIVE);
        await expect(galleryGroup(page, 'Citrus')).toHaveCSS('opacity', '1');

        // 2. Inspect purchase options and the main button.
        // The heading exists twice in the DOM; at least one copy must be on screen.
        await expect(page.getByText('Subscribe & Save up to 20%', { exact: true }).filter({ visible: true }).first())
            .toBeVisible();
        await expect(trioCard(page)).toContainText('Most Popular');
        await expect(trioCard(page)).toContainText('$42');
        await expect(trioCard(page)).toContainText('$51');
        await expect(trioCard(page)).toContainText('Save 18%');
        await expect(trioCard(page)).toHaveClass(ACTIVE);
        await expect(familyCard(page)).toContainText('$68');
        await expect(familyCard(page)).toContainText('$85');
        await expect(familyCard(page)).toContainText('Save 20%');
        await expect(familyCard(page)).not.toHaveClass(ACTIVE);
        await expect(trioFrequency(page)).toHaveText('3 months');
        await expect(oneTimeCard(page)).toBeVisible();
        await expect(page.getByText('$17', { exact: true }).filter({ visible: true })).toHaveCount(1);
        await expectAddLabel(mainButton(page), '$42');
        await expect(page.getByText('30-Day Money Back Guarantee')).toBeVisible();

        // Cart badge reads 0 and /cart.js is empty on a fresh context.
        await expect(page.getByRole('button', { name: 'Cart 0' })).toBeVisible();
        expect((await readCart(page)).item_count).toBe(0);

        // Record (not assert): no sticky add-to-cart bar and no Afterpay/Klarna placement is expected today.
        const sticky = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(e => {
            const pos = getComputedStyle(e).position;
            return (pos === 'fixed' || pos === 'sticky') && !!(e as HTMLElement).offsetWidth &&
                /Add to (Bag|Cart)/.test((e as HTMLElement).innerText || '');
        }).length);
        const installments = await page.locator('afterpay-placement, klarna-placement, shopify-payment-terms').count();
        test.info().annotations.push({
            type: 'record',
            description: `sticky add-to-cart elements: ${sticky}; Afterpay/Klarna/payment-terms placements: ${installments}`,
        });
    });

    test('Flavor chips change the URL path and selection', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'revitin', 'Revitin buy box only');
        const product = pdpPath(merchant);
        const mint = pdpPath(merchant, 'Mint');
        const citrus = pdpPath(merchant, 'Citrus');

        // 1. Open the PDP and click the 'Mint' chip with noWaitAfter, then wait for the URL.
        await openPdp(page, product);
        await clickNav(flavorChip(page, 'Mint'));
        await expectPdpUrl(page, mint);
        await expect(mainButton(page)).toBeVisible();
        await expect(flavorChip(page, 'Mint')).toHaveClass(ACTIVE);
        await expect(flavorChip(page, 'Citrus')).not.toHaveClass(ACTIVE);
        await expect(galleryGroup(page, 'Mint')).toHaveCSS('opacity', '1');
        await expect(galleryGroup(page, 'Citrus')).toHaveCSS('opacity', '0');
        await expectAddLabel(mainButton(page), '$42');

        // 2. Click 'Citrus'.
        await clickNav(flavorChip(page, 'Citrus'));
        await expectPdpUrl(page, citrus);
        await expect(mainButton(page)).toBeVisible();
        await expect(flavorChip(page, 'Citrus')).toHaveClass(ACTIVE);
        await expect(flavorChip(page, 'Mint')).not.toHaveClass(ACTIVE);
        await expect(galleryGroup(page, 'Citrus')).toHaveCSS('opacity', '1');
        await expect(galleryGroup(page, 'Mint')).toHaveCSS('opacity', '0');

        // 3. Open /Mint and /Citrus directly, then use the header 'Shop' link and the announcement bar link.
        await openPdp(page, mint);
        await expect(sizeTab(page, 'Full Size')).toHaveClass(ACTIVE);
        await expect(flavorChip(page, 'Mint')).toHaveClass(ACTIVE);
        await expect(flavorChip(page, 'Citrus')).not.toHaveClass(ACTIVE);

        await openPdp(page, citrus);
        await expect(sizeTab(page, 'Full Size')).toHaveClass(ACTIVE);
        await expect(flavorChip(page, 'Citrus')).toHaveClass(ACTIVE);
        await expect(flavorChip(page, 'Mint')).not.toHaveClass(ACTIVE);

        // From /Citrus, header 'Shop' lands on /Mint with Mint selected.
        await clickNav(page.getByRole('link', { name: 'Shop', exact: true }));
        await expectPdpUrl(page, mint);
        await expect(mainButton(page)).toBeVisible();
        await expect(flavorChip(page, 'Mint')).toHaveClass(ACTIVE);
        await expect(sizeTab(page, 'Full Size')).toHaveClass(ACTIVE);

        // Back on /Citrus, the announcement bar link does the same.
        await openPdp(page, citrus);
        await clickNav(page.getByRole('link', { name: 'Subscribe & Get Free Shipping on Every Order' }));
        await expectPdpUrl(page, mint);
        await expect(mainButton(page)).toBeVisible();
        await expect(flavorChip(page, 'Mint')).toHaveClass(ACTIVE);
        await expect(sizeTab(page, 'Full Size')).toHaveClass(ACTIVE);

        // 4. Unknown flavor path: no 404, buy box intact, falls back to Citrus (O10: silent fallback, record).
        const response = await page.goto(pdpPath(merchant, 'Banana'), { waitUntil: 'domcontentloaded' });
        expect(response?.status()).toBe(200);
        await expect(mainButton(page)).toBeVisible();
        await expect(page).toHaveTitle(PDP_TITLE);
        await expect(sizeTab(page, 'Full Size')).toHaveClass(ACTIVE);
        await expect(flavorChip(page, 'Citrus')).toHaveClass(ACTIVE);
        await expect(flavorChip(page, 'Mint')).not.toHaveClass(ACTIVE);
        await expect(trioCard(page)).toBeVisible();
    });

    test('Full Size to Travel Size tab: what changes', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'revitin', 'Revitin buy box only');
        const mint = pdpPath(merchant, 'Mint');

        // 1. On /Mint click 'Travel Size' (noWaitAfter) and wait for the URL.
        await openPdp(page, mint);
        await clickNav(sizeTab(page, 'Travel Size'));
        await expectPdpUrl(page, mint, { size: 'travel' });
        await expect(travelButton(page)).toBeVisible();
        await expect(sizeTab(page, 'Travel Size')).toHaveClass(ACTIVE);
        await expect(sizeTab(page, 'Full Size')).not.toHaveClass(ACTIVE);
        await expect(page.getByRole('heading', { name: 'Revitin Travel Size Toothpaste', level: 3 })).toBeVisible();
        // Subscribe & Save cards, One-Time Purchase card and frequency combobox are gone.
        await expect(trioCard(page)).toHaveCount(0);
        await expect(familyCard(page)).toHaveCount(0);
        await expect(oneTimeCard(page)).toHaveCount(0);
        // Two copies of the heading stay in the DOM (both hidden in travel mode).
        await expect(page.getByText('Subscribe & Save up to 20%').filter({ visible: true })).toHaveCount(0);
        await expect(page.getByRole('combobox')).toHaveCount(0);
        // One fixed pack at $18.
        await expect(travelPackLabel(page)).toHaveText('Mint 3-pack');
        await expect(travelPackPrice(page)).toHaveText('$18');
        await expectAddLabel(travelButton(page), '$18');
        await expect(mainButton(page)).toHaveCount(0);
        // Mint stays selected in the travel chip set; title is unchanged.
        await expect(flavorChip(page, 'Mint')).toHaveClass(/\bts-flavor-btn\b.*\bts-mint\b.*\bactive\b/);
        await expect(flavorChip(page, 'Citrus')).not.toHaveClass(ACTIVE);
        await expect(page).toHaveTitle(PDP_TITLE);

        // 2. Click 'Full Size' again.
        await clickNav(sizeTab(page, 'Full Size'));
        await expectPdpUrl(page, mint);
        await expect(mainButton(page)).toBeVisible();
        await expect(sizeTab(page, 'Full Size')).toHaveClass(ACTIVE);
        await expect(sizeTab(page, 'Travel Size')).not.toHaveClass(ACTIVE);
        await expect(trioCard(page)).toHaveClass(ACTIVE);
        await expect(familyCard(page)).toBeVisible();
        await expect(oneTimeCard(page)).toBeVisible();
        await expect(trioFrequency(page)).toHaveText('3 months');
        await expectAddLabel(mainButton(page), '$42');

        // 3. Open /Citrus?size=travel directly.
        await openPdp(page, `${pdpPath(merchant, 'Citrus')}?size=travel`);
        await expect(travelButton(page)).toBeVisible();
        await expect(sizeTab(page, 'Travel Size')).toHaveClass(ACTIVE);
        await expect(sizeTab(page, 'Full Size')).not.toHaveClass(ACTIVE);
        await expect(flavorChip(page, 'Citrus')).toHaveClass(/\bts-citrus\b.*\bactive\b/);
        await expect(flavorChip(page, 'Mint')).not.toHaveClass(ACTIVE);
        await expect(travelPackLabel(page)).toHaveText('Citrus 3-pack');
        await expect(travelPackPrice(page)).toHaveText('$18');
        await expectAddLabel(travelButton(page), '$18');
    });

    test('Travel size flavors and the Variety travel pack', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'revitin', 'Revitin buy box only');
        const mint = pdpPath(merchant, 'Mint');

        // 1. Open /Citrus?size=travel, click the Mint chip (.ts-flavor-btn.ts-mint), then the Variety chip.
        await openPdp(page, `${pdpPath(merchant, 'Citrus')}?size=travel`);
        await clickNav(flavorChip(page, 'Mint'));
        await expectPdpUrl(page, mint, { size: 'travel' });
        await expect(travelPackLabel(page)).toHaveText('Mint 3-pack');
        await expect(travelPackPrice(page)).toHaveText('$18');
        await expect(flavorChip(page, 'Mint')).toHaveClass(/\bts-mint\b.*\bactive\b/);
        await expect(flavorChip(page, 'Citrus')).not.toHaveClass(ACTIVE);
        await expect(flavorChip(page, 'Variety')).not.toHaveClass(ACTIVE);
        // O7: after the client-side switch the gallery must show Mint imagery, not Citrus.
        await expect.poll(async () => (await shownGalleryImages(page)).filter(s => /citrus/i.test(s)))
            .toEqual([]);

        await clickNav(flavorChip(page, 'Variety'));
        await expectPdpUrl(page, mint, { size: 'travel', pack: 'variety' });
        await expect(travelPackLabel(page)).toHaveText('2 Mint & 2 Citrus');
        await expect(travelPackPrice(page)).toHaveText('$24');
        await expectAddLabel(travelButton(page), '$24');
        await expect(flavorChip(page, 'Variety')).toHaveClass(/\bts-variety\b.*\bactive\b/);
        await expect(flavorChip(page, 'Mint')).not.toHaveClass(ACTIVE);
        await expect(flavorChip(page, 'Citrus')).not.toHaveClass(ACTIVE);

        // 2. Load /Mint?size=travel fresh and inspect the visible gallery (image src/alt).
        await openPdp(page, `${mint}?size=travel`);
        await expect(flavorChip(page, 'Mint')).toHaveClass(/\bts-mint\b.*\bactive\b/);
        // O7: the shown gallery group is labelled data-swap-flavor="Citrus" in travel mode but holds the travel
        // images, so judge by image file names: Mint imagery first, no Citrus imagery anywhere.
        await expect.poll(async () => (await shownGalleryImages(page))[0]).toMatch(/mint/i);
        expect((await shownGalleryImages(page)).filter(s => /citrus/i.test(s))).toEqual([]);
    });
});
