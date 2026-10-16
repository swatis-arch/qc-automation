// spec: specs/koh-full-site.md
// seed: tests/seed.spec.ts
import { test, expect } from '../../../fixtures/base';
import { ONLY_KOH, fetchStatus, load, note, sel } from './helpers';

test.describe('KOH whole site — 10. Account login page', () => {
    test('/a/account/login renders the Skio login (nothing entered)', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        const posts: string[] = [];
        // Only login calls from the page itself; analytics beacons carry the page URL (…/account/login) in their query.
        page.on('request', r => {
            const u = new URL(r.url());
            if (r.method() === 'POST' && !/google|doubleclick|analytics|pixel|collect/i.test(u.hostname + u.pathname)
                && /login|sendcode|otp/i.test(u.pathname)) posts.push(r.url());
        });
        expect(await load(page, merchant.pages.account)).toBe(200);
        await expect(page.locator('header').first()).toBeVisible();
        await expect(page.locator('footer').last()).toBeAttached();
        await expect(page.getByText(/Welcome!/i).first()).toBeVisible({ timeout: 20_000 });
        await expect(page.locator('input[type="email"], input[type="tel"], input[name*="email" i]').first()).toBeVisible();
        expect(posts).toEqual([]);
    });

    test('Classic /account/login also exists (two login experiences, O8)', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        expect(await load(page, '/account/login')).toBe(200);
        const password = await page.locator('input[type="password"]').first().isVisible().catch(() => false);
        note('O8', `/account/login shows the classic Shopify login (password field: ${password}); header "Log in" goes to ${merchant.pages.account}`);
    });

    test('Mobile menu account links resolve', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        await page.setViewportSize({ width: 390, height: 844 });
        await load(page, merchant.pages.homepage);
        await page.locator(sel(merchant, 'menuSummary')).click();
        const menu = page.locator(sel(merchant, 'mobileMenu')).first();
        const links = await menu.locator('a').evaluateAll(as => as
            .filter(a => /account|log in/i.test((a as HTMLElement).innerText))
            .map(a => `${(a as HTMLElement).innerText.trim()} -> ${new URL((a as HTMLAnchorElement).href).pathname}`));
        note('O8', `Mobile menu account links: ${links.join(', ')}`);
        for (const l of links) {
            const r = await fetchStatus(page, l.split(' -> ')[1]);
            expect(r.status, l).toBe(200);
        }
    });
});
