/**
 * dynamic/vector-store.js -- Per-merchant vector store
 *
 * A dependency-free vector DB: one JSON file per merchant under
 * dynamic/store/<slug>.json (git-ignored -- it is a build artifact that can
 * be regenerated with `npm run dynamic:scrape`). Vectors are stored as
 * base64 Float32 so a few thousand elements stay a few MB.
 *
 * Search is brute-force cosine similarity (vectors are L2-normalised, so it
 * is a dot product). A merchant site yields at most a few thousand
 * elements, where brute force is faster than any index would be.
 *
 * The class is the only thing that touches the file format; swapping in
 * Chroma / pgvector / Pinecone later means re-implementing these five
 * methods (load, save, replace, search, size) and nothing else.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const STORE_DIR = path.join(__dirname, 'store');

const encode = vec => Buffer.from(new Uint8Array(Float32Array.from(vec).buffer)).toString('base64');

function decode(b64) {
    const buf = Buffer.from(b64, 'base64');
    const ab  = new ArrayBuffer(buf.length);
    new Uint8Array(ab).set(buf);
    return new Float32Array(ab);
}

class VectorStore {

    /** @param {string} slug */
    constructor(slug) {
        this.slug = slug;
        this.file = path.join(STORE_DIR, `${slug}.json`);
        this.embedder = null;          // { name, dim } of the embedder that built the vectors
        this.builtAt  = null;
        this.docs     = [];            // [{ id, text, meta, data, selectors, vector: Float32Array }]
    }

    static exists(slug) {
        return fs.existsSync(path.join(STORE_DIR, `${slug}.json`));
    }

    load() {
        if (!fs.existsSync(this.file)) {
            throw new Error(`[vector-store] No index for "${this.slug}". Run: npm run dynamic:scrape -- ${this.slug}`);
        }
        const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
        this.embedder = raw.embedder;
        this.builtAt  = raw.builtAt;
        this.docs     = raw.docs.map(d => ({ ...d, vector: decode(d.vector) }));
        return this;
    }

    save() {
        fs.mkdirSync(STORE_DIR, { recursive: true });
        const raw = {
            version:  1,
            merchant: this.slug,
            embedder: this.embedder,
            builtAt:  this.builtAt,
            docs:     this.docs.map(d => ({ ...d, vector: encode(d.vector) })),
        };
        fs.writeFileSync(this.file, JSON.stringify(raw));
    }

    /**
     * Replace the whole index (a re-scrape supersedes the previous one).
     * @param {{name:string, dim:number}} embedder
     * @param {Array} docs - each with a `vector` Float32Array
     */
    replace(embedder, docs) {
        this.embedder = { name: embedder.name, dim: embedder.dim };
        this.builtAt  = new Date().toISOString();
        this.docs     = docs;
    }

    get size() { return this.docs.length; }

    /**
     * Top-k documents by cosine similarity.
     * @param {Float32Array} query
     * @param {{k?:number, filter?:(doc:object)=>boolean}} [opts]
     * @returns {Array<{doc:object, score:number}>}
     */
    search(query, { k = 40, filter = null } = {}) {
        const scored = [];
        for (const doc of this.docs) {
            if (filter && !filter(doc)) continue;
            let dot = 0;
            const v = doc.vector;
            for (let i = 0; i < v.length; i++) dot += v[i] * query[i];
            scored.push({ doc, score: dot });
        }
        scored.sort((a, b) => b.score - a.score);
        return scored.slice(0, k);
    }
}

module.exports = VectorStore;
