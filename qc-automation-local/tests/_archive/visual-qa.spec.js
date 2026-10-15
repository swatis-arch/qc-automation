/**
 * tests/visual-qa.spec.js — Visual / UI (design QA) checks that need no design file
 *
 * Source: Shopify_Visual_QA_Test_Cases.xlsx (TC_VIS_001-085). Most of that sheet compares the
 * build with the Figma file (exact sizes, colours, spacing, copy) and stays a manual check.
 * This spec automates the objective cases — the ones with a pass/fail answer on the page itself.
 *
 * Automated here: 006/007 fonts · 015 text overflow · 022 cross-page consistency · 027 equal card
 * heights · 035 logo sharpness · 045 layout shift · 058 double-digit cart badge · 065 breakpoint
 * sweep (incl. 320px and landscape 066) · 067/070 scroll and reduced-motion visibility · 079
 * placeholder text · 082 text contrast · 084 200% zoom.
 *
 * Covered elsewhere: 028/059-064 horizontal scroll (homepage/plp/pdp/cart specs) · 043 focus
 * (TC_HP_077, TC_PLP_077, TC_PDP_086, TC_CART_075) · 030 aspect ratio (TC_PLP_014, TC_HP_069) ·
 * 048 empty cart (TC_CART_027/028) · 057 sale/sold-out badges (TC_PLP_023/024) · 071 sticky
 * header (TC_HP_013, TC_PDP_061) · 044 sold-out ATC (TC_PDP_028) · 002 regression vs baseline
 * (visual.spec.js).
 *
 * Manual (need the design file, a person, or a real device): 001-005, 008-014, 016-021,
 * 023-026, 029, 031-034, 036-042, 046, 047, 049-056, 068, 069, 073-078, 080, 081, 083, 085.
 *
 * Tests that set their own viewport run on the desktop project only.
 */

const { test, expect } = require('../fixtures/base');
const { horizontalOverflow, PLACEHOLDER_TEXT, BROKEN_TEMPLATE } = require('../utils/page-checks');
const { PERFORMANCE } = require('../utils/test-data');

/** The pages each check sweeps: [label, path]. */
const pagesOf = merchant => [
    ['Homepage',   '/'],
    ['Collection', merchant.pages.collection],
    ['Product',    merchant.pages.product],
];

async function open(page, path) {
    await page.goto(path, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
}

/** Scroll to the bottom in steps (triggers lazy content and reveal animations), then back up. */
async function scrollThrough(page) {
    await page.evaluate(async () => {
        for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight / 2) {
            scrollTo(0, y);
            await new Promise(r => setTimeout(r, 150));
        }
        scrollTo(0, 0);
    });
    await page.waitForTimeout(1_000);
}

