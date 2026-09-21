/**
 * dynamic/scraper.js -- Scrape a merchant site into the vector store
 *
 * For each (page type x viewport) it runs the in-page extractor, turns every
 * element record into a searchable text document, embeds it, and replaces
 * the merchant's index in the vector store.
 *
 *   pool -> extractCandidates() -> docs -> embedder -> VectorStore
 */

'use strict';

const { extractCandidates } = require('./dom-extractor');
const { createEmbedder }    = require('./embedder');
const VectorStore           = require('./vector-store');

const SCRAPE_PAGES     = ['home', 'collection', 'product'];
const SCRAPE_VIEWPORTS = ['desktop', 'mobile'];

const TAG_WORDS = {
    a: 'link anchor', button: 'button', input: 'input field', form: 'form', img: 'image', svg: 'icon',
    h1: 'heading title', h2: 'heading', h3: 'heading', header: 'header banner', nav: 'navigation menu',
    section: 'section', summary: 'button toggle', footer: 'footer', aside: 'sidebar', dialog: 'dialog popup',
    main: 'main content', video: 'video', label: 'label', select: 'select dropdown', textarea: 'text area',
};

/** The text that gets embedded. Field order/repetition weights what matters. */
function embeddingText(rec, pageType, viewport) {
    const parts = [
        TAG_WORDS[rec.tag] || rec.tag,
        rec.role && `role ${rec.role}`,
        `region ${rec.region}`,
        `page ${pageType}`,
        rec.classes.length && `class ${rec.classes.join(' ')} ${rec.classes.join(' ')}`,
        rec.id && `id ${rec.id} ${rec.id}`,
        rec.ariaLabel && `label ${rec.ariaLabel} ${rec.ariaLabel}`,
        rec.name && `name ${rec.name}`,
        rec.type && `type ${rec.type}`,
        rec.placeholder && `placeholder ${rec.placeholder}`,
        rec.alt && `alt ${rec.alt}`,
        rec.text && `text ${rec.text}`,
        rec.href && `href ${rec.href}`,
        rec.action && `action ${rec.action}`,
        rec.parents.length && `inside ${rec.parents.join(' ')}`,
        rec.repeat > 3 && 'repeated many times list grid item',
        rec.hasProductLink && 'product link',
        !rec.visible && 'hidden until opened',
    ];
    return parts.filter(Boolean).join(' . ');
}

/**
 * Scrape and index. Returns the raw records per page too (onboard uses the
 * header links to derive navLinks).
 *
 * @param {import('./pages').PagePool} pool
 * @param {object} merchant
 * @param {{log?:Function, embedder?:object}} [opts]
 */
async function scrapeMerchant(pool, merchant, { log = console.log, embedder = createEmbedder() } = {}) {
    const docs = [];
    const snapshots = {};

    for (const pageType of SCRAPE_PAGES) {
        for (const viewport of SCRAPE_VIEWPORTS) {
            let page;
            try {
                page = await pool.get(pageType, viewport);
            } catch (err) {
                log(`  ! ${pageType}/${viewport}: could not load (${err.message.split('\n')[0]})`);
                continue;
            }
            const snap = await page.evaluate(extractCandidates, { max: 1200 });
            snapshots[`${pageType}|${viewport}`] = snap;
            snap.records.forEach((rec, n) => docs.push({
                id:        `${pageType}:${viewport}:${n}`,
                text:      embeddingText(rec, pageType, viewport),
                meta:      { page: pageType, viewport },
                data:      rec,
                selectors: rec.selectors,
            }));
            log(`  scraped ${pageType.padEnd(10)} ${viewport.padEnd(8)} ${String(snap.records.length).padStart(4)} elements`);
        }
    }

    if (!docs.length) throw new Error('[scraper] Nothing scraped -- is the site reachable?');

    const vectors = await embedder.embed(docs.map(d => d.text), 'document');
    docs.forEach((d, i) => { d.vector = vectors[i]; });

    const store = new VectorStore(merchant.slug);
    store.replace(embedder, docs);
    store.save();
    log(`  indexed ${docs.length} elements -> dynamic/store/${merchant.slug}.json (${embedder.name})`);

    return { store, snapshots };
}

module.exports = { scrapeMerchant, SCRAPE_PAGES, SCRAPE_VIEWPORTS };
