/**
 * dynamic/resolver.js -- RAG selector resolver
 *
 * Maps each generic intent ("the hamburger button") to a merchant-specific
 * CSS selector:
 *
 *   1. RETRIEVE  embed the intent, pull the top-k most similar elements
 *                from the merchant's vector store (filtered to the intent's
 *                page + viewport) and flatten them into candidate selectors.
 *   2. VALIDATE  run each candidate against the LIVE page and check it with
 *                the intent's structural predicate (dynamic/intents.js).
 *                Retrieval only needs recall; this step supplies precision.
 *   3. GENERATE  (optional) Claude picks among the survivors.
 *   4. VERIFY    a selector must hold on every viewport the intent lists;
 *                if no single selector does, desktop + mobile winners are
 *                unioned. The hamburger + mobile-menu pair is additionally
 *                proven behaviourally: clicking the hamburger must reveal
 *                the menu.
 *
 * Confidence (0.5-0.99) = 0.5 for passing live validation, plus up to 0.5
 * for semantic-similarity evidence, match tightness and selector stability.
 * Below REVIEW_THRESHOLD (0.7, per CLAUDE.md) the result is flagged
 * `needsReview`.
 */

'use strict';

const { INTENTS, OPTIONAL_MIN_CONFIDENCE, REVIEW_THRESHOLD } = require('./intents');
const llm = require('./llm');

const MAX_CANDIDATES = 70;
const MAX_PASSERS    = 6;

// -- In-page element description (serialised by Playwright; self-contained) ---

function describeInPage(el, arg) {
    const r = el.getBoundingClientRect();
    const tag = el.tagName.toLowerCase();
    const attr = n => el.getAttribute(n) || '';
    const norm = s => (s || '').replace(/\s+/g, ' ').trim();

    const hdr = el.closest('header,[role="banner"],#header-group,.header,.site-header,[id^="shopify-section-header"]');
    let inFixed = false;
    for (let n = el; n && n !== document.body; n = n.parentElement) {
        const p = getComputedStyle(n).position;
        if (p === 'fixed' || p === 'sticky') { inFixed = true; break; }
    }
    const href = attr('href');

    return {
        viewport:   arg.viewport,
        vw:         innerWidth,
        vh:         innerHeight,
        tag,
        role:       attr('role'),
        classId:    (attr('class') + ' ' + (el.id || '')).toLowerCase(),
        ariaLabel:  attr('aria-label').toLowerCase(),
        name:       attr('name').toLowerCase(),
        title:      attr('title').toLowerCase(),
        href:       href.toLowerCase(),
        action:     attr('action').toLowerCase(),
        text:       norm(el.textContent).slice(0, 120),
        top:        Math.round(r.top + scrollY),
        width:      Math.round(r.width),
        height:     Math.round(r.height),
        linkCount:  el.querySelectorAll('a[href]').length,
        buttonCount: el.querySelectorAll('button,[role="button"],summary').length,
        imgCount:   el.querySelectorAll('img,picture').length,
        svgCount:   el.querySelectorAll('svg').length,
        videoCount: el.querySelectorAll('video').length,
        headingCount: el.querySelectorAll('h1,h2,h3').length,
        hasProductLink: tag === 'a' ? /\/products\//.test(href) : !!el.querySelector('a[href*="/products/"]'),
        hasSearchInput: !!el.querySelector('input[type="search"],input[name="q"],input[name="query"]'),
        hrefIsRoot: href === '/' || href === location.origin || href === location.origin + '/',
        inHeader:   !!hdr && !hdr.closest('main,article'),
        inFixed,
        inCartForm: !!el.closest('form[action*="/cart/add"]'),
        isButtonLike: ['button', 'summary', 'a', 'input'].includes(tag) || attr('role') === 'button',
        disabled:   el.disabled === true,
    };
}

// -- Helpers ------------------------------------------------------------------

function queryText(intent) {
    return `${intent.description} . ${intent.keywords} . page ${intent.page}`;
}

