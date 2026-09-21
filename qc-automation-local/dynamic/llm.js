/**
 * dynamic/llm.js -- Optional Claude re-ranking (the "generation" half of RAG)
 *
 * The resolver has already retrieved candidates and proved on the live page
 * that they satisfy the intent's structural predicate. When several
 * survive, Claude picks the one a human tester would mean (e.g. the real
 * "Add to cart" button rather than a sticky-bar duplicate).
 *
 * Enabled with `--llm` or RESOLVER_LLM=true, and only when CLAUDE_API_KEY is
 * set. Claude never invents a selector: it can only choose one of the
 * candidates it was shown, and any answer outside that list is discarded.
 * Advisory only -- per CLAUDE.md, low-confidence results still get flagged
 * for QA review.
 */

'use strict';

const API_URL = 'https://api.anthropic.com/v1/messages';

function enabled(flag) {
    const key = process.env.CLAUDE_API_KEY;
    const on  = flag || process.env.RESOLVER_LLM === 'true';
    return Boolean(on && key && key !== 'your_claude_api_key_here');
}

/**
 * @param {string} key      intent key, e.g. 'hamburger'
 * @param {object} intent
 * @param {Array<{selector:string, info:object}>} candidates - already validated
 * @returns {Promise<{index:number, reason:string}|null>} null = no opinion
 */
async function chooseCandidate(key, intent, candidates) {
    const list = candidates.map((c, i) => {
        const f = c.info;
        return `${i}. selector: ${c.selector}\n   <${f.tag}> class/id="${f.classId.trim()}" aria-label="${f.ariaLabel}" ` +
               `text="${f.text.slice(0, 60)}" matches=${f.visibleCount} size=${f.width}x${f.height} top=${f.top}`;
    }).join('\n');

    const prompt =
        `You are helping a QA automation suite locate a UI element on an ecommerce storefront.\n` +
        `Element wanted (${key}): ${intent.description}\n` +
        `Every candidate below already matched a structural check on the live page. ` +
        `Choose the one a human tester would mean, preferring stable semantic selectors and ` +
        `avoiding duplicates such as sticky-bar or hidden copies.\n\n${list}\n\n` +
        `Reply with JSON only: {"choice": <candidate number or null>, "reason": "<short>"}`;

    try {
        const res = await fetch(API_URL, {
            method:  'POST',
            headers: {
                'content-type':      'application/json',
                'x-api-key':         process.env.CLAUDE_API_KEY,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model:      process.env.RESOLVER_MODEL || 'claude-haiku-4-5-20251001',
                max_tokens: 200,
                messages:   [{ role: 'user', content: prompt }],
            }),
            signal: AbortSignal.timeout(30_000),
        });
        if (!res.ok) return null;
        const json = await res.json();
        const text = json.content?.[0]?.text || '';
        const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || 'null');
        if (!parsed || !Number.isInteger(parsed.choice) || parsed.choice < 0 || parsed.choice >= candidates.length) return null;
        return { index: parsed.choice, reason: String(parsed.reason || '').slice(0, 200) };
    } catch {
        return null;
    }
}

module.exports = { enabled, chooseCandidate };
