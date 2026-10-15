// spec: specs/koh-core-storefront.md
// seed: tests/seed.spec.ts
import { test, expect } from '../../../fixtures/base';
import { ONLY_KOH, brokenImages, cards, load, note, pathOf, press, scrollWidth, sel } from './helpers';

test.describe('KOH core storefront — 5. Content pages and forms (read-only)', () => {
    test('Policy and company pages return 200 with correct titles and headings', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        const policies: Array<[string, string]> = [
            [merchant.pages.policies.shipping, 'Shipping policy'], [merchant.pages.policies.refund, 'Refund policy'],
            [merchant.pages.policies.privacy, 'Privacy policy'], [merchant.pages.policies.terms, 'Terms of service'],
        ];
        for (const [path, name] of policies) {
            expect(await load(page, path), `${path} status`).toBe(200);
            await expect(page).toHaveTitle(`${name} – Kreatures of Habit`);
            await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
            // The refund policy is only two sentences (about 240 characters on 2026-10-15), so just require real text.
            const length = (await page.locator('main').innerText()).length;
            expect(length, `${name} has real content`).toBeGreaterThan(150);
            note('policy', `${name}: ${length} characters`);
        }

        expect(await load(page, merchant.pages.about)).toBe(200);
        await expect(page).toHaveTitle('About Us - Kreatures of Habit | Health and Wellness');
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('About Us | Kreatures of Habit | Health and Wellness');
        await expect(page.getByRole('heading', { name: 'ABOUT US' }).first()).toBeVisible();
        await expect(page.getByRole('heading', { name: 'MEET MICHAEL' }).first()).toBeAttached();
        expect(await brokenImages(page.locator('main'))).toEqual([]);
        const noAlt = await page.locator('main img:not([alt]), main img[alt=""]').count();
        if (noAlt) note('O12', `About page: ${noAlt} image(s) without alt text`);
        expect(await scrollWidth(page)).toBeLessThanOrEqual(1280);

        expect(await load(page, merchant.pages.podcast)).toBe(200);
        await expect(page).toHaveTitle('Our Podcast - Kreatures of Habit');
        // The podcast widget renders after load.
        await expect(page.locator('main').getByRole('heading', { name: 'Recent Episodes' })).toBeVisible({ timeout: 20_000 });
        note('O2', `Podcast page H1 count: ${await page.locator('h1').count()}`);
    });

    test('FAQ accordion expands, collapses and is exclusive', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        expect(await load(page, merchant.pages.faq)).toBe(200);
        await expect(page).toHaveTitle('FAQs - Your Questions Answered - Kreatures of Habit');
        const items = page.locator(sel(merchant, 'faqButton'));
        await expect(items.first()).toBeAttached();
        expect(await items.count()).toBeGreaterThanOrEqual(40);
        // Group labels are plain text in the FAQ section (not their own elements).
        const mainText = (await page.locator('main').innerText()).toUpperCase();
        for (const group of ['MEAL ONE', 'KREATURE.S SLEEP', 'THE DAILY BAR', 'ORDERS', 'SHIPPING', 'SUBSCRIPTIONS']) {
            expect(mainText, `FAQ group ${group}`).toMatch(new RegExp(group));
        }
        const expanded = () => page.locator(`${sel(merchant, 'faqButton')}[aria-expanded="true"]`).count();
        expect(await expanded(), 'everything starts collapsed').toBe(0);

        const q1 = items.filter({ hasText: 'What are net carbs?' }).first();
        const q2 = items.filter({ hasText: 'Is this high in sugar?' }).first();
        await q1.scrollIntoViewIfNeeded();
        await q1.click();
        await expect(q1).toHaveAttribute('aria-expanded', 'true');
        const panel1 = page.locator(`#${await q1.getAttribute('aria-controls')}`);
        await expect(panel1).toContainText('Carbs minus fiber');
        await expect.poll(async () => (await panel1.boundingBox())?.height ?? 0).toBeGreaterThan(0);

        await q2.click();
        await expect(q2).toHaveAttribute('aria-expanded', 'true');
        await expect(q1).toHaveAttribute('aria-expanded', 'false');
        expect(await expanded(), 'exclusive accordion').toBe(1);
        await q2.click();
        await expect(q2).toHaveAttribute('aria-expanded', 'false');
        expect(await expanded()).toBe(0);

        const contactLinks = page.locator(`${sel(merchant, 'faqGroup')} a[href$="${merchant.pages.contact}"]`);
        expect(await contactLinks.count(), 'answers link to the contact page').toBeGreaterThan(0);
        const role = await q1.getAttribute('role');
        if (role !== 'button') note('O12', 'FAQ questions are divs without role=button (not keyboard reachable)');
    });

    test('Contact, wholesale and login pages load (forms are inspected, never submitted)', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        expect(await load(page, merchant.pages.contact)).toBe(200);
        await expect(page).toHaveTitle('Contact Us - Kreatures of Habit');
        const main = page.locator('main');
        for (const name of ['Name', 'Email', 'Message']) await expect(main.getByRole('textbox', { name }).first()).toBeVisible();
        await expect(main.getByRole('button', { name: 'Submit Message' })).toBeEnabled();
        await expect(main.getByText(/protected by hCaptcha/)).toBeAttached();

        expect(await load(page, merchant.pages.wholesale)).toBe(200);
        await expect(page).toHaveTitle('Wholesale Registration Form – Kreatures of Habit');
        await expect(page.getByRole('heading', { level: 1, name: 'Wholesale Registration Form' })).toBeVisible();
        await expect(page.getByText(/Already have an account\?/)).toBeVisible();
        await expect(page.getByRole('button', { name: 'Continue' }).first()).toBeAttached();

        expect(await load(page, merchant.pages.account)).toBe(200);
        await expect(page.getByRole('heading', { level: 1, name: 'Welcome!' })).toBeVisible({ timeout: 20_000 });
        await expect(page.getByRole('heading', { name: 'Access your account and manage your orders' })).toBeVisible();
        await expect(page.getByRole('textbox', { name: 'Email', exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: /Get login code/ })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Log in with Shopify instead' })).toHaveAttribute('href', /\/account\/login\?return_url=/);
    });

    test('Habit Lab blog lists articles with working links and paging', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        expect(await load(page, merchant.pages.blog)).toBe(200);
        await expect(page).toHaveTitle('Habit Lab – Kreatures of Habit');
        await expect(page.getByRole('heading', { level: 1, name: 'Habit Lab' })).toBeVisible();
        const articleLinks = () => page.locator(`main a[href*="${merchant.pages.blog}/"]`).evaluateAll(as =>
            [...new Set(as.map(a => (a as HTMLAnchorElement).pathname))]);
        const page1 = await articleLinks();
        expect(page1.length, 'at least 6 articles').toBeGreaterThanOrEqual(6);
        await expect(page.locator(`a[href*="${merchant.pages.blog}?page=2"]`).first()).toBeAttached();
        expect(await brokenImages(page.locator('main'))).toEqual([]);

        await press(page.locator(`main a[href$="${page1[0]}"]`).first());
        await expect.poll(() => pathOf(page.url())).toBe(page1[0]);
        await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('');
        await expect(page).toHaveTitle(/Kreatures of Habit$/);

        expect(await load(page, `${merchant.pages.blog}?page=2`)).toBe(200);
        const page2 = await articleLinks();
        expect(page2.length).toBeGreaterThan(0);
        expect(page2.filter(slug => page1.includes(slug)), 'page 2 repeats no page 1 article').toEqual([]);
    });

    test('Sprouts store locator and unknown URLs', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', ONLY_KOH);

        expect(await load(page, merchant.pages.stores)).toBe(200);
        await expect(page).toHaveTitle('Kreatures of Habit | THE DAILY BAR | Now At Your Local Sprouts');
        await expect(page.getByRole('heading', { name: 'Find Daily Bar at Your Local Sprouts' })).toBeVisible();
        await expect(page.getByRole('combobox', { name: /Enter Address or Zip Code/ })).toBeAttached({ timeout: 20_000 });
        await page.waitForTimeout(5_000);
        // A store finder that cannot load its map is broken for shoppers (O11).
        await expect.soft(page.getByText("This page can't load Google Maps correctly"), 'O11: Google Maps error on the store locator').toHaveCount(0);

        // Unknown URLs: the store moved from real 404s to 301 -> homepage (products on 2026-10-15 morning, collections
        // later that day), so record the behaviour (soft 404, O10) and check the 404 page only when one is served.
        const statuses: Record<string, number> = {};
        for (const path of [merchant.pages.notFoundCollection, merchant.pages.notFoundProduct, '/pages/this-page-does-not-exist-qa']) {
            const r = await page.request.get(path, { maxRedirects: 0 });
            statuses[path] = r.status();
            note('O10', `${path} responds ${r.status()} ${r.headers()['location'] ?? ''}`);
        }
        const notFound = Object.keys(statuses).find(p => statuses[p] === 404);
        if (notFound) {
            expect(await load(page, notFound)).toBe(404);
            await expect(page).toHaveTitle('404 Not Found – Kreatures of Habit');
            await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
            await press(page.getByRole('link', { name: 'Continue shopping' }));
            await expect.poll(() => pathOf(page.url())).toBe(merchant.pages.collection);
            await expect(cards(page, merchant).first()).toBeVisible();
        } else {
            // Every unknown URL must at least land on a working page (the homepage), never an error.
            expect(Object.values(statuses).every(s => s === 301 || s === 302), 'unknown URLs redirect').toBe(true);
            expect(await load(page, merchant.pages.notFoundProduct)).toBe(200);
            expect(pathOf(page.url())).toBe('/');
        }
    });
});