/** Stability preference, mirroring the CLAUDE.md selector order. */
function selectorKind(selector) {
    if (/:nth-/.test(selector))                   return 0.3;
    if (/^#|\[data-(test|qa|cy)/.test(selector))  return 1.0;
    if (/\[(aria-label|name|action)/.test(selector)) return 0.9;
    if (/\./.test(selector))                      return 0.8;
    return 0.5;
}

const avg = xs => xs.reduce((a, b) => a + b, 0) / xs.length;

function flattenHits(hits) {
    const seen = new Map();
    for (const { doc, score } of hits) {
        doc.selectors.forEach((selector, i) => {
            const sim = score - i * 0.001;               // earlier (more stable) selector wins ties
            if (!seen.has(selector) || seen.get(selector).sim < sim) seen.set(selector, { selector, sim });
        });
    }
    return [...seen.values()].sort((a, b) => b.sim - a.sim);
}

// -- Resolver -----------------------------------------------------------------

class Resolver {

    /**
     * @param {{pool:object, store:object, embedder:object, useLLM?:boolean, log?:Function}} ctx
     */
    constructor({ pool, store, embedder, useLLM = false, log = console.log }) {
        if (store.embedder && store.embedder.name !== embedder.name) {
            throw new Error(
                `[resolver] Index was built with "${store.embedder.name}" but the active embedder is ` +
                `"${embedder.name}". Re-run: npm run dynamic:scrape -- ${store.slug}`
            );
        }
        this.pool = pool;
        this.store = store;
        this.embedder = embedder;
        this.useLLM = llm.enabled(useLLM);
        this.log = log;
        this.cache = new Map();
    }

    /** Run `selector` on the live (intent.page, viewport) page and apply the intent's predicate. */
    async inspect(intent, viewport, selector) {
        const ck = `${intent.page}|${viewport}|${intent.mode}|${selector}`;
        let entry = this.cache.get(ck);
        if (!entry) {
            entry = { info: null };
            try {
                const page = await this.pool.get(intent.page, viewport);
                const loc = page.locator(selector);
                const count = await loc.count();
                if (count) {
                    const visible = loc.filter({ visible: true });
                    const visibleCount = await visible.count();
                    if (intent.mode !== 'visible' || visibleCount) {
                        const target = (intent.mode === 'visible' ? visible : loc).first();
                        const info = await target.evaluate(describeInPage, { viewport }, { timeout: 3000 });
                        info.count = count;
                        info.visibleCount = visibleCount;
                        info.signals = `${info.classId} ${info.ariaLabel} ${info.name} ${info.title} ${info.text} ${info.href} ${info.action}`.toLowerCase();
                        entry.info = info;
                    }
                }
            } catch { /* invalid selector, detached element, timeout -> treated as a miss */ }
            this.cache.set(ck, entry);
        }
        let pass = false;
        if (entry.info) { try { pass = Boolean(intent.predicate(entry.info)); } catch { pass = false; } }
        return { pass, info: entry.info };
    }

    scoreOf(intent, cand, info, topSim) {
        const simComp = Math.min(1, Math.max(0, cand.sim) / Math.max(topSim, 0.3));
        const tight   = intent.many ? 1 : 1 / (1 + 0.2 * Math.max(0, info.visibleCount - 1));
        return 0.5 + 0.5 * (0.5 * simComp + 0.25 * tight + 0.25 * selectorKind(cand.selector));
    }

    /** Candidates that pass live validation on one viewport, best first. */
    async passersFor(intent, viewport, qvec) {
        const hits = this.store.search(qvec, {
            k: 40,
            filter: d => d.meta.page === intent.page && d.meta.viewport === viewport,
        });
        const topSim = hits[0]?.score ?? 0;
        const passers = [];
        for (const cand of flattenHits(hits).slice(0, MAX_CANDIDATES)) {
            const { pass, info } = await this.inspect(intent, viewport, cand.selector);
            if (!pass) continue;
            passers.push({ ...cand, info, score: this.scoreOf(intent, cand, info, topSim) });
            if (passers.length >= MAX_PASSERS) break;
        }
        return passers.sort((a, b) => b.score - a.score || a.selector.length - b.selector.length);
    }

    /**
     * Resolve one intent key.
     * @returns {Promise<object>} { key, selector|null, confidence, source, ... }
     */
    async resolveKey(key) {
        const intent = INTENTS[key];
        if (!intent) throw new Error(`[resolver] Unknown intent "${key}". Known: ${Object.keys(INTENTS).join(', ')}`);

        const [qvec] = await this.embedder.embed([queryText(intent)], 'query');
        const vps = intent.viewports;
        const per = {};
        for (const vp of vps) per[vp] = await this.passersFor(intent, vp, qvec);

        const withPassers = vps.filter(v => per[v].length);
        if (!withPassers.length) return { key, selector: null, reason: 'no candidate passed live validation' };
        const missing = vps.filter(v => !per[v].length);

        // Optional Claude pick among the primary viewport's survivors.
        let list = per[withPassers[0]].slice(0, 5);
        let llmPick = null;
        if (this.useLLM && list.length >= 2) {
            const choice = await llm.chooseCandidate(key, intent, list);
            if (choice) {
                llmPick = list[choice.index].selector;
                list = [list[choice.index], ...list.filter((_, i) => i !== choice.index)];
            }
        }

        // 1) A single selector that holds on every viewport.
        let best = null;
        for (const cand of list) {
            const scores = [cand.score];
            let ok = true;
            for (const vp of vps) {
                if (vp === withPassers[0]) continue;
                const hit = per[vp].find(p => p.selector === cand.selector);
                if (hit) { scores.push(hit.score); continue; }
                const { pass, info } = await this.inspect(intent, vp, cand.selector);
                if (!pass) { ok = false; break; }
                scores.push(this.scoreOf(intent, cand, info, cand.sim));
            }
            if (ok) { best = { ...cand, score: avg(scores) }; break; }
        }

        let selector, score, source = 'rag', matchCount;
        if (best && !missing.length) {
            selector = best.selector; score = best.score; matchCount = best.info.visibleCount || best.info.count;
            if (llmPick && best.selector === llmPick) source = 'rag+llm';
        } else if (best) {                                 // valid where it was found; other viewport has nothing
            selector = best.selector; score = best.score * 0.8; matchCount = best.info.visibleCount || best.info.count;
        } else {                                           // 2) union of per-viewport winners
            const winners = withPassers.map(vp => per[vp][0]);
            selector = [...new Set(winners.map(w => w.selector))].join(', ');
            score = Math.min(...winners.map(w => w.score)) * 0.9;
            matchCount = winners[0].info.visibleCount || winners[0].info.count;
            source = 'rag-union';
        }

        const confidence = Math.min(0.99, +score.toFixed(3));
        const result = {
            key, selector, confidence, source, matchCount,
            viewports: vps,
            missingViewports: missing,
            needsReview: confidence < REVIEW_THRESHOLD || missing.length > 0,
            alternatives: per[withPassers[0]].filter(p => p.selector !== selector).slice(0, 4)
                .map(p => ({ selector: p.selector, score: +p.score.toFixed(3) })),
        };
        Object.defineProperty(result, '_passers', { value: per[withPassers[0]], enumerable: false });

        if (intent.optional && confidence < OPTIONAL_MIN_CONFIDENCE) {
            return { key, selector: null, reason: `optional element; best candidate confidence ${confidence} < ${OPTIONAL_MIN_CONFIDENCE}` };
        }
        return result;
    }

    /** Behavioural proof: clicking `hamburger` must reveal `menu` on a fresh mobile page. */
    async menuToggleWorks(hamburger, menu) {
        let page;
        try {
            page = await this.pool.fresh('home', 'mobile');
            const visibleBefore = await page.locator(menu).filter({ visible: true }).count();
            await page.locator(hamburger).filter({ visible: true }).first().click({ timeout: 4000 });
            await page.waitForTimeout(900);
            const visibleAfter = await page.locator(menu).filter({ visible: true }).count();
            return visibleAfter > 0 && (visibleBefore === 0 || visibleAfter >= visibleBefore);
        } catch {
            return false;
        } finally {
            await page?.close();
        }
    }

    async verifyMenuPair(results) {
        const ham = results.find(r => r.key === 'hamburger' && r.selector);
        const menu = results.find(r => r.key === 'mobileMenu' && r.selector);
        if (!ham || !menu) return;

        const hams  = [ham.selector,  ...(ham._passers  || []).map(p => p.selector).filter(s => s !== ham.selector)].slice(0, 3);
        const menus = [menu.selector, ...(menu._passers || []).map(p => p.selector).filter(s => s !== menu.selector)].slice(0, 3);

        for (const h of hams) {
            for (const m of menus) {
                if (!(await this.menuToggleWorks(h, m))) continue;
                const changed = h !== ham.selector || m !== menu.selector;
                ham.selector = h; menu.selector = m;
                ham.verified = menu.verified = 'menu-toggle';
                ham.confidence  = Math.min(0.99, +(ham.confidence + (changed ? 0.02 : 0.08)).toFixed(3));
                menu.confidence = Math.min(0.99, +(menu.confidence + (changed ? 0.02 : 0.08)).toFixed(3));
                ham.needsReview  = ham.confidence  < REVIEW_THRESHOLD;
                menu.needsReview = menu.confidence < REVIEW_THRESHOLD;
                this.log(`  menu-toggle verified: click ${h}  ->  reveals ${m}`);
                return;
            }
        }
        for (const r of [ham, menu]) {
            r.verified = 'menu-toggle-failed';
            r.confidence = +(r.confidence * 0.85).toFixed(3);
            r.needsReview = true;
        }
        this.log('  ! no hamburger/mobileMenu pair passed the click test -- both flagged for review');
    }

    /** Resolve many keys. Returns results in key order (unresolved ones carry selector:null). */
    async resolveAll(keys = Object.keys(INTENTS)) {
        const results = [];
        for (const key of keys) {
            const r = await this.resolveKey(key);
            results.push(r);
            this.log(r.selector
                ? `  ${key.padEnd(15)} ${String(r.confidence).padEnd(5)} ${r.source.padEnd(9)} ${r.selector}`
                : `  ${key.padEnd(15)} --    (none)    ${r.reason}`);
        }
        if (keys.includes('hamburger') && keys.includes('mobileMenu')) await this.verifyMenuPair(results);
        return results;
    }

    /** Does an existing selector still satisfy its intent on every viewport? (used by heal) */
    async stillValid(key, selector) {
        const intent = INTENTS[key];
        if (!intent) return true;
        for (const vp of intent.viewports) {
            if (!(await this.inspect(intent, vp, selector)).pass) return false;
        }
        return true;
    }
}

module.exports = { Resolver, INTENTS };
