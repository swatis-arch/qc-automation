// spec: specs/koh-full-site.md
// seed: tests/seed.spec.ts
import { test, expect } from '../../../fixtures/base';
import { ONLY_KOH, brokenImages, load, note, overflow, pathOf, press, sel, snap } from './helpers';

test.describe('KOH whole site — 9. Content pages', () => {
    test('About page renders with headings and images', { tag: '@full' }, async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        expect(await load(page, merchant.pages.about)).toBe(200);
        await expect(page).toHaveTitle(/About/i);
        await expect(page.getByText(/Meet Michael/i).first()).toBeVisible();
        expect(await brokenImages(page.locator('main'))).toEqual([]);
    });

    test('FAQ accordions expand and collapse', { tag: '@smoke' }, async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        await load(page, merchant.pages.faq);
        const buttons = page.locator(sel(merchant, 'faqButton'));
        expect(await buttons.count()).toBeGreaterThan(20);
        const first = buttons.first();
        await expect(first).toHaveAttribute('aria-expanded', 'false');
        await first.click();
        await expect(first).toHaveAttribute('aria-expanded', 'true');
        await first.click();
        await expect(first).toHaveAttribute('aria-expanded', 'false');
        await buttons.nth(1).click();
        await buttons.nth(2).click();
        note('faq', `Opening a second question ${(await buttons.nth(1).getAttribute('aria-expanded')) === 'true' ? 'keeps' : 'closes'} the first one open`);
    });

    test('Contact page form renders and is not submitted', { tag: '@full' }, async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        const posts: string[] = [];
        page.on('request', r => { if (r.method() === 'POST' && /\/contact/.test(new URL(r.url()).pathname)) posts.push(r.url()); });
        expect(await load(page, merchant.pages.contact)).toBe(200);
        const form = page.locator('form#ContactForm, form[action*="/contact"]').first();
        await expect(form).toBeVisible();
        await expect(form.locator('input[type="email"], input[name*="email" i]').first()).toBeEnabled();
        await expect(form.locator('textarea').first()).toBeEnabled();
        expect(posts).toEqual([]);
    });

    test('Store locator ("Now at Sprouts") shows a working map and locations (O1)', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        const mapErrors: string[] = [];
        page.on('console', m => { if (/Google Maps|BillingNotEnabled/i.test(m.text())) mapErrors.push(m.text()); });
        expect(await load(page, merchant.pages.stores)).toBe(200);
        await expect(page.getByText(/Find Daily Bar at Your Local Sprouts/i).first()).toBeVisible();
        await page.waitForTimeout(6_000);
        const mapBroken = await page.getByText(/can't load Google Maps correctly/i).first().isVisible().catch(() => false);
        const noLocations = await page.getByText(/No locations found/i).first().isVisible().catch(() => false);
        if (mapBroken || noLocations || mapErrors.length) {
            note('O1', `Map error dialog: ${mapBroken}; "No locations found": ${noLocations}; console: ${mapErrors.slice(0, 2).join(' | ')}`);
            await snap(page, 'O1-store-locator-broken');
        }
        expect(mapBroken, 'Google Maps error dialog is not shown').toBeFalsy();
        expect(noLocations, 'store list is not empty').toBeFalsy();
    });

    test('Podcast, blog index and a blog article load', { tag: '@full' }, async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        expect(await load(page, merchant.pages.podcast)).toBe(200);
        await expect(page).toHaveTitle(/Podcast/i);
        expect(await load(page, merchant.pages.blog)).toBe(200);
        await expect(page.getByRole('heading', { name: /Habit Lab/i }).first()).toBeVisible();
        const article = page.locator(`main a[href^="${merchant.pages.blog}/"]`).first();
        const href = await article.getAttribute('href');
        await press(article);
        await expect.poll(() => pathOf(page.url())).toBe(href!.split('?')[0]);
        await expect(page.locator('h1').first()).toBeVisible();
        expect(await overflow(page)).toBeLessThanOrEqual(0);
    });

    test('Wholesale page renders (never submitted)', { tag: '@full' }, async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        expect(await load(page, merchant.pages.wholesale)).toBe(200);
        await expect(page).toHaveTitle(/Wholesale/i);
        await expect(page.locator('main form, main input').first()).toBeAttached({ timeout: 15_000 });
    });

    test('The four policy pages have a heading and body text', { tag: '@full' }, async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        const names: Record<string, RegExp> = { shipping: /Shipping policy/i, refund: /Refund policy/i, privacy: /Privacy policy/i, terms: /Terms of service/i };
        for (const [key, path] of Object.entries(merchant.pages.policies as Record<string, string>)) {
            expect(await load(page, path), path).toBe(200);
            await expect(page.locator('h1').first(), path).toHaveText(names[key]);
            expect((await page.locator('main').innerText()).length, `${path} body`).toBeGreaterThan(200);
        }
    });

    test('Content pages have one meaningful h1 (O4)', { tag: '@full' }, async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);
        test.setTimeout(120_000);

        const missing: string[] = [];
        for (const path of [merchant.pages.faq, merchant.pages.contact, merchant.pages.stores, merchant.pages.podcast, merchant.pages.about]) {
            await load(page, path);
            const h1s = (await page.locator('h1').allInnerTexts()).map(t => t.trim()).filter(Boolean);
            if (h1s.length !== 1 || /\|/.test(h1s[0])) missing.push(`${path}: ${h1s.length ? h1s.join(' / ') : 'no h1'}`);
        }
        if (missing.length) note('O4', missing.join('; '));
        expect(missing, 'pages without exactly one real h1').toEqual([]);
    });
});
