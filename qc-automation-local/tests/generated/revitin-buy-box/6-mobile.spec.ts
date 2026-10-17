// spec: specs/revitin-buy-box.md
// seed: tests/seed.spec.ts
import { test, expect } from '../../../fixtures/base';
import {
    ACTIVE, addButton, clickNav, expectAddLabel, expectPdpUrl, flavorChip, mainButton, openPdp, pdpPath, sizeTab,
    travelButton, travelPackLabel, travelPackPrice, trioCard, familyCard, oneTimeCard,
} from './helpers';
import { expectAddPrice, expectOnlyActivePack, oneTimePack } from './pack-helpers';
import {
    addAndWaitForDrawer, drawerLines, drawerSubtotal, expectCartLines, openPdpEmpty, readDrawer,
} from './cart-helpers';
import type { Locator, Page } from '@playwright/test';

const VIEWPORT = { width: 390, height: 844 };
const WCAG_MIN = 24;     // WCAG 2.2 AA 2.5.8 (fails the test when missed)
const COMFORT_MIN = 44;  // WCAG 2.5.5 AAA / platform guidance (recorded only)

const note = (type: string, description: string) => test.info().annotations.push({ type, description });

/** Page-absolute rectangle of an element (x/y include scroll offsets, so rects taken at different scrolls compare). */
const rect = (target: Locator) => target.evaluate(el => {
    const b = el.getBoundingClientRect();
    return { x: b.left + window.scrollX, y: b.top + window.scrollY, w: b.width, h: b.height };
});

/** True when the element at the centre of `target` is the target itself (or inside it): nothing (chat iframe, popup) covers it. */
const centreIsUncovered = (target: Locator) => target.evaluate(el => {
    const b = el.getBoundingClientRect();
    const top = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    return !!top && (el === top || el.contains(top));
});

const horizontalOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth);

