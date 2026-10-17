// spec: specs/revitin-buy-box.md
// seed: tests/seed.spec.ts
import { test, expect } from '../../../fixtures/base';
import { addButton, clickNav, mainButton, openPdp, pdpPath, readCart, travelPackLabel, travelPackPrice } from './helpers';
import { varietyButton } from './pack-helpers';
import {
    addAndWaitForDrawer, cartBadge, cartLines, drawerLines, drawerSubtotal, drawerUpsells, openPdpEmpty, readDrawer,
    readUpsells,
} from './cart-helpers';
import type { Locator, Page } from '@playwright/test';

const note = (type: string, description: string) => test.info().annotations.push({ type, description });

// O5: the server HTML holds a travel-pack control 'Citrus 3-pack' / '$16 — Add to Bag' that the page script rewrites
// to $18 (and hides in full-size mode) before shoppers see it. There is no real $16 upsell on the PDP.
const upsellButton = (page: Page) => page.getByRole('button', { name: /\$16\s*—?\s*Add to Bag/ }).filter({ visible: true });

test.describe('Revitin buy box — 4. Upsell and checkout', () => {
    test('PDP never shows the stale $16 travel-pack price', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'revitin', 'Revitin buy box only');
        test.setTimeout(240_000);

        // On the default PDP, /Mint, ?pack=variety and ?size=travel (travel last, its pack is checked below).
        const states: { name: string; path: string; ready: (p: Page) => Locator }[] = [
            { name: 'default PDP', path: pdpPath(merchant), ready: addButton },
            { name: '/Mint', path: pdpPath(merchant, 'Mint'), ready: addButton },
            { name: '?pack=variety', path: `${pdpPath(merchant)}?pack=variety`, ready: varietyButton },
            { name: '?size=travel', path: `${pdpPath(merchant, 'Citrus')}?size=travel`, ready: addButton },
        ];
        for (const s of states) {
            await openPdpEmpty(page, s.path, s.ready);
            // A shopper must never see the stale $16 / 'Citrus 3-pack $16 — Add to Bag' text: the travel product
            // costs $18 (cart line 1800, suite 3), so a visible $16 would be a price the cart doesn't honour.
            await expect(upsellButton(page), `${s.name}: no visible '$16 — Add to Bag'`).toHaveCount(0);
            await expect(page.getByText(/\$16(\.00)?\b/).filter({ visible: true }), `${s.name}: no visible $16 price`)
                .toHaveCount(0);
        }
        // In travel mode the rewritten pack shows the real $18 price.
        await expect(travelPackLabel(page)).toHaveText('Citrus 3-pack');
        await expect(travelPackPrice(page)).toHaveText('$18');
    });

    test('Drawer cross-flavor upsell adds the correct item without leaving the page', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'revitin', 'Revitin buy box only');
        test.setTimeout(120_000);

        // 1. Add Mint Trio to the bag; read the 'You May Also Like' card in the drawer, then click 'Add'.
        const mintPath = pdpPath(merchant, 'Mint');
        await openPdpEmpty(page, mintPath);
        await addAndWaitForDrawer(page, mainButton(page));

        // Card reads 'Most Added | Mint Travel 3-Pack of 1oz | $18 | Flavor: Mint | Add' (whitespace-insensitive).
        const card = drawerUpsells(page).filter({ hasText: 'Mint Travel 3-Pack of 1oz' });
        await expect(card).toHaveCount(1);
        await expect(card).toBeVisible();
        const cards = (await readUpsells(page)).map(t => t.replace(/\s*\|\s*/g, ' ').replace(/\s+/g, ' '));
        expect(cards.find(t => t.includes('Mint Travel 3-Pack of 1oz'))).toBe('Most Added Mint Travel 3-Pack of 1oz $18 Flavor: Mint Add');

        await card.getByRole('button', { name: 'Add', exact: true }).click();

        // URL stays on /Mint; /cart.js has 2 lines (MINT3 at 4200 with plan, MintTravel3-pk at 1800). Line order is not asserted.
        await expect.poll(async () => (await cartLines(page)).length, { message: '/cart.js line count' }).toBe(2);
        const lines = await cartLines(page);
        const trio = lines.find(l => l.sku === 'MINT3');
        const travel = lines.find(l => l.sku === 'MintTravel3-pk');
        expect(trio, 'Mint Trio line is still in the cart').toBeDefined();
        expect(trio!.linePrice).toBe(4200);
        expect(trio!.planName, 'Trio keeps its subscription plan').toBe('Delivery every 3 months');
        expect(travel, 'the upsold Mint travel 3-pack line was added').toBeDefined();
        expect(travel!.linePrice).toBe(1800);
        expect(travel!.planName, 'travel line has no selling plan').toBeNull();
        expect(travel!.quantity).toBe(1);
        expect(new URL(page.url()).pathname, 'still on the Mint PDP').toBe(mintPath);

        // Drawer shows both lines and Subtotal $60; the clicked card is gone or replaced.
        const drawer = await readDrawer(page, 2);
        expect(drawer.map(l => l.flavor)).toEqual(['Flavor: Mint', 'Flavor: Mint']);
        await expect.poll(() => drawerSubtotal(page), { message: 'drawer Subtotal' }).toBe(60);
        await expect(drawerUpsells(page).filter({ hasText: 'Mint Travel 3-Pack of 1oz' }), 'clicked card is gone').toHaveCount(0);
        note('record', `Upsells after add: ${(await readUpsells(page)).join(' || ') || 'none'}`);

        // The header badge shows 2 (the cart holds 2 items).
        expect((await readCart(page)).item_count).toBe(2);
        await expect(cartBadge(page, 2), 'header badge shows 2 after the upsell add').toBeVisible();
    });

    test('Drawer Checkout reaches the Shopify checkout URL', { tag: '@smoke' }, async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'revitin', 'Revitin buy box only');
        test.setTimeout(120_000);

        // 1. Add the default Citrus Trio, open the drawer, click the 'Checkout' link.
        await openPdpEmpty(page, pdpPath(merchant));
        await addAndWaitForDrawer(page, mainButton(page));
        await expect(drawerLines(page)).toHaveCount(1);
        const checkout = page.locator('site-cart').getByRole('link', { name: 'Checkout' });
        await expect(checkout).toBeVisible();
        await expect(checkout).toHaveAttribute('href', '/checkout');
        await clickNav(checkout);

        // Lands on /checkouts/cn/<token>/en-us?_r=... titled 'Checkout - Revitin'. STOP: nothing is filled or submitted.
        await expect(page).toHaveURL(/\/checkouts\/(cn\/)?[^/]+/);
        await expect(page).toHaveTitle(/Checkout/);
    });
});
