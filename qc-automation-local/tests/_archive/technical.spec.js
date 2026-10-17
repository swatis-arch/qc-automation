/**
 * tests/technical.spec.js — Technical Quality Regression Suite
 *
 * Covers: Broken images, major JS errors, console errors,
 *         network failures, SEO meta tags, page speed basics.
 *
 * Regression Catalogue: Technical checks
 * Priority: P1/P2
 * Type: Universal
 */

const { test, expect }           = require('../fixtures/base');
const { captureConsoleErrors }   = require('../utils/console');
const { captureNetworkFailures } = require('../utils/network');
const { getMetaDescription, canonicalLink } = require('../utils/page-checks');

test.describe('SUNTEK QC — Technical Quality', () => {

    // ── Broken images ──────────────────────────────────────────────────────────

    test('@smoke Technical — Homepage has no broken images (4xx)', async ({ page, merchant }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        // Wait for the page's main content (and its images) to render
        await page.locator(`${merchant.locators.get('productCard')}, ${merchant.locators.get('hero')}`).first()
            .waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});

        // Collect all image src attributes from the DOM
        const imgSrcs = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('img[src]'))
                .map(img => img.src)
                .filter(src =>
                    src &&
                    src.startsWith('http') &&
                    !src.includes('data:') &&
                    !src.includes('about:blank')
                );
        });

        const brokenImages = [];

        // Check each image URL directly (only actual img elements, not preload hints)
        for (const src of imgSrcs.slice(0, 30)) {  // Cap at 30 to keep test fast
            try {
                const response = await page.request.head(src, { timeout: 8_000 }).catch(() => null);
                if (response && response.status() >= 400) {
                    brokenImages.push({ url: src, status: response.status() });
                }
            } catch { /* ignore network errors for individual images */ }
        }

        if (brokenImages.length > 0) {
            console.warn('[Broken Images]', brokenImages);
        }
        expect(brokenImages).toHaveLength(0);
    });

    test('Technical — PDP has no broken images', async ({ page, merchant }) => {
        const brokenImages = [];

        page.on('response', response => {
            const url    = response.url();
            const status = response.status();
            if (status >= 400 && (url.includes('cdn.shopify.com') || url.includes('/cdn/shop/'))) {
                brokenImages.push({ url, status });
            }
        });

        await page.goto(merchant.products.default.path, { waitUntil: 'domcontentloaded' });

        if (brokenImages.length > 0) {
            console.warn('[Broken PDP Images]', brokenImages);
        }
        expect(brokenImages).toHaveLength(0);
    });

    // ── Console errors ─────────────────────────────────────────────────────────

    // Path resolved per-merchant at test-run time via the `merchant` fixture,
    // not baked in here, so these loops run correctly for every merchant.
    const pages = [
        { name: 'Homepage',   pathOf: merchant => '/',                              smoke: true  },
        { name: 'Collection', pathOf: merchant => merchant.pages.collection,        smoke: false },
        { name: 'PDP',        pathOf: merchant => merchant.products.default.path,   smoke: false },
    ];

    for (const { name, pathOf, smoke } of pages) {
        test(`${smoke ? '@smoke ' : ''}Technical — ${name} loads without unhandled JS exceptions`, async ({ page, merchant }) => {
            const consoleErrors = captureConsoleErrors(page);
            await page.goto(pathOf(merchant), { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(2000); // Allow async errors to surface

            const jsExceptions = consoleErrors.getErrors().filter(e => e.type === 'pageerror');
            if (jsExceptions.length > 0) {
                console.warn(`[JS Exceptions on ${name}]`, jsExceptions.map(e => e.message));
            }
            expect(jsExceptions).toHaveLength(0);
        });
    }

    // ── Network failures ───────────────────────────────────────────────────────

    test('@smoke Technical — Homepage has no 5xx server errors', async ({ page }) => {
        const network = captureNetworkFailures(page);
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        // Allow async requests to settle briefly
        await page.waitForTimeout(3000);

        const serverErrors = network.getFailures().filter(f => f.status >= 500);
        if (serverErrors.length > 0) {
            console.warn('[Server Errors]', network.toStrings().filter(s => s.includes('5')));
        }
        expect(serverErrors).toHaveLength(0);
    });

    // ── SEO / Meta tags ────────────────────────────────────────────────────────

    for (const { name, pathOf } of pages) {
        test(`Technical — ${name} has a non-empty title tag`, async ({ page, merchant }) => {
            await page.goto(pathOf(merchant), { waitUntil: 'domcontentloaded' });
            const title = await page.title();
            expect(title.trim().length).toBeGreaterThan(0);
        });

        test(`Technical — ${name} has a meta description`, async ({ page, merchant }) => {
            await page.goto(pathOf(merchant), { waitUntil: 'domcontentloaded' });
            const desc = await getMetaDescription(page);
            expect(desc && desc.trim().length > 0).toBe(true);
        });

        test(`Technical — ${name} has a canonical tag`, async ({ page, merchant }) => {
            await page.goto(pathOf(merchant), { waitUntil: 'domcontentloaded' });
            const canonical = canonicalLink(page);
            expect(await canonical.count()).toBeGreaterThan(0);
            expect(await canonical.first().getAttribute('href')).toBeTruthy();
        });
    }

    // ── Open Graph tags ────────────────────────────────────────────────────────

    test('Technical — Homepage has Open Graph title and description', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
        const ogDesc  = await page.locator('meta[property="og:description"]').getAttribute('content');

        expect(ogTitle && ogTitle.trim().length > 0).toBe(true);
        expect(ogDesc  && ogDesc.trim().length  > 0).toBe(true);
    });

    // ── Viewport / Responsive ──────────────────────────────────────────────────

    test('Technical — Homepage has correct viewport meta tag', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
        expect(viewport).toContain('width=device-width');
    });

    // ── Response time ──────────────────────────────────────────────────────────

    test('Technical — Homepage responds in under 5 seconds', async ({ page }) => {
        const start = Date.now();
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        const elapsed = Date.now() - start;
        console.log(`[Performance] Homepage DOM ready in ${elapsed}ms`);
        expect(elapsed).toBeLessThan(5000);
    });

});
