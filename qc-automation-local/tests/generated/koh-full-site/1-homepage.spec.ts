// spec: specs/koh-full-site.md
// seed: tests/seed.spec.ts
import { test, expect } from '../../../fixtures/base';
import {
    ONLY_KOH, brokenImages, collectConsoleErrors, fetchStatus, imagesWithoutAlt, load, note, overflow, pathOf, press, scrollThrough, sel,
} from './helpers';

test.describe('KOH whole site — 1. Homepage', () => {
    test('Homepage renders the announcement bar and key sections', { tag: '@smoke' }, async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        expect(await load(page, merchant.pages.homepage)).toBe(200);
        await expect(page).toHaveTitle(/Kreatures of Habit/);
        const bar = page.locator(sel(merchant, 'announcementBar')).first();
        await expect(bar).toContainText(/SAVE 41%/i);
        await expect(bar.locator('a[href*="/pages/bundle-builder"]').first()).toBeAttached();
        await expect(page.getByRole('heading', { name: /HIGH-PROTEIN OVERNIGHT OATS/i }).first()).toBeAttached();
        // Section set re-checked 2026-10-15 (the planner's list was older): problem, solution, audience, founder.
        for (const heading of ['.the-problem__heading', '.the-solution__heading', '.who-its-built-for__heading', '.meet-the-founder__heading']) {
            await expect(page.locator(heading).first(), `section ${heading}`).toBeAttached();
            expect((await page.locator(heading).first().textContent())?.trim().length, `${heading} has text`).toBeGreaterThan(3);
        }
        expect(await overflow(page), 'no horizontal scroll').toBeLessThanOrEqual(0);
    });

    test('Every homepage CTA points to a live page', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);
        test.setTimeout(120_000);

        await load(page, merchant.pages.homepage);
        const hrefs = await page.locator('main a[href^="/"]').evaluateAll(as => [...new Set(as.map(a => (a.getAttribute('href') || '').split('#')[0]).filter(Boolean))]);
        expect(hrefs.length, 'homepage has internal CTAs').toBeGreaterThan(0);
        expect(hrefs.some(h => h.startsWith('/collections/')), 'no CTA sends shoppers to a collection page').toBeFalsy();
        const bad: string[] = [];
        for (const href of hrefs) {
            const r = await fetchStatus(page, href);
            if (r.status !== 200) bad.push(`${href} -> ${r.status}`);
        }
        expect(bad, 'homepage CTAs that do not return 200').toEqual([]);

        await press(page.getByRole('link', { name: /SHOP MEAL ONE/i }).first());
        await expect.poll(() => pathOf(page.url())).toBe(merchant.products.default.path);
        await page.goBack({ waitUntil: 'domcontentloaded' });
        await press(page.getByRole('link', { name: /SHOP BAR/i }).first());
        await expect.poll(() => pathOf(page.url())).toBe(merchant.products.secondary.path);
    });

    test('Homepage images load and every image has alt text', { tag: '@full' }, async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        await load(page, merchant.pages.homepage);
        await scrollThrough(page);
        await page.waitForTimeout(1_500);
        expect(await brokenImages(page.locator('body')), 'broken images').toEqual([]);
        // O10: images without an alt attribute (accessibility). Real defect, kept red.
        const noAlt = await imagesWithoutAlt(page.locator('main'));
        if (noAlt.length) note('O10', `${noAlt.length} homepage images have no alt: ${noAlt.slice(0, 5).join(', ')}`);
        expect(noAlt.length, 'homepage <img> without alt attribute (O10)').toBe(0);
    });

    test('Homepage console has no errors from the site itself', { tag: '@full' }, async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        const errors = collectConsoleErrors(page);
        await load(page, merchant.pages.homepage);
        await page.waitForTimeout(6_000);
        if (errors.known().length) note('O3/O14', `Known third-party console errors: ${errors.known().slice(0, 6).join(' | ').slice(0, 600)}`);
        expect(errors.unknown(), 'new console errors (not the known third-party noise)').toEqual([]);
    });

    test('Klaviyo popup can be closed without signing up', { tag: '@full' }, async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        await load(page, merchant.pages.homepage);
        // The popupGuard fixture closes it automatically; either it never showed or it is closed now.
        await page.waitForTimeout(8_000);
        await expect(page.locator('body')).not.toHaveClass(/klaviyo-prevent-body-scrolling/, { timeout: 15_000 });
        await page.mouse.wheel(0, 1200);
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    });
});
