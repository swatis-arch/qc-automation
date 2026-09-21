/**
 * dynamic/embedder.js -- Text -> vector
 *
 * Providers (EMBEDDINGS_PROVIDER):
 *   local  (default)  Deterministic feature-hashing embedder. No network, no
 *                     API key, no cost -- so `npm run dynamic:*` works out of
 *                     the box and in CI. Word + bigram + character-trigram
 *                     features hashed into 384 dims; good enough for
 *                     retrieval because the live-page validation in
 *                     resolver.js supplies the precision.
 *   voyage            Voyage AI dense embeddings (VOYAGE_API_KEY). Better
 *                     semantic recall on unusual class naming
 *                     ("burger" ~ "menu-toggle"). Model: VOYAGE_MODEL
 *                     (default voyage-3.5).
 *
 * The store records which embedder built it; querying with a different one
 * is refused (vectors from different models are not comparable).
 */

'use strict';

const LOCAL_DIM = 384;

function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

/** Lower-case word tokens; splits camelCase, kebab, snake and BEM separators. */
function tokenize(text) {
    return String(text)
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(t => t.length > 1 || /\d/.test(t));
}

function embedLocal(text) {
    const vec = new Float32Array(LOCAL_DIM);
    const add = (feature, weight) => {
        const idx  = fnv1a(feature) % LOCAL_DIM;
        const sign = (fnv1a('s' + feature) & 1) ? 1 : -1;
        vec[idx] += sign * weight;
    };

    const tokens = tokenize(text);
    const tf = new Map();
    for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);

    for (const [t, count] of tf) {
        const w = 1 + Math.log(count);
        add('w:' + t, w);
        if (t.length >= 4) {                       // char trigrams: "burger" ~ "hamburger"
            const padded = `#${t}#`;
            for (let i = 0; i + 3 <= padded.length; i++) add('c:' + padded.slice(i, i + 3), 0.25 * w);
        }
    }
    for (let i = 0; i + 1 < tokens.length; i++) add(`b:${tokens[i]}_${tokens[i + 1]}`, 0.5);

    let norm = 0;
    for (let i = 0; i < LOCAL_DIM; i++) norm += vec[i] * vec[i];
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < LOCAL_DIM; i++) vec[i] /= norm;
    return vec;
}

class LocalEmbedder {
    constructor() { this.name = 'local-hash'; this.dim = LOCAL_DIM; }
    async embed(texts) { return texts.map(embedLocal); }
}

class VoyageEmbedder {
    constructor() {
        this.key   = process.env.VOYAGE_API_KEY;
        this.model = process.env.VOYAGE_MODEL || 'voyage-3.5';
        this.name  = `voyage:${this.model}`;
        this.dim   = 1024;
        if (!this.key) throw new Error('[embedder] EMBEDDINGS_PROVIDER=voyage requires VOYAGE_API_KEY.');
    }

    async embed(texts, kind = 'document') {
        const out = [];
        for (let i = 0; i < texts.length; i += 64) {
            const res = await fetch('https://api.voyageai.com/v1/embeddings', {
                method:  'POST',
                headers: { 'content-type': 'application/json', authorization: `Bearer ${this.key}` },
                body:    JSON.stringify({ input: texts.slice(i, i + 64), model: this.model, input_type: kind }),
            });
            if (!res.ok) throw new Error(`[embedder] Voyage API ${res.status}: ${await res.text()}`);
            const json = await res.json();
            for (const row of json.data) out.push(Float32Array.from(row.embedding));
        }
        return out;
    }
}

function createEmbedder(provider = process.env.EMBEDDINGS_PROVIDER || 'local') {
    if (provider === 'local')  return new LocalEmbedder();
    if (provider === 'voyage') return new VoyageEmbedder();
    throw new Error(`[embedder] Unknown EMBEDDINGS_PROVIDER "${provider}" (expected local | voyage).`);
}

module.exports = { createEmbedder, tokenize };