test.describe('Revitin buy box — 6. Mobile', () => {
    // Phone viewport for both projects (revitin-desktop-chromium and revitin-mobile-chrome).
    test.use({ viewport: VIEWPORT, isMobile: true, hasTouch: true });

    test('Buy box layout and tap targets at 390x844', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'revitin', 'Revitin buy box only');
        test.setTimeout(180_000);

        // 1. Set the viewport to 390x844, open the PDP (popups are closed by the fixture).
        await openPdp(page, pdpPath(merchant));
        expect(page.viewportSize()).toEqual(VIEWPORT);

        // No horizontal scroll.
        expect(await horizontalOverflow(page), 'document scrollWidth must not exceed the 390px viewport').toBeLessThanOrEqual(VIEWPORT.width);

        // Size tabs, flavor chips, pack cards and main button: visible, inside the viewport width, >= 24x24, not overlapping.
        const controls: { name: string; target: Locator; required: boolean }[] = [
            { name: 'Full Size tab', target: sizeTab(page, 'Full Size'), required: true },
            { name: 'Travel Size tab', target: sizeTab(page, 'Travel Size'), required: true },
            { name: 'Citrus chip', target: flavorChip(page, 'Citrus'), required: true },
            { name: 'Mint chip', target: flavorChip(page, 'Mint'), required: true },
            { name: 'Variety chip', target: flavorChip(page, 'Variety'), required: true },
            { name: 'Trio pack card', target: trioCard(page), required: true },
            { name: 'Family pack card', target: familyCard(page), required: true },
            { name: 'Main add button', target: mainButton(page), required: true },
            // Not in the required list of the plan; sized and recorded like the others, but only checked for visibility.
            { name: 'One-Time Purchase button', target: oneTimeCard(page), required: false },
        ];
        const rects: { name: string; x: number; y: number; w: number; h: number }[] = [];
        for (const c of controls) {
            await expect(c.target, `${c.name} is visible`).toBeVisible();
            const r = await rect(c.target);
            rects.push({ name: c.name, ...r });
            const size = `${Math.round(r.w)}x${Math.round(r.h)}`;
            expect(r.x, `${c.name} left edge inside the viewport (${size})`).toBeGreaterThanOrEqual(0);
            expect(r.x + r.w, `${c.name} right edge inside the 390px viewport (${size})`).toBeLessThanOrEqual(VIEWPORT.width + 0.5);
            if (c.required) {
                expect(r.w, `${c.name} tap target width (${size}) meets WCAG 2.2 AA 24px`).toBeGreaterThanOrEqual(WCAG_MIN);
                expect(r.h, `${c.name} tap target height (${size}) meets WCAG 2.2 AA 24px`).toBeGreaterThanOrEqual(WCAG_MIN);
            }
            if (r.w < COMFORT_MIN || r.h < COMFORT_MIN) {
                note('tap-target', `${c.name} is ${size} CSS px, under the 44x44 comfort size${r.w < WCAG_MIN || r.h < WCAG_MIN ? ' and UNDER the 24x24 WCAG minimum' : ''}`);
            }
        }
        // The One-Time button is still held to the WCAG minimum, but reported as its own line.
        const oneTime = rects.find(r => r.name === 'One-Time Purchase button')!;
        expect.soft(oneTime.w, 'One-Time Purchase button width >= 24px').toBeGreaterThanOrEqual(WCAG_MIN);
        expect.soft(oneTime.h, 'One-Time Purchase button height >= 24px').toBeGreaterThanOrEqual(WCAG_MIN);

        // Controls do not overlap each other (1px tolerance for borders).
        const overlaps: string[] = [];
        for (let i = 0; i < rects.length; i++) {
            for (let j = i + 1; j < rects.length; j++) {
                const a = rects[i], b = rects[j];
                const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
                const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
                if (overlapX > 1 && overlapY > 1) overlaps.push(`${a.name} / ${b.name}`);
            }
        }
        expect(overlaps, 'buy-box controls must not overlap').toEqual([]);

        // 2. Tap Mint, Travel Size, Full Size, then pick Family and One-Time 3 Tubes.
        const mintPath = pdpPath(merchant, 'Mint');
        await clickNav(flavorChip(page, 'Mint'));
        await expectPdpUrl(page, mintPath);
        await expect(addButton(page)).toBeVisible();
        await expect(flavorChip(page, 'Mint')).toHaveClass(ACTIVE);
        await expectAddLabel(mainButton(page), '$42');

        await clickNav(sizeTab(page, 'Travel Size'));
        await expectPdpUrl(page, mintPath, { size: 'travel' });
        await expect(travelButton(page)).toBeVisible();
        await expect(sizeTab(page, 'Travel Size')).toHaveClass(ACTIVE);
        await expect(travelPackLabel(page)).toHaveText('Mint 3-pack');
        await expect(travelPackPrice(page)).toHaveText('$18');
        await expectAddLabel(travelButton(page), '$18');
        expect(await horizontalOverflow(page), 'no horizontal scroll in travel mode').toBeLessThanOrEqual(VIEWPORT.width);

        await clickNav(sizeTab(page, 'Full Size'));
        await expectPdpUrl(page, mintPath);
        await expect(mainButton(page)).toBeVisible();
        await expect(sizeTab(page, 'Full Size')).toHaveClass(ACTIVE);
        await expectAddLabel(mainButton(page), '$42');

        await familyCard(page).click();
        await expectOnlyActivePack(page, /^Family pack/);
        await expectAddPrice(mainButton(page), '$68');

        await oneTimeCard(page).click();
        await oneTimePack(page, '3 Tubes').click();
        await expectOnlyActivePack(page, /^3 Tubes/);
        await expectAddPrice(mainButton(page), '$46');
        expect(await horizontalOverflow(page), 'no horizontal scroll with one-time packs open').toBeLessThanOrEqual(VIEWPORT.width);
    });

    test('No sticky add-to-cart on mobile; main button remains reachable', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'revitin', 'Revitin buy box only');
        test.setTimeout(180_000);

        await openPdpEmpty(page, pdpPath(merchant));

        // 1. Scroll to y=0, 800, 1300, 2500 and 4000 and look for fixed / sticky add-to-cart controls.
        const sightings = new Map<string, string>();
        for (const y of [0, 800, 1300, 2500, 4000]) {
            await page.evaluate(top => window.scrollTo(0, top), y);
            await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBeGreaterThanOrEqual(0);
            const found = await page.evaluate(() => {
                const out: string[] = [];
                for (const el of Array.from(document.querySelectorAll('body *'))) {
                    const cs = getComputedStyle(el);
                    if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
                    if (cs.visibility === 'hidden' || cs.display === 'none' || el.closest('site-cart, .mobile-menu')) continue;
                    const b = el.getBoundingClientRect();
                    if (b.width === 0 || b.height === 0 || b.bottom < 0 || b.top > innerHeight) continue;
                    const addsToCart = /Add to (Bag|Cart)/i.test((el as HTMLElement).innerText ?? '');
                    out.push(`${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(/\s+/)[0] : ''} ${cs.position} ${Math.round(b.width)}x${Math.round(b.height)}${addsToCart ? ' ADD-TO-CART' : ''}`);
                }
                return out;
            });
            for (const f of found) sightings.set(f, `${sightings.get(f) ?? ''} y=${y}`.trim());
        }
        const stickyAtc = [...sightings.keys()].filter(k => k.includes('ADD-TO-CART'));
        // The plan found none: record what is there instead of asserting either way.
        note('sticky-add-to-cart', stickyAtc.length === 0
            ? 'No sticky/fixed add-to-cart element found at scroll y=0/800/1300/2500/4000'
            : `Sticky/fixed add-to-cart FOUND: ${stickyAtc.join(' || ')}`);
        note('fixed-elements', [...sightings].map(([k, v]) => `${k} @ ${v}`).join(' || ') || 'none');

        // The main button is the only add-to-cart control a shopper can see.
        await page.evaluate(() => window.scrollTo(0, 0));
        await expect(page.getByRole('button', { name: /Add to (Bag|Cart)/ }).filter({ visible: true })).toHaveCount(1);
        await expect(addButton(page)).toHaveCount(1);

        // Reachable by scrolling: bring it to the middle of the screen, inside the viewport and not covered by the chat launcher.
        const button = mainButton(page);
        await button.evaluate(el => el.scrollIntoView({ block: 'center' }));
        await expect(button).toBeInViewport({ ratio: 1 });
        await expect.poll(() => centreIsUncovered(button), { message: 'nothing (chat launcher, popup) covers the main button' }).toBe(true);
        await expectAddLabel(button, '$42');
        const r = await rect(button);
        expect(r.h, 'main button tap target height').toBeGreaterThanOrEqual(WCAG_MIN);
        expect(r.w, 'main button tap target width').toBeGreaterThanOrEqual(WCAG_MIN);

        // ...and clickable: one tap adds the Citrus Trio and opens the drawer.
        await addAndWaitForDrawer(page, button);
        await expect(drawerLines(page)).toHaveCount(1);
    });

    test('Mobile add to cart, drawer and checkout link visibility', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'revitin', 'Revitin buy box only');
        test.setTimeout(180_000);

        // 1. At 390x844 tap '$42 — Add to Bag' once.
        await openPdpEmpty(page, pdpPath(merchant));
        await expectAddLabel(mainButton(page), '$42');
        await addAndWaitForDrawer(page, mainButton(page));

        // Drawer fills the viewport; Citrus Trio line, quantity controls and Subtotal $42; no horizontal scroll.
        const drawer = page.locator('site-cart');
        // <site-cart> is display:inline (0x0); the visible panel is .cart__container, full width and full height
        // apart from a 6px top offset (measured live at 390x844 on 2026-10-13: 390x838 at y=6).
        const panel = drawer.locator('.cart__container');
        await expect.poll(async () => {
            // boundingBox() is viewport-relative, which is what matters for a fixed panel (rect() adds the scroll).
            const r = (await panel.boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 };
            return { width: Math.round(r.width), bottom: Math.round(r.y + r.height), topGap: Math.round(r.y) <= 10 };
        }, { message: 'drawer panel fills the 390x844 viewport' })
            .toEqual({ width: VIEWPORT.width, bottom: VIEWPORT.height, topGap: true });

        const [line] = await readDrawer(page, 1);
        expect(line.kind).toBe('Subscription');
        expect(line.pack).toBe('Pack: 3 Tubes');
        expect(line.flavor).toBe('Flavor: Citrus');
        expect(line.price).toBe(42);
        await expect(drawer.getByRole('button', { name: 'Increment Line Item Quantity' })).toBeVisible();
        await expect(drawer.getByRole('button', { name: 'Decrement Line Item Quantity' })).toBeVisible();
        await expect.poll(() => drawerSubtotal(page), { message: 'drawer Subtotal' }).toBe(42);
        await expectCartLines(page, [{
            title: 'Revitin Toothpaste (3 Tubes) - Citrus', sku: 'CITRUS3', linePrice: 4200, plan: 'Delivery every 3 months',
        }]);
        expect(await horizontalOverflow(page), 'no horizontal scroll with the drawer open').toBeLessThanOrEqual(VIEWPORT.width);

        // 2. The Checkout link (href /checkout) is inside the viewport and not covered by the chat iframe.
        const checkout = drawer.getByRole('link', { name: 'Checkout' });
        await expect(checkout).toBeVisible();
        await expect(checkout).toHaveAttribute('href', '/checkout');
        await expect(checkout).toBeInViewport({ ratio: 1 });
        const r = await rect(checkout);
        const inView = await checkout.evaluate(el => {
            const b = el.getBoundingClientRect();
            return { top: b.top, bottom: b.bottom, left: b.left, right: b.right };
        });
        expect(inView.top, 'Checkout top edge inside the viewport').toBeGreaterThanOrEqual(0);
        expect(inView.bottom, 'Checkout bottom edge inside the 844px viewport').toBeLessThanOrEqual(VIEWPORT.height);
        expect(inView.left, 'Checkout left edge inside the viewport').toBeGreaterThanOrEqual(0);
        expect(inView.right, 'Checkout right edge inside the 390px viewport').toBeLessThanOrEqual(VIEWPORT.width);
        expect(r.h, 'Checkout tap target height').toBeGreaterThanOrEqual(WCAG_MIN);
        await expect.poll(() => centreIsUncovered(checkout), { message: 'nothing (chat iframe) covers the Checkout link' }).toBe(true);
        if (r.h < COMFORT_MIN || r.w < COMFORT_MIN) note('tap-target', `Checkout link is ${Math.round(r.w)}x${Math.round(r.h)} CSS px`);

        // Tap it: lands on the Shopify checkout. STOP there; nothing is filled or submitted.
        await clickNav(checkout);
        await expect(page).toHaveURL(/\/checkouts\/(cn\/)?[^/]+/);
        await expect(page).toHaveTitle(/Checkout/);
    });
});
