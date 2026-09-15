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

test.describe('SUNTEK QC — Technical Quality', () => {

    // ── Broken images ──────────────────────────────────────────────────────────

    test('@smoke Technical — Homepage has no broken images (4xx)', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        // Wait for images to be rendered
        await page.locator('.product-card img, .hero img, img.logo__image').first()
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

    test('Technical — PDP has no broken images', async ({ page }) => {
        const brokenImages = [];

        page.on('response', response => {
            const url    = response.url();
            const status = response.status();
            if (status >= 400 && (url.includes('cdn.shopify.com') || url.includes('/cdn/shop/'))) {
                brokenImages.push({ url, status });
            }
        });

        await page.goto('/products/firming-vegan-collagen-prep-serum', { waitUntil: 'domcontentloaded' });

        if (brokenImages.length > 0) {
            console.warn('[Broken PDP Images]', brokenImages);
        }
        expect(brokenImages).toHaveLength(0);
    });

    // ── Console errors ─────────────────────────────────────────────────────────

    test('@smoke Technical — Homepage loads without unhandled JS exceptions', async ({ page }) => {
        const consoleErrors = captureConsoleErrors(page);
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2000); // Allow async errors to surface

        const jsExceptions = consoleErrors.getErrors().filter(e => e.type === 'pageerror');
        if (jsExceptions.length > 0) {
            console.warn('[JS Exceptions on Homepage]', jsExceptions.map(e => e.message));
        }
        expect(jsExceptions).toHaveLength(0);
    });

    test('Technical — Collection page loads without unhandled JS exceptions', async ({ page }) => {
        const consoleErrors = captureConsoleErrors(page);
        await page.goto('/collections/best-sellers', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2000);

        const jsExceptions = consoleErrors.getErrors().filter(e => e.type === 'pageerror');
        if (jsExceptions.length > 0) {
            console.warn('[JS Exceptions on PLP]', jsExceptions.map(e => e.message));
        }
        expect(jsExceptions).toHaveLength(0);
    });

    test('Technical — PDP loads without unhandled JS exceptions', async ({ page }) => {
        const consoleErrors = captureConsoleErrors(page);
        await page.goto('/products/firming-vegan-collagen-prep-serum', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2000);

        const jsExceptions = consoleErrors.getErrors().filter(e => e.type === 'pageerror');
        if (jsExceptions.length > 0) {
            console.warn('[JS Exceptions on PDP]', jsExceptions.map(e => e.message));
        }
        expect(jsExceptions).toHaveLength(0);
    });

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

    const seoPages = [
        { name: 'Homepage',    path: '/' },
        { name: 'Collection',  path: '/collections/best-sellers' },
        { name: 'PDP',         path: '/products/firming-vegan-collagen-prep-serum' },
    ];

    for (const { name, path } of seoPages) {
        test(`Technical — ${name} has a non-empty title tag`, async ({ page }) => {
            await page.goto(path, { waitUntil: 'domcontentloaded' });
            const title = await page.title();
            expect(title.trim().length).toBeGreaterThan(0);
        });

        test(`Technical — ${name} has a meta description`, async ({ page }) => {
            await page.goto(path, { waitUntil: 'domcontentloaded' });
            const desc = await page.locator('meta[name="description"]').getAttribute('content');
            expect(desc && desc.trim().length > 0).toBe(true);
        });

        test(`Technical — ${name} has a canonical tag`, async ({ page }) => {
            await page.goto(path, { waitUntil: 'domcontentloaded' });
            const canonical = await page.locator('link[rel="canonical"]').count();
            expect(canonical).toBeGreaterThan(0);
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
