/**
 * dynamic/dom-extractor.js -- In-page candidate extraction
 *
 * `extractCandidates` is serialised by Playwright and executed INSIDE the
 * page, so it must stay fully self-contained (no references to module scope).
 *
 * It walks the DOM and returns one record per "interesting" element: what it
 * is (tag, role, aria-label, text), where it sits (region, ancestors,
 * geometry, visibility) and -- crucially -- several ready-to-use CSS
 * selectors for it, ordered from most to least stable:
 *
 *   #stable-id  >  [data-testid]  >  tag[aria-label]  >  tag[name]
 *   >  tag.semantic-class  >  scoped-by-ancestor / add-to-cart-form
 *
 * Utility classes (Tailwind `px-4`, hashed CSS-in-JS `css-1x2y3z`, state
 * classes `is-open`) are excluded, so a selector is only generated from
 * names a human designed. Elements repeated many times (product cards)
 * collapse into one record with a `repeat` count.
 */

'use strict';

function extractCandidates(opts) {
    const MAX = opts.max || 1200;

    const SKIP = new Set(['script', 'style', 'meta', 'link', 'noscript', 'path', 'defs', 'g', 'use', 'title',
        'head', 'br', 'hr', 'circle', 'rect', 'line', 'polygon', 'polyline', 'symbol', 'lineargradient', 'stop',
        'clippath', 'template', 'html', 'body']);
    const TAGS = new Set(['a', 'button', 'input', 'select', 'textarea', 'form', 'img', 'svg', 'h1', 'h2', 'h3',
        'header', 'nav', 'section', 'summary', 'footer', 'aside', 'dialog', 'main', 'video', 'label']);
    const KEY = /cart|bag|basket|drawer|menu|nav|hero|banner|announce|promo|product|card|search|price|title|logo|badge|count|bubble|quick|atc|add|burger|toggle|header|slide|media|gallery|form|submit|btn|button|indicator/i;
    const STATE = /^(is|has|js-focus)-|^(active|open|opened|closed|hidden|visible|show|shown|loaded|loading|lazyload|lazyloaded|lazyloading|selected|focus|hover|disabled|sticky|scrolled|fixed|current)$/i;
    const HASHY = /^(css|sc|jsx|svelte|emotion|chakra|styled)[-_]|^(?=.*\d)(?=.*[a-z])[a-z0-9]{6,}$|\d{4,}/i;

    const isStableClass = c => c.length > 1 && !STATE.test(c) && !HASHY.test(c);
    const isSemanticClass = c => KEY.test(c) || /__|--/.test(c);
    const isStableId = id => id && !/\d{3,}/.test(id) && !/^[a-f0-9-]{16,}$/i.test(id) && !/^(radix|headlessui|react|:r)/i.test(id);

    const esc = s => CSS.escape(s);
    const norm = s => (s || '').replace(/\s+/g, ' ').trim();
    const matchCount = sel => { try { return document.querySelectorAll(sel).length; } catch (e) { return 0; } };

    const classesOf = el => norm(el.getAttribute('class')).split(' ').filter(Boolean);

    function isVisible(el, r) {
        if (r.width <= 0 || r.height <= 0) return false;
        return typeof el.checkVisibility === 'function'
            ? el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
            : true;
    }

    function regionOf(el) {
        if (el.closest('footer'))                     return 'footer';
        const h = el.closest('header,[role="banner"],#header-group,.header,.site-header,[id^="shopify-section-header"]');
        if (h && !h.closest('main,article'))          return 'header';
        if (el.closest('nav'))                        return 'nav';
        if (el.closest('main,[role="main"]'))         return 'main';
        return 'page';
    }

    function ancestorDescriptor(el, depth) {
        const out = [];
        let n = el.parentElement;
        while (n && out.length < depth && n !== document.body) {
            const sem = classesOf(n).filter(c => isStableClass(c) && isSemanticClass(c))[0];
            out.push(n.tagName.toLowerCase() + (sem ? '.' + sem : ''));
            n = n.parentElement;
        }
        return out;
    }

    /** First ancestor that has a stable id or semantic class -> a selector to scope by. */
    function scopeSelector(el) {
        let n = el.parentElement;
        for (let i = 0; n && i < 5 && n !== document.body; i++, n = n.parentElement) {
            if (isStableId(n.id) && matchCount('#' + esc(n.id)) === 1) return '#' + esc(n.id);
            const sem = classesOf(n).filter(c => isStableClass(c) && isSemanticClass(c))[0];
            if (sem) return n.tagName.toLowerCase() + '.' + esc(sem);
        }
        return null;
    }

    function buildSelectors(el, tag) {
        const out = [];
        const push = s => { if (s && !out.includes(s)) out.push(s); };

        if (isStableId(el.id)) push('#' + esc(el.id));
        for (const a of ['data-testid', 'data-test', 'data-qa', 'data-cy']) {
            const v = el.getAttribute(a);
            if (v && !/["\\]/.test(v)) push(`[${a}="${v}"]`);
        }
        const aria = el.getAttribute('aria-label');
        if (aria && aria.length <= 60 && !/["\\]/.test(aria)) push(`${tag}[aria-label="${aria}"]`);
        const name = el.getAttribute('name');
        if (name && /^(button|input|select|textarea)$/.test(tag) && !/["\\]/.test(name)) push(`${tag}[name="${name}"]`);

        const sem = classesOf(el).filter(c => isStableClass(c) && isSemanticClass(c));
        for (const c of sem.slice(0, 4)) { push(`${tag}.${esc(c)}`); push(`.${esc(c)}`); }
        if (sem.length >= 2) push(`${tag}.${esc(sem[0])}.${esc(sem[1])}`);

        if (tag === 'form') {
            const action = el.getAttribute('action');
            if (action && !/["\\]/.test(action)) push(`form[action="${action}"]`);
        }
        if (tag === 'a') {
            const href = el.getAttribute('href');
            if (href === '/') push('header a[href="/"]');
        }
        if (['h1', 'header', 'nav', 'main', 'footer'].includes(tag)) push(tag);

        // Scoped variants of the best plain selector.
        const base = out[0];
        if (base) {
            if (el.closest('form[action*="/cart/add"]')) push(`form[action*="/cart/add"] ${base}`);
            const scope = scopeSelector(el);
            if (scope) push(`${scope} ${base}`);
        }

        return out.filter(s => { const n = matchCount(s); return n >= 1 && n <= 80; }).slice(0, 6);
    }

    const records = [];
    const bySignature = new Map();

    for (const el of document.querySelectorAll('*')) {
        if (records.length >= MAX) break;
        const tag = el.tagName.toLowerCase();
        if (SKIP.has(tag)) continue;
        if (tag !== 'svg' && el.closest('svg')) continue;

        const cls = classesOf(el);
        const idClass = (el.id || '') + ' ' + cls.join(' ');
        const interesting = TAGS.has(tag) || el.hasAttribute('role') || el.hasAttribute('aria-label') || KEY.test(idClass);
        if (!interesting) continue;

        const selectors = buildSelectors(el, tag);
        if (!selectors.length) continue;

        // Collapse repeats (24 product cards -> 1 record, repeat = 24).
        const signature = selectors[0];
        if (bySignature.has(signature)) { bySignature.get(signature).repeat++; continue; }

        const r = el.getBoundingClientRect();
        const href = el.getAttribute('href') || '';
        const rec = {
            tag,
            role:        el.getAttribute('role') || '',
            region:      regionOf(el),
            id:          el.id || '',
            classes:     cls.filter(isStableClass),
            ariaLabel:   el.getAttribute('aria-label') || '',
            name:        el.getAttribute('name') || '',
            type:        el.getAttribute('type') || '',
            placeholder: el.getAttribute('placeholder') || '',
            alt:         el.getAttribute('alt') || '',
            href:        href.startsWith('http') ? (() => { try { return new URL(href).pathname; } catch (e) { return ''; } })() : href,
            action:      el.getAttribute('action') || '',
            text:        norm(el.textContent).slice(0, 80),
            parents:     ancestorDescriptor(el, 3),
            visible:     isVisible(el, r),
            top:         Math.round(r.top + window.scrollY),
            width:       Math.round(r.width),
            height:      Math.round(r.height),
            hasProductLink: tag === 'a' ? /\/products\//.test(href) : !!el.querySelector('a[href*="/products/"]'),
            imgCount:    el.querySelectorAll('img').length,
            repeat:      1,
            selectors,
        };
        bySignature.set(signature, rec);
        records.push(rec);
    }

    return { url: location.pathname, title: document.title, viewportWidth: innerWidth, records };
}

module.exports = { extractCandidates };
