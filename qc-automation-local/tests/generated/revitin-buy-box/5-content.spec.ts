// spec: specs/revitin-buy-box.md
// seed: tests/seed.spec.ts
import { test, expect } from '../../../fixtures/base';
import { openPdp, pdpPath, reviewBadge } from './helpers';
import type { Locator, Page } from '@playwright/test';

const note = (type: string, description: string) => test.info().annotations.push({ type, description });

// ---- FAQ ------------------------------------------------------------------------------------------------------------

const FAQ_QUESTIONS = [
    'How is Revitin different from other toothpastes?',
    'What should I do if I accidentally swallow Revitin?',
    'Is Revitin fluoride-free?',
    'What else is Revitin free from?',
    'Does Revitin whiten teeth?',
    'Is Revitin vegan?',
    'Is Revitin safe for children?',
    'Do you ship internationally?',
];
const faqButtons = (page: Page) => page.locator('button.accordion-button').filter({ visible: true });
// The answer panel is the sibling right after the question button; closed it is max-h-0 (zero height => not visible).
const faqPanel = (button: Locator) => button.locator('xpath=following-sibling::div[1]');

// ---- Reviews (custom Judge.me-fed widget) ---------------------------------------------------------------------------

const reviewsRoot = (page: Page) => page.locator('.jm-container');
const reviewCards = (page: Page) => page.locator('article.jm-card');
const sortButton = (page: Page) => page.locator('[data-jm-sort-btn]');
const loadMore = (page: Page) => page.getByRole('button', { name: 'Load More', exact: true });
type SortName = 'Highest Rating' | 'Lowest Rating' | 'Most Recent' | 'Oldest';

type Card = { stars: number; starCount: number; opacities: string[]; date: string; name: string; verified: string; body: string };

async function readCards(page: Page): Promise<Card[]> {
    return reviewCards(page).evaluateAll(cards => cards.map(c => {
        const stars = [...c.querySelectorAll('.jm-card-stars .jm-star')] as SVGElement[];
        return {
            // Filled star = style opacity 1, empty = 0.22 (what the shopper sees).
            stars: stars.filter(s => s.style.opacity === '1').length,
            starCount: stars.length,
            opacities: stars.map(s => s.style.opacity),
            date: (c.querySelector('.jm-card-date')?.textContent ?? '').trim(),
            name: (c.querySelector('.jm-card-meta span')?.textContent ?? '').trim(),
            verified: (c.querySelector('.jm-verified')?.textContent ?? '').trim(),
            body: (c.querySelector('.jm-card-body')?.textContent ?? '').trim(),
        };
    }));
}

const toTime = (d: string) => { const [m, day, y] = d.split('/').map(Number); return new Date(2000 + y, m - 1, day).getTime(); };
const nonDecreasing = (a: number[]) => a.every((v, i) => i === 0 || v >= a[i - 1]);
const nonIncreasing = (a: number[]) => a.every((v, i) => i === 0 || v <= a[i - 1]);
const toInt = (s: string) => parseInt(s.replace(/[^\d]/g, ''), 10);

/** Open the sort list only if closed, click the option, and wait until the first card has changed (list refreshed). */
async function sortBy(page: Page, option: SortName) {
    // Compare the whole list: one review can head two orders (e.g. today's review is both newest and lowest-rated).
    const listText = () => reviewCards(page).allInnerTexts().then(t => t.join('\n'));
    const before = await listText();
    // A late marketing popup can appear mid-sort; closing it (popupGuard) also closes the sort list, so retry.
    await expect(async () => {
        if ((await sortButton(page).getAttribute('aria-expanded')) !== 'true') await sortButton(page).click();
        await page.getByRole('option', { name: option, exact: true }).click({ timeout: 5_000 });
    }).toPass({ timeout: 30_000 });
    await expect(sortButton(page)).toContainText(option);
    await expect.poll(listText, { message: `cards refreshed after sorting by '${option}'` })
        .not.toBe(before);
}

async function openReviews(page: Page, merchant: { slug: string; pages: { product: string } }) {
    await openPdp(page, pdpPath(merchant));
    await reviewsRoot(page).scrollIntoViewIfNeeded();
    await expect(page.getByRole('heading', { name: 'Customer Reviews', level: 2 })).toBeVisible();
    await expect(reviewCards(page)).toHaveCount(20);
}