test.describe('SUNTEK QC — Visual QA [TC_VIS]', () => {

    // ── Typography ─────────────────────────────────────────────────────────────

    test('VIS — Web fonts load and text never renders in a fallback font [TC_VIS_006/007]', async ({ page, merchant }) => {
        const failedFonts = [];
        page.on('response', r => {
            if (r.request().resourceType() === 'font' && r.status() >= 400) failedFonts.push(`${r.status()} ${r.url()}`);
        });

        for (const [label, path] of pagesOf(merchant)) {
            await test.step(label, async () => {
                await open(page, path);
                const fallbacks = await page.evaluate(() => {
                    const SYSTEM = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-\w+|-apple-system|blinkmacsystemfont|segoe ui|roboto|helvetica( neue)?|arial|georgia|times( new roman)?|courier( new)?|verdana|tahoma|inherit|initial)$/i;
                    const loaded = new Set([...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replace(/["']/g, '').toLowerCase()));
                    const out = new Set();
                    for (const el of document.querySelectorAll('h1, h2, h3, p, button, a, .price, [class*="price"]')) {
                        if (!el.offsetParent || !el.textContent.trim()) continue;
                        const first = getComputedStyle(el).fontFamily.split(',')[0].trim().replace(/["']/g, '');
                        if (!SYSTEM.test(first) && !loaded.has(first.toLowerCase())) out.add(`${first} (on <${el.tagName.toLowerCase()}> "${el.textContent.trim().slice(0, 30)}")`);
                    }
                    return [...out];
                });
                expect(fallbacks, `${label}: declared web fonts that never loaded, so the browser fell back`).toEqual([]);
            });
        }
        expect(failedFonts, 'font files that failed to download').toEqual([]);
    });

    test('VIS — Titles, prices and buttons are not cut off without an ellipsis [TC_VIS_015]', async ({ page, merchant }) => {
        for (const [label, path] of pagesOf(merchant)) {
            await test.step(label, async () => {
                await open(page, path);
                const clipped = await page.evaluate(() => [...document.querySelectorAll('h1, h2, h3, button, [class*="title"], [class*="price"]')]
                    .filter(el => {
                        if (!el.offsetParent || !el.textContent.trim() || el.closest('[aria-hidden="true"], details:not([open])')) return false;
                        const s = getComputedStyle(el);
                        const cut = el.scrollWidth > el.clientWidth + 1 && s.overflowX !== 'visible';
                        return cut && s.textOverflow !== 'ellipsis' && el.clientWidth > 0;
                    })
                    .slice(0, 10)
                    .map(el => `<${el.tagName.toLowerCase()}> "${el.textContent.trim().slice(0, 40)}"`));
                expect(clipped, `${label}: text clipped mid-word`).toEqual([]);
            });
        }
    });

    // ── Colour & theme ─────────────────────────────────────────────────────────

    test('VIS — Header, footer and body text look the same on every page [TC_VIS_022]', async ({ homepage, page, merchant }) => {
        const css = (locator, ...props) => locator.evaluate((el, props) => props.map(p => getComputedStyle(el)[p]), props);
        const styles = {};
        for (const [label, path] of pagesOf(merchant)) {
            await open(page, path);
            const [headerBg] = await css(homepage.header, 'backgroundColor');
            const [footerBg, footerText] = await css(homepage.footer.root, 'backgroundColor', 'color');
            const [bodyFont, bodyColor] = await css(page.locator('body'), 'fontFamily', 'color');
            styles[label] = { bodyFont, bodyColor, headerBg, footerBg, footerText };
        }
        const [first, ...rest] = Object.keys(styles);
        for (const label of rest) {
            expect(styles[label], `${label} vs ${first}`).toEqual(styles[first]);
        }
    });

    // ── Spacing & alignment ────────────────────────────────────────────────────

    test('VIS — Product cards in a row have equal heights [TC_VIS_027]', async ({ plp, isMobile }) => {
        test.skip(isMobile, 'Mobile grids are often a single column — run on desktop');
        await plp.productCards.first().waitFor({ state: 'visible' });
        const rows = await plp.productCards.evaluateAll(cards => {
            const byTop = {};
            for (const el of cards) {
                const r = el.getBoundingClientRect();
                if (!r.height || !el.offsetParent) continue;
                (byTop[Math.round(r.top / 4)] ||= []).push(Math.round(r.height));
            }
            return Object.values(byTop).filter(row => row.length > 1).slice(0, 4);
        });
        test.skip(rows.length === 0, 'No row with two or more cards found');
        for (const row of rows) {
            expect(Math.max(...row) - Math.min(...row), `card heights in a row: ${row.join(', ')}px`).toBeLessThanOrEqual(2);
        }
    });

    // ── Imagery ────────────────────────────────────────────────────────────────

    test('VIS — Logo is sharp on 2x screens and not distorted [TC_VIS_035]', async ({ homepage, page }) => {
        const info = await homepage.logo.evaluate(root => {
            const el = root.matches('img, svg') ? root : root.querySelector('img, svg');
            if (!el) return null;
            const r = el.getBoundingClientRect();
            if (el.tagName.toLowerCase() === 'svg') return { kind: 'svg' };
            return { kind: 'img', src: el.currentSrc || el.src, naturalW: el.naturalWidth, naturalH: el.naturalHeight, w: r.width, h: r.height };
        });
        expect(info, 'logo has an <img> or <svg>').not.toBeNull();
        if (info.kind === 'svg' || /\.svg(\?|$)/i.test(info.src)) return;   // vector: sharp at any density

        expect(info.naturalW / info.w, `logo file is ${info.naturalW}px wide for a ${Math.round(info.w)}px slot`).toBeGreaterThanOrEqual(1.5);
        const stretch = (info.w / info.h) / (info.naturalW / info.naturalH);
        expect(Math.abs(stretch - 1), 'logo aspect ratio matches the image file').toBeLessThan(0.03);
    });

    // ── Component states ───────────────────────────────────────────────────────

    test('VIS — Layout does not jump while pages load [TC_VIS_045]', async ({ page, merchant }) => {
        await page.addInitScript(() => {
            window.__cls = 0;
            new PerformanceObserver(list => {
                for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
            }).observe({ type: 'layout-shift', buffered: true });
        });
        for (const [label, path] of pagesOf(merchant)) {
            await test.step(label, async () => {
                await open(page, path);
                await page.waitForTimeout(3_000);   // late banners, fonts and app widgets
                const cls = await page.evaluate(() => window.__cls);
                expect(cls, `${label}: cumulative layout shift`).toBeLessThan(PERFORMANCE.maxCLS);
            });
        }
    });

    // ── Icons & badges ─────────────────────────────────────────────────────────

    test('VIS — Cart count bubble holds a double-digit count [TC_VIS_058]', async ({ homepage, cart, page, merchant }) => {
        const items = [];
        for (const which of ['default', 'secondary']) {
            const { variants } = await cart.availableVariants(merchant.products[which].handle);
            if (variants.length) items.push({ id: variants[0].id, quantity: 5 });
        }
        test.skip(items.length < 2, 'Need both configured products in stock to reach 10 items');
        await cart.seed(items);
        test.skip((await cart.cartJson()).item_count < 10, 'Stock limits kept the cart under 10 items');

        await page.goto('/', { waitUntil: 'load' });
        const badge = homepage.cartBadge;
        await expect(badge, 'badge shows the count').toHaveText(/\b\d{2}\b/);
        const fits = await badge.evaluate(el => {
            const r = el.getBoundingClientRect();
            return { inside: el.scrollWidth <= el.clientWidth + 1, onScreen: r.right <= innerWidth && r.left >= 0 };
        });
        expect(fits.inside, 'two digits fit inside the bubble').toBe(true);
        expect(fits.onScreen, 'bubble stays on screen').toBe(true);
    });

    // ── Responsive ─────────────────────────────────────────────────────────────

    test('VIS — No horizontal scroll at any width from 320px to 1920px or in phone landscape [TC_VIS_065/066]', async ({ page, merchant, isMobile }) => {
        test.skip(isMobile, 'This test sets its own viewport — run it on the desktop project');
        const WIDTHS = [[320, 640], [360, 740], [480, 800], [600, 900], [812, 375], [900, 900], [1280, 800], [1600, 900], [1920, 1080]];
        for (const [label, path] of pagesOf(merchant)) {
            await test.step(label, async () => {
                await open(page, path);
                const overflowing = [];
                for (const [width, height] of WIDTHS) {
                    await page.setViewportSize({ width, height });
                    await page.waitForTimeout(300);
                    const px = await horizontalOverflow(page);
                    if (px > 0) overflowing.push(`${width}x${height}: ${px}px`);
                }
                expect(overflowing, `${label}: widths with horizontal scroll`).toEqual([]);
            });
        }
    });

    test('VIS — Page stays usable at 200% browser zoom [TC_VIS_084]', async ({ homepage, page, merchant, isMobile }) => {
        test.skip(isMobile, 'This test sets its own viewport — run it on the desktop project');
        // 200% zoom on a 1280x800 window lays out exactly like a 640x400 viewport.
        await page.setViewportSize({ width: 640, height: 400 });
        for (const [label, path] of pagesOf(merchant)) {
            await test.step(label, async () => {
                await open(page, path);
                expect(await horizontalOverflow(page), `${label}: horizontal scroll at 200%`).toBe(0);
                await expect(homepage.logo, `${label}: logo still visible`).toBeVisible();
            });
        }
    });

    // ── Animations ─────────────────────────────────────────────────────────────

    for (const { tc, label, reduce } of [
        { tc: 'TC_VIS_067', label: 'after scrolling through the page', reduce: false },
        { tc: 'TC_VIS_070', label: 'with "reduce motion" turned on',  reduce: true },
    ]) {
        test(`VIS — No content stays invisible ${label} [${tc}]`, async ({ page, merchant }) => {
            if (reduce) await page.emulateMedia({ reducedMotion: 'reduce' });
            for (const [pageLabel, path] of pagesOf(merchant)) {
                await test.step(pageLabel, async () => {
                    await open(page, path);
                    await scrollThrough(page);
                    const hidden = await page.evaluate(() => [...document.querySelectorAll('main h1, main h2, main h3, main p, main img')]
                        .filter(el => {
                            const r = el.getBoundingClientRect();
                            if (!r.width || !r.height || r.right < 0 || r.left > innerWidth) return false;   // off-canvas slides
                            if (el.closest('[aria-hidden="true"], [hidden], details:not([open]), dialog:not([open])')) return false;
                            let opacity = 1;
                            for (let n = el; n && n !== document.body; n = n.parentElement) {
                                const s = getComputedStyle(n);
                                if (s.visibility === 'hidden' || s.display === 'none') return false;
                                opacity *= parseFloat(s.opacity);
                            }
                            return opacity < 0.1;
                        })
                        .slice(0, 10)
                        .map(el => `<${el.tagName.toLowerCase()}> ${(el.textContent || el.getAttribute('alt') || el.currentSrc || '').trim().slice(0, 40)}`));
                    expect(hidden, `${pageLabel}: elements left at opacity ~0`).toEqual([]);
                });
            }
        });
    }

    // ── Content ────────────────────────────────────────────────────────────────

    test('VIS — No placeholder, demo or unrendered template text [TC_VIS_079]', async ({ page, merchant }) => {
        for (const [label, path] of [...pagesOf(merchant), ['Cart', '/cart']]) {
            await test.step(label, async () => {
                await open(page, path);
                const text = await page.locator('body').innerText();
                expect(text, `${label}: placeholder or demo text`).not.toMatch(PLACEHOLDER_TEXT);
                expect(text, `${label}: unrendered template values`).not.toMatch(BROKEN_TEMPLATE);
            });
        }
    });

    // ── Accessibility (visual) ─────────────────────────────────────────────────

    test('VIS — Text meets WCAG AA contrast against its background [TC_VIS_082]', async ({ page, merchant }) => {
        for (const [label, path] of pagesOf(merchant)) {
            await test.step(label, async () => {
                await open(page, path);
                const failures = await page.evaluate(() => {
                    const rgba = c => { const m = c.match(/[\d.]+/g) || [0, 0, 0, 0]; return { r: +m[0], g: +m[1], b: +m[2], a: m[3] === undefined ? 1 : +m[3] }; };
                    const lum = ({ r, g, b }) => [r, g, b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; })
                        .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
                    const blend = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });

                    // Solid background behind an element, or null when an image/gradient makes it unknowable.
                    const background = el => {
                        const layers = [];
                        for (let n = el; n; n = n.parentElement) {
                            const s = getComputedStyle(n);
                            if (s.backgroundImage !== 'none') return null;
                            const c = rgba(s.backgroundColor);
                            if (c.a > 0) { layers.push(c); if (c.a === 1) break; }
                        }
                        return layers.reverse().reduce((under, top) => blend(top, under), { r: 255, g: 255, b: 255, a: 1 });
                    };

                    const out = [];
                    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
                    const seen = new Set();
                    for (let node = walker.nextNode(); node && out.length < 15; node = walker.nextNode()) {
                        const el = node.parentElement;
                        if (!node.textContent.trim() || seen.has(el)) continue;
                        seen.add(el);
                        const r = el.getBoundingClientRect();
                        if (r.width < 2 || r.height < 2 || !el.checkVisibility?.({ opacityProperty: true, visibilityProperty: true })) continue;
                        if (el.closest('[aria-hidden="true"], [disabled], [aria-disabled="true"], s, del, script, style, noscript')) continue;
                        const s = getComputedStyle(el);
                        const bg = background(el);
                        if (!bg) continue;
                        const fg = blend(rgba(s.color), bg);
                        const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a);
                        const ratio = (hi + 0.05) / (lo + 0.05);
                        const size = parseFloat(s.fontSize);
                        const large = size >= 24 || (size >= 18.66 && parseInt(s.fontWeight, 10) >= 700);
                        if (ratio < (large ? 3 : 4.5)) out.push(`${ratio.toFixed(2)}:1 "${node.textContent.trim().slice(0, 40)}" (${s.color} on rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)}), ${size}px)`);
                    }
                    return out;
                });
                expect(failures, `${label}: text below WCAG AA (4.5:1, or 3:1 for large text)`).toEqual([]);
            });
        }
    });

});
