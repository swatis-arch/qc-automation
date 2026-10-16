// spec: specs/koh-full-site.md
// seed: tests/seed.spec.ts
import { test, expect } from '../../../fixtures/base';
import { ONLY_KOH, fetchStatus, load } from './helpers';

const GROUPS: Record<string, string[]> = {
    SHOP: ['MEAL ONE', 'DAILY BAR', 'BUNDLE & SAVE'],
    HELP: ['FAQS', 'CONTACT US', 'SHIPPING POLICY', 'REFUND POLICY'],
    COMPANY: ['ABOUT', 'HABIT LAB BLOG', 'PODCAST', 'WHOLESALE'],
};

test.describe('KOH whole site — 3. Footer', () => {
    test('Footer link groups, legal row and copyright are present', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        await load(page, merchant.pages.homepage);
        const footer = page.locator('footer').last();
        await footer.scrollIntoViewIfNeeded();
        for (const [group, labels] of Object.entries(GROUPS)) {
            for (const label of labels) {
                await expect(footer.getByRole('link', { name: new RegExp(`^${label}$`, 'i') }).first(), `${group}: ${label}`).toBeAttached();
            }
        }
        for (const legal of ['Refund policy', 'Privacy policy', 'Terms of service', 'Shipping policy']) {
            await expect(footer.getByRole('link', { name: legal, exact: true }).first(), legal).toBeAttached();
        }
        await expect(footer.getByRole('link', { name: /Kreatures of Habit/i }).first()).toHaveAttribute('href', /^\/$|kreaturesofhabit\.com\/?$/);
    });

    test('Every internal footer link returns HTTP 200', { tag: '@smoke' }, async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);
        test.setTimeout(120_000);

        await load(page, merchant.pages.homepage);
        const hrefs = await page.locator('footer').last().locator('a[href]').evaluateAll(as => [...new Set(as
            .map(a => new URL((a as HTMLAnchorElement).href))
            .filter(u => u.hostname === location.hostname)
            .map(u => u.pathname))]);
        expect(hrefs.length).toBeGreaterThan(8);
        const bad: string[] = [];
        for (const path of hrefs) {
            const r = await fetchStatus(page, path);
            if (r.status !== 200) bad.push(`${path} -> ${r.status}`);
        }
        expect(bad, 'footer links that do not return 200').toEqual([]);
    });

    test('Social links point to the KOH profiles', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        await load(page, merchant.pages.homepage);
        const footer = page.locator('footer').last();
        await expect(footer.locator('a[href*="facebook.com/"]').first()).toHaveAttribute('href', /facebook\.com\/OfficialKreaturesofHabit/i);
        await expect(footer.locator('a[href*="instagram.com/"]').first()).toHaveAttribute('href', /instagram\.com\/kreaturesofhabit/i);
        await expect(footer.locator('a[href*="tiktok.com/"]').first()).toHaveAttribute('href', /tiktok\.com\/@kreaturesofhabit/i);
    });

    test('Footer newsletter block renders and nothing is submitted', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        const posts: string[] = [];
        page.on('request', r => {
            const u = new URL(r.url());
            if (r.method() === 'POST' && /subscri|\/contact/i.test(u.pathname)) posts.push(r.url());
        });
        await load(page, merchant.pages.homepage);
        await expect(page.getByRole('heading', { name: /Stay Connected with Us/i }).first()).toBeAttached();
        const email = page.locator('footer input[type="email"], footer input[name*="email" i]').first();
        if (await email.count()) await expect(email).toBeEnabled();
        await page.waitForTimeout(2_000);
        expect(posts, 'no subscribe request is sent without user action').toEqual([]);
    });
});
