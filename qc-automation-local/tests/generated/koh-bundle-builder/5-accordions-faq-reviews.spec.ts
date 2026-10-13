// spec: specs/koh-bundle-builder.md
// seed: tests/seed.spec.ts
import { test, expect } from '../../../fixtures/base';
import { clickAddToCart } from './helpers';
import type { Page } from '@playwright/test';

// Popups (incl. Klaviyo's "Close dialog") are closed by the popupGuard fixture; no popup code here.
async function openBuilder(page: Page, path: string) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });   // full 'load' waits on slow third-party scripts
    await expect(page.getByRole('heading', { name: 'BUNDLE & SAVE', level: 1 })).toBeVisible();
}

const mainButton = (page: Page) => page.locator('button.pfp__atc:visible');
const accordion = (page: Page, title: string) =>
    page.locator('details.pfp__accordion').filter({ has: page.locator('summary', { hasText: title }) });
// Builder modals are role=dialog panels inside .pfp-modal (aria-hidden while closed).
const dialog = (page: Page, heading: string) =>
    page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: heading, exact: true }) });

test.describe('KOH bundle builder — 5. Accordions, FAQ and informational content', () => {
    test('Builder accordions open and close', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', 'KOH bundle builder only');
        await openBuilder(page, merchant.pages.bundleBuilder);

        // 1. Click 'HOW TO PREPARE', then 'WHAT'S INSIDE EACH BOX', then 'REVIEWS & RATINGS' summaries
        const groups: Array<[string, RegExp]> = [
            ['HOW TO PREPARE', /milk of your choice|milk of choice/i],
            ["WHAT'S INSIDE EACH BOX", /Each serving includes/i],
            ['REVIEWS & RATINGS', /view all reviews/i],
        ];
        await accordion(page, 'HOW TO PREPARE').scrollIntoViewIfNeeded();
        // Page position (viewport y + scrollY): clicking a summary may scroll, which is not a layout shift.
        const pageTop = async () => { const b = await mainButton(page).boundingBox(); return b!.y + await page.evaluate(() => window.scrollY); };
        const buttonTop = await pageTop();
        for (const [title, content] of groups) {
            const group = accordion(page, title);
            await expect(group).not.toHaveAttribute('open');
            await group.locator('summary').click();
            await expect(group).toHaveAttribute('open', '');
            await expect(group.getByText(content).first()).toBeVisible();
        }
        // Opening one must not close the others (verified live: independent accordions)
        for (const [title] of groups) await expect(accordion(page, title)).toHaveAttribute('open', '');
        // The add-to-cart controls sit above the accordions and must not move
        expect(Math.abs((await pageTop()) - buttonTop)).toBeLessThanOrEqual(1);
        // Clicking the same summary again closes it
        for (const [title, content] of groups) {
            const group = accordion(page, title);
            await group.locator('summary').click();
            await expect(group).not.toHaveAttribute('open');
            await expect(group.getByText(content).first()).toBeHidden();
        }

        // 2. Click 'NUTRITION & INGREDIENTS' (top of the builder)
        const nutrition = dialog(page, 'NUTRITION & INGREDIENTS');
        await page.getByRole('button', { name: 'NUTRITION & INGREDIENTS' }).click();
        await expect(nutrition).toBeVisible();
        await expect(nutrition.getByRole('tab', { name: 'Protein Bar' })).toBeVisible();
        await expect(nutrition.getByRole('tab', { name: 'Meal One' })).toBeVisible();
        // 12 flavour buttons in total (4 Protein Bar + 8 Meal One); only the selected product's are shown
        await expect(nutrition.locator('.pfp-modal__flavor-tab')).toHaveCount(12);
        await nutrition.getByRole('tab', { name: 'Protein Bar' }).click();
        await expect(nutrition.getByRole('tab', { name: 'Protein Bar' })).toHaveAttribute('aria-selected', 'true');
        await expect(nutrition.locator('.pfp-modal__flavor-tab:visible')).toHaveCount(4);
        await nutrition.getByRole('button', { name: 'Cookie Dough Dazzler', exact: true }).click();
        await expect(nutrition.getByRole('img', { name: /^Cookie Dough Dazzler nutrition/ }).first()).toBeVisible();
        await nutrition.getByRole('tab', { name: 'Meal One' }).click();
        await expect(nutrition.getByRole('tab', { name: 'Meal One' })).toHaveAttribute('aria-selected', 'true');
        await expect(nutrition.locator('.pfp-modal__flavor-tab:visible')).toHaveCount(8);
        await nutrition.getByRole('button', { name: 'Chocolate', exact: true }).click();
        await expect(nutrition.getByRole('img', { name: /^Chocolate nutrition/ }).first()).toBeVisible();
        // Close with the close button, reopen, close with Escape
        await nutrition.getByRole('button', { name: 'Close' }).click();
        await expect(nutrition).toBeHidden();
        await page.getByRole('button', { name: 'NUTRITION & INGREDIENTS' }).click();
        await expect(nutrition).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(nutrition).toBeHidden();

        // 3. Open the Box Info dialog and use the tabs and Subscription / One Time purchase buttons
        const boxInfoTrigger = page.locator('[data-pfp-open-modal="boxinfo"]');
        // SITE DIFFERS: the 'BOX INFO' trigger is rendered with style="display: none" on the bundle builder (and on
        // /products/meal-one-v2), so no user can open the dialog. Expectation kept (soft); the dialog is then opened
        // programmatically so the rest of its content can still be checked.
        await expect.soft(boxInfoTrigger, 'BOX INFO trigger should be visible to the user').toBeVisible();
        await boxInfoTrigger.dispatchEvent('click');
        const boxInfo = dialog(page, 'BOX INFO');
        await expect(boxInfo).toBeVisible();
        await expect(boxInfo.getByText('Note: Box details remain the same; only the price varies between one-time purchase and subscription.'))
            .toBeVisible();
        const rows = boxInfo.locator('[data-pfp-boxinfo-rows]');
        await boxInfo.getByRole('tab', { name: 'Meal One' }).click();
        await expect(boxInfo.getByRole('tab', { name: 'Meal One' })).toHaveAttribute('aria-selected', 'true');
        await boxInfo.getByRole('button', { name: 'Subscription' }).click();
        await expect(rows).toContainText('7 MEALS');
        await expect(rows).toContainText('$23.59');
        await expect(rows).toContainText('$47.18');
        await boxInfo.getByRole('button', { name: 'One Time purchase' }).click();
        await expect(rows).toContainText('$39.99');
        await expect(rows).toContainText('$79.98');
        await boxInfo.getByRole('tab', { name: 'Protein Bar' }).click();
        await expect(boxInfo.getByRole('tab', { name: 'Protein Bar' })).toHaveAttribute('aria-selected', 'true');
        await expect(rows).toContainText('12 BARS');
        await expect(rows).toContainText('$119.97');
        await boxInfo.getByRole('button', { name: 'Subscription' }).click();
        await expect(rows).toContainText('$70.77');
        await boxInfo.getByRole('button', { name: 'Close' }).click();
        await expect(boxInfo).toBeHidden();

        // 4. Under 'TRANSFORM YOUR DAILY HABITS' switch tabs MEAL ONE and PROTEIN BAR and click 'Ingredients & Nutritional Facts'
        const transform = page.locator('section.wmo--bundle-tabs');
        await expect(transform.getByRole('heading', { name: 'TRANSFORM YOUR DAILY HABITS' })).toBeVisible();
        const mealTab = transform.getByRole('tab', { name: 'MEAL ONE', exact: true });
        const barTab = transform.getByRole('tab', { name: 'PROTEIN BAR', exact: true });
        await mealTab.scrollIntoViewIfNeeded();
        await expect(mealTab).toHaveAttribute('aria-selected', 'true');
        await expect(transform.getByText('BUILD MUSCLE').first()).toBeVisible();
        await expect(transform.getByText('HEALTHY GUT').first()).toBeVisible();
        await barTab.click();
        await expect(barTab).toHaveAttribute('aria-selected', 'true');
        await expect(mealTab).toHaveAttribute('aria-selected', 'false');
        await expect(transform.getByText('MUSCLE RECOVERY').first()).toBeVisible();
        await mealTab.click();
        await expect(mealTab).toHaveAttribute('aria-selected', 'true');
        await expect(barTab).toHaveAttribute('aria-selected', 'false');
        await transform.getByRole('button', { name: 'Ingredients & Nutritional Facts' }).click();
        await expect(nutrition).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(nutrition).toBeHidden();
    });

    test('FAQ accordion behaviour', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', 'KOH bundle builder only');
        await openBuilder(page, merchant.pages.bundleBuilder);

        // 1. Scroll to 'FREQUENTLY ASKED QUESTIONS' and note which items are open
        const heading = page.getByRole('heading', { name: 'FREQUENTLY ASKED QUESTIONS' });
        await heading.scrollIntoViewIfNeeded();
        await expect(heading).toBeVisible();
        const questions = [
            'Why is Kreatures spelled with a "K"?',
            'I ate all of my MEAL ONE, what should I do next?',
            'What type of plant protein is it? And is it good for me?',
            'What are net carbs?',
            'Is this high in sugar?',
        ];
        const items = page.locator('details.mofaq__item');
        await expect(items).toHaveCount(5);
        for (let i = 0; i < questions.length; i++) {
            await expect(items.nth(i).locator('summary')).toHaveText(questions[i]);
        }
        await expect(items.nth(0)).toHaveAttribute('open', '');
        await expect(items.nth(0).locator('.mofaq__answer')).toContainText('Our founder thinks he\'s an "artist"');
        for (let i = 1; i < questions.length; i++) await expect(items.nth(i)).not.toHaveAttribute('open');

        // 2. Click each closed question, then click it again
        for (let i = 1; i < questions.length; i++) {
            const item = items.nth(i);
            const answer = item.locator('.mofaq__answer');
            await item.locator('summary').click();
            await expect(item).toHaveAttribute('open', '');
            await expect(answer).toBeVisible();
            expect(((await answer.innerText()) || '').trim().length, `answer ${i + 1} must not be empty`).toBeGreaterThan(0);
            await item.locator('summary').click();
            await expect(item).not.toHaveAttribute('open');
            await expect(answer).toBeHidden();
        }

        // 3. Check whether opening one item closes the others (observed: independent, not exclusive)
        await items.nth(1).locator('summary').click();
        await items.nth(2).locator('summary').click();
        await expect(items.nth(0)).toHaveAttribute('open', '');
        await expect(items.nth(1)).toHaveAttribute('open', '');
        await expect(items.nth(2)).toHaveAttribute('open', '');
        await expect(page.locator('details.mofaq__item[open]')).toHaveCount(3);
        await expect(items.nth(3)).not.toHaveAttribute('open');
    });

    test('Reviews widget on the builder page', async ({ page, merchant }) => {
        test.skip(merchant.slug !== 'koh', 'KOH bundle builder only');
        test.setTimeout(120_000);
        await openBuilder(page, merchant.pages.bundleBuilder);
        const url = page.url();

        // 1. Scroll to the Junip reviews section; change 'Sort by' / 'Rating'; toggle 'Photos & videos'
        // Junip is a third-party widget that loads late; its internal console errors are not asserted.
        const widget = page.locator('#junip-reviews');
        const reviews = widget.locator('.junip-review-list-item');
        const notFiveStar = reviews.filter({ hasNot: page.locator('[role="img"][aria-label="5 stars"]') });
        await widget.scrollIntoViewIfNeeded();
        await expect(reviews.first()).toBeVisible({ timeout: 20000 });

        const sortBy = widget.getByRole('combobox', { name: 'Sort by drop down' });
        const rating = widget.getByRole('combobox', { name: 'Rating drop down' });
        await sortBy.selectOption({ label: 'Highest rated' });
        await expect(sortBy).toHaveValue('highestRated');
        await rating.selectOption({ label: '5 stars' });
        await expect(rating).toHaveValue('5');
        // Only 5-star reviews remain (each card exposes its rating as role=img "N stars")
        await expect(reviews.first()).toBeVisible({ timeout: 20000 });
        await expect(notFiveStar).toHaveCount(0);
        expect(await reviews.count()).toBeGreaterThan(0);

        const photos = widget.getByRole('checkbox', { name: 'Toggle photos & videos filter' });
        await photos.click();
        await expect(photos).toHaveAttribute('aria-checked', 'true');
        await expect(reviews.first()).toBeVisible({ timeout: 20000 });
        await expect(notFiveStar).toHaveCount(0);
        await photos.click();
        await expect(photos).toHaveAttribute('aria-checked', 'false');
        await expect(reviews.first()).toBeVisible({ timeout: 20000 });
        await expect(page).toHaveURL(url);   // the list refreshes in place, no navigation

        // 2. Click 'See more reviews'
        const before = await reviews.count();
        await widget.getByRole('button', { name: 'See more reviews' }).click();
        await expect.poll(() => reviews.count(), { timeout: 20000 }).toBeGreaterThan(before);
        await expect(notFiveStar).toHaveCount(0);
    });
});
