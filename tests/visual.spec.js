/**
 * tests/visual.spec.js — Visual Regression Suite
 *
 * Uses Playwright's built-in screenshot comparison to detect
 * unintended visual changes after deployments.
 *
 * Run baselines: npm run test:visual:update
 * Run comparison: npm run test:visual
 *
 * Note: Claude is used to EXPLAIN meaningful visual differences.
 * Claude does NOT replace the deterministic screenshot assertion.
 *
 * Regression Catalogue: Visual regression
 * Priority: P2
 * Type: Universal
 */

const { test, expect } = require('../fixtures/base');

test.describe('SUNTEK QC — Visual Regression', () => {

    // ── Homepage ───────────────────────────────────────────────────────────────

    test('Visual — Homepage full-page screenshot matches baseline', async ({ homepage, page }) => {
        // Allow lazy-loaded images to settle
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        await expect(page).toHaveScreenshot('homepage-full.png', {
            fullPage:          true,
            maxDiffPixelRatio: 0.02,   // Allow 2% pixel difference (font rendering, AA)
            timeout:           30_000,
        });
    });

    test('Visual — Homepage above-the-fold screenshot matches baseline', async ({ homepage, page }) => {
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(500);

        await expect(page).toHaveScreenshot('homepage-above-fold.png', {
            fullPage:          false,
            maxDiffPixelRatio: 0.02,
        });
    });

    // ── Product Detail Page ────────────────────────────────────────────────────

    test('Visual — Default product PDP matches baseline', async ({ pdp, page }) => {
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(500);

        await expect(page).toHaveScreenshot('pdp-default.png', {
            fullPage:          true,
            maxDiffPixelRatio: 0.02,
        });
    });

    // ── Collection Page ────────────────────────────────────────────────────────

    test('Visual — Best Sellers PLP matches baseline', async ({ plp, page }) => {
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(500);

        await expect(page).toHaveScreenshot('plp-best-sellers.png', {
            fullPage:          true,
            maxDiffPixelRatio: 0.02,
        });
    });

    // ── Component-level screenshots ────────────────────────────────────────────

    test('Visual — Navbar component matches baseline', async ({ homepage, page }) => {
        const header = homepage.header;
        await header.waitFor({ state: 'visible', timeout: 10_000 });

        await expect(header).toHaveScreenshot('component-navbar.png', {
            maxDiffPixelRatio: 0.02,
        });
    });

    // ── Mobile viewport ────────────────────────────────────────────────────────

    test('Visual — Homepage mobile viewport matches baseline', async ({ page }) => {
        await page.route('**/*klaviyo*', route => route.abort());
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        await expect(page).toHaveScreenshot('homepage-mobile.png', {
            fullPage:          true,
            maxDiffPixelRatio: 0.03,   // Mobile rendering has slightly more variance
        });
    });

});