test.describe('Revitin buy box — 5. Content', () => {
    test('PDP FAQ accordion (8 items, independent)', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'revitin', 'Revitin buy box only');

        // 1. Scroll to 'Frequently Asked Questions' and list the accordion buttons.
        await openPdp(page, pdpPath(merchant));
        const heading = page.getByRole('heading', { name: 'Frequently Asked Questions', level: 3 });
        await heading.scrollIntoViewIfNeeded();
        await expect(heading).toBeVisible();

        const buttons = faqButtons(page);
        await expect(buttons).toHaveCount(8);
        await expect(buttons).toHaveText(FAQ_QUESTIONS);
        // All closed on load: every answer panel is collapsed (not visible).
        for (let i = 0; i < 8; i++) await expect(faqPanel(buttons.nth(i)), `answer ${i + 1} closed on load`).toBeHidden();

        // Every question has a non-empty answer in the page (read even while collapsed).
        for (let i = 0; i < 8; i++) await expect(faqPanel(buttons.nth(i)), `answer ${i + 1} has text`).toHaveText(/\S/);

        // 2. Open item 1, open item 2, then close item 2.
        await buttons.nth(0).click();
        await expect(faqPanel(buttons.nth(0))).toBeVisible();
        await expect(faqPanel(buttons.nth(0))).toContainText('Revitin uses all natural ingredients');
        await buttons.nth(1).click();
        await expect(faqPanel(buttons.nth(1))).toBeVisible();
        await expect(faqPanel(buttons.nth(1))).toContainText('Revitin is designed for oral use and is safe if swallowed. Please follow the usage instructions provided with the product.');
        // Independent (non-exclusive): item 1 is still open while item 2 is open.
        await expect(faqPanel(buttons.nth(0)), 'item 1 stays open when item 2 opens').toBeVisible();

        await buttons.nth(1).click();
        await expect(faqPanel(buttons.nth(1)), 'second click closes item 2').toBeHidden();
        await expect(faqPanel(buttons.nth(0)), 'closing item 2 leaves item 1 open').toBeVisible();

        // Answers of the claims called out in the plan (consistent with the 'GLUTEN FREE, FLUORIDE & SLS FREE' marquee).
        await buttons.nth(2).click();
        await expect(faqPanel(buttons.nth(2))).toBeVisible();
        await expect(faqPanel(buttons.nth(2))).toContainText('Yes, Revitin is fluoride-free. There are no toxic ingredients in our formula.');
        await buttons.nth(3).click();
        await expect(faqPanel(buttons.nth(3))).toBeVisible();
        await expect(faqPanel(buttons.nth(3))).toContainText('Revitin is free from fluoride, SLS, gluten, dyes, peanuts, sugar, xylitol, and GMOs.');

        // O9: the accordion exposes no aria-expanded, so open/closed is asserted by the answer text only; just record it.
        note('O9', `FAQ buttons with aria-expanded: ${await page.locator('button.accordion-button[aria-expanded]').count()} of 8`);
    });

    test('Key Ingredients section and link', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'revitin', 'Revitin buy box only');

        // 1. Scroll to the 'Key Ingredients' section.
        await openPdp(page, pdpPath(merchant));
        const intro = page.getByRole('heading', {
            name: 'Our first-of-its-kind formula is backed by 15 years of clinical research. Here’s what goes into it:',
            level: 3,
        });
        await intro.scrollIntoViewIfNeeded();
        await expect(intro).toBeVisible();
        await expect(page.getByText('Key Ingredients', { exact: true }).filter({ visible: true })).toBeVisible();

        const cards = [
            ['Vitamin C', 'Antioxidant'],
            ['CoQ10', 'Anti-inflammatory enzyme'],
            ['Vitamin D', 'Mineralization'],
            ['Cranberry Seed Oil', 'Prebiotic'],
            ['Quillaja Saponaria Extract', 'Lifting agent'],
            ['Chondrus Crispus', 'Prebiotic'],
        ];
        for (const [name, tag] of cards) {
            const title = page.getByRole('heading', { name, exact: true, level: 3 });
            await title.scrollIntoViewIfNeeded();
            await expect(title, `${name} card heading`).toBeVisible();
            const card = title.locator('xpath=..');
            await expect(card, `${name} shows '${tag}'`).toContainText(tag);
            // Non-empty description: the card text is longer than just its title and tag.
            const text = (await card.innerText()).replace(/\s+/g, ' ').trim();
            expect(text.length, `${name} has a description`).toBeGreaterThan(name.length + tag.length + 30);
            const image = card.locator('img').first();
            await expect(image, `${name} illustration visible`).toBeVisible();
            await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
                { message: `${name} illustration loaded` }).toBe(true);
        }

        // 2. Click the link 'All ingredients'.
        const link = page.getByRole('link', { name: 'All ingredients', exact: true });
        await link.scrollIntoViewIfNeeded();
        await expect(link).toHaveAttribute('href', '/pages/ingredients');
        await link.click();
        await expect(page).toHaveURL(/\/pages\/ingredients\/?(\?.*)?$/);
        await expect(page.getByRole('heading', { name: 'Revitin Ingredients', level: 1 })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Meet Citrus', level: 2 }).filter({ visible: true })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Meet Mint', level: 2 }).filter({ visible: true })).toBeVisible();
        await expect(page).not.toHaveTitle(/404|not found/i);
    });

    test('Review sort: Highest, Lowest, Most Recent, Oldest (read-only)', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'revitin', 'Revitin buy box only');
        test.setTimeout(120_000);

        // 1. Scroll to 'Customer Reviews'; read the summary and the sort button (never click 'Write a Review').
        await openReviews(page, merchant);
        await expect(sortButton(page)).toContainText('Highest Rating');

        const score = await reviewsRoot(page).locator('.jm-score-number').innerText();
        const widgetTotal = toInt(await reviewsRoot(page).locator('.jm-pill').innerText());
        const distribution = (await reviewsRoot(page).locator('.jm-count').allInnerTexts()).map(toInt);
        expect(Number(score), 'summary average is a rating between 1 and 5').toBeGreaterThanOrEqual(1);
        expect(Number(score)).toBeLessThanOrEqual(5);
        expect(distribution, 'distribution has one count per star level').toHaveLength(5);
        expect(distribution.reduce((a, b) => a + b, 0), 'distribution sums to the widget total').toBe(widgetTotal);

        // O1: the PDP header badge (product-level, e.g. '881 reviews') and the widget total (e.g. '1,139 Reviews') must
        // agree. Live the widget script requests reviews by shop domain only (no product filter), so it most likely counts
        // the whole shop while the badge counts this product - still shown to shoppers as two different totals.
        const headerTotal = toInt(await reviewBadge(page).first().innerText());
        note('O1', `header badge ${headerTotal} reviews vs widget ${widgetTotal} Reviews (avg ${score}), distribution ${distribution.join('/')}`);
        expect(widgetTotal, 'widget total is never below the header count').toBeGreaterThanOrEqual(headerTotal);
        // Soft, so the sort checks below still run when the totals differ.
        expect.soft(widgetTotal, 'O1: PDP header review count and Judge.me widget total should agree').toBe(headerTotal);

        // 2. Sort by each option; the visible cards must really be ordered. (Order: Lowest, Most Recent, Oldest, Highest so
        // every step changes the first card.)
        await sortBy(page, 'Lowest Rating');
        let cards = await readCards(page);
        expect(cards, 'card count stays 20').toHaveLength(20);
        expect(nonDecreasing(cards.map(c => c.stars)), `Lowest Rating ascending: ${cards.map(c => c.stars).join('')}`).toBe(true);
        expect(cards[0].stars, 'Lowest Rating starts with the lowest ratings').toBeLessThan(cards[19].stars);

        await sortBy(page, 'Most Recent');
        cards = await readCards(page);
        expect(cards).toHaveLength(20);
        expect(nonIncreasing(cards.map(c => toTime(c.date))), `Most Recent descending: ${cards.map(c => c.date).join(' ')}`).toBe(true);
        const newest = cards[0].date;

        await sortBy(page, 'Oldest');
        cards = await readCards(page);
        expect(cards).toHaveLength(20);
        expect(nonDecreasing(cards.map(c => toTime(c.date))), `Oldest ascending: ${cards.map(c => c.date).join(' ')}`).toBe(true);
        expect(toTime(cards[0].date), 'Oldest first card is older than the Most Recent first card').toBeLessThan(toTime(newest));
        // The brand cites 15 years of research, yet the oldest review is this year (O1: likely an import date).
        note('O1', `Oldest review date: ${cards[0].date}; newest: ${newest}`);

        await sortBy(page, 'Highest Rating');
        cards = await readCards(page);
        expect(cards).toHaveLength(20);
        expect(nonIncreasing(cards.map(c => c.stars)), `Highest Rating descending: ${cards.map(c => c.stars).join('')}`).toBe(true);
        expect(cards[0].stars, 'Highest Rating starts with 5 stars').toBe(5);

        // No navigation happened and the list closed after choosing.
        await expect(sortButton(page)).toHaveAttribute('aria-expanded', 'false');
        await expect(page).toHaveURL(/\/products\/revitin-natural-toothpaste\/?\??$/);
    });

    test("Reviews 'Load More' (read-only) and review card content", async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'revitin', 'Revitin buy box only');
        test.setTimeout(120_000);

        await openReviews(page, merchant);
        // Sort by Most Recent first so the cards carry a mix of ratings (the default Highest Rating shows only 5-star cards).
        await sortBy(page, 'Most Recent');
        const firstTwenty = await readCards(page);
        expect(firstTwenty).toHaveLength(20);

        // 1. Click 'Load More' once.
        await loadMore(page).scrollIntoViewIfNeeded();
        await expect(loadMore(page)).toBeVisible();
        await loadMore(page).click();
        await expect(reviewCards(page)).toHaveCount(40);
        await expect(loadMore(page), "'Load More' remains (more than 40 reviews exist)").toBeVisible();
        expect(await page.evaluate(() => window.scrollY), 'page does not jump back to the top').toBeGreaterThan(500);

        const cards = await readCards(page);
        expect(cards.slice(0, 20), 'first 20 cards and their order are unchanged').toEqual(firstTwenty);
        expect(nonIncreasing(cards.map(c => toTime(c.date))), 'Most Recent order continues across all 40').toBe(true);

        // 2. Inspect cards: date, name, 'Verified by shop', body and exactly five stars with a consistent pattern.
        cards.forEach((c, i) => {
            const label = `card ${i + 1}`;
            expect(c.date, `${label} date MM/DD/YY`).toMatch(/^\d{2}\/\d{2}\/\d{2}$/);
            expect(c.name.length, `${label} has a name`).toBeGreaterThan(0);
            expect(c.verified, `${label} verified label`).toBe('Verified by shop');
            expect(c.body.length, `${label} has a body`).toBeGreaterThan(0);
            expect(c.starCount, `${label} has exactly five stars`).toBe(5);
            expect(c.opacities.every(o => o === '1' || o === '0.22'), `${label} stars are filled (1) or empty (0.22): ${c.opacities}`).toBe(true);
            const filled = c.opacities.map(o => (o === '1' ? 1 : 0));
            expect(nonIncreasing(filled), `${label} filled stars come first: ${c.opacities}`).toBe(true);
            expect(c.stars, `${label} has at least one filled star`).toBeGreaterThanOrEqual(1);
        });
        expect(new Set(cards.map(c => c.stars)).size, 'sample contains more than one rating').toBeGreaterThan(1);
    });

    test('Payment-installment (Afterpay) messaging', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'revitin', 'Revitin buy box only');

        // 1. Load the PDP and look for installment placements and visible installment text near the price.
        await openPdp(page, pdpPath(merchant));
        const placements = ['afterpay-placement', 'klarna-placement', 'square-placement', 'shopify-payment-terms', 'shop-pay-installments-banner']
            .join(', ');
        const placementCount = await page.locator(placements).count();
        const messaging = page.getByText(/afterpay|klarna|sezzle|affirm|installments?|interest-free|4 payments/i).filter({ visible: true });
        const messagingCount = await messaging.count();

        if (placementCount === 0 && messagingCount === 0) {
            // Verified 2026-10-13: the merchant advertises no installments, so the absence of an optional widget is not a bug.
            note('afterpay', 'No Afterpay/Klarna/Square/Shop Pay installment placement or text is rendered on the PDP (finding, not a failure).');
            return;
        }

        // The merchant now advertises installments: the amount must be consistent with the main price ($42 / 4 = $10.50).
        const text = (await messaging.first().innerText()).replace(/\s+/g, ' ');
        const amount = text.match(/\$\s?(\d+(?:\.\d{2})?)/);
        expect(amount, `installment text shows an amount: '${text}'`).not.toBeNull();
        const priceText = await page.locator('button.main__atc__button:visible').first().innerText();
        const price = Number(priceText.match(/\$\s?(\d+(?:\.\d{2})?)/)![1]);
        expect(Number(amount![1]), 'installment amount is a quarter of the main price').toBeCloseTo(price / 4, 1);
    });

    test('Content pages load with a heading and no 404', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'revitin', 'Revitin buy box only');
        test.setTimeout(180_000);

        // 1. Visit each content page one at a time (never submit the forms on these pages).
        const pages: { path: string; title: string; h1?: string; h2s?: string[]; minArticles?: number }[] = [
            { path: '/pages/about', title: 'About Revitin® | Meet Dr. Gerry Curatola, Our Founder', h2s: ['Microbes are necessary for oral health'] },
            { path: '/pages/ingredients', title: "Revitin Ingredients | What's in Our Prebiotic Toothpaste", h1: 'Revitin Ingredients', h2s: ['Meet Citrus', 'Meet Mint'] },
            { path: '/pages/faqs', title: 'Revitin | FAQS', h2s: ['Ingredients', 'Product', 'Orders, Shipping & Returns', 'Subscriptions'] },
            { path: '/pages/wholesale', title: 'Revitin Wholesale Program', h1: 'Revitin Wholesale Program' },
            { path: '/pages/press', title: 'Revitin Press Coverage & Media Mentions', h1: 'Press & Media' },
            { path: '/blogs/all', title: 'Revitin | All', h1: 'Discover the Science of Prebiotic Oral Care', minArticles: 4 },
        ];
        for (const p of pages) {
            const response = await page.goto(p.path, { waitUntil: 'domcontentloaded' });
            expect(response?.status(), `${p.path} HTTP status`).toBeLessThan(400);
            await expect(page, `${p.path} is not a 404 template`).not.toHaveTitle(/404|not found/i);
            await expect(page.getByText(/page not found|404/i).filter({ visible: true }), `${p.path} shows no not-found text`).toHaveCount(0);

            // A visible main heading (H1, or H2 when the page has no H1).
            const mainHeading = page.getByRole('heading', { level: 1 }).or(page.getByRole('heading', { level: 2 })).filter({ visible: true });
            await expect(mainHeading.first(), `${p.path} has a visible heading`).toBeVisible();

            if (p.h1) await expect(page.getByRole('heading', { name: p.h1, level: 1 }), `${p.path} H1`).toBeVisible();
            for (const h2 of p.h2s ?? []) {
                await expect(page.getByRole('heading', { name: h2, level: 2, exact: true }).filter({ visible: true }).first(), `${p.path} H2 '${h2}'`).toBeVisible();
            }
            if (p.minArticles) {
                expect(await page.getByRole('heading', { level: 2 }).filter({ visible: true }).count(), `${p.path} article H2 count`).toBeGreaterThanOrEqual(p.minArticles);
            }

            // O9: record, do not fail on, the H1 structure and any title drift.
            const h1s = (await page.getByRole('heading', { level: 1 }).allInnerTexts()).map(t => t.replace(/\s+/g, ' ').trim());
            note('O9', `${p.path}: ${h1s.length} H1 ${JSON.stringify(h1s)}`);
            if ((await page.title()) !== p.title) note('title', `${p.path}: expected '${p.title}', got '${await page.title()}'`);
        }

        // 2. From the footer click 'Meet Dr. Gerry' and 'The Science'.
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        const gerry = page.getByRole('link', { name: 'Meet Dr. Gerry', exact: true }).filter({ visible: true }).first();
        await gerry.scrollIntoViewIfNeeded();
        await expect(gerry).toHaveAttribute('href', '/pages/about/#meet-dr-gerry');
        await gerry.click();
        await expect(page).toHaveURL(/\/pages\/about\/?#meet-dr-gerry$/);
        // The id appears twice on the About page (duplicate id); the link works as long as one target exists.
        await expect(page.locator('#meet-dr-gerry').first(), 'anchor target #meet-dr-gerry exists').toBeAttached();
        note('O9', `#meet-dr-gerry occurs ${await page.locator('#meet-dr-gerry').count()} times (duplicate id)`);

        await page.goto('/', { waitUntil: 'domcontentloaded' });
        const science = page.getByRole('link', { name: 'The Science', exact: true }).filter({ visible: true }).first();
        await science.scrollIntoViewIfNeeded();
        await expect(science).toHaveAttribute('href', '/blogs/all');
        await science.click();
        await expect(page).toHaveURL(/\/blogs\/all\/?$/);
    });
});
