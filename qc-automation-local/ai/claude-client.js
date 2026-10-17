/**
 * ai/claude-client.js — one Claude call for the console and the failure analysis.
 *
 * Provider, in order:
 *   1. Anthropic API  — CLAUDE_API_KEY (sk-ant-...), model CLAUDE_MODEL
 *   2. OpenRouter     — OPENROUTER_API_KEY (sk-or-...), model OPENROUTER_MODEL
 * With neither, provider() returns null and callers fall back (Gemini / keyword parser / mock RCA).
 */

require('dotenv').config();

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const CLAUDE_MODEL   = process.env.CLAUDE_MODEL || 'claude-sonnet-5-5';
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL   = process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-5.5';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

const isSet = (k, placeholder) => Boolean(k) && !placeholder.test(k);

/** 'anthropic', 'openrouter', or null. */
function provider() {
    if (isSet(CLAUDE_API_KEY, /your_claude_api_key/i)) return 'anthropic';
    if (isSet(OPENROUTER_API_KEY, /your_openrouter_api_key/i)) return 'openrouter';
    return null;
}

/** POST with two retries on rate limits / brief overloads (429, 500, 502, 503, 529). */
async function postWithRetry(url, headers, body) {
    const send = () => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
    const retryable = s => [429, 500, 502, 503, 529].includes(s);
    let res = await send();
    for (let attempt = 1; attempt <= 2 && retryable(res.status); attempt++) {
        await new Promise(r => setTimeout(r, attempt * 2000));
        res = await send();
    }
    return { res, busy: retryable(res.status) };
}

/**
 * @param {Object}  opts
 * @param {string}  opts.system
 * @param {string}  opts.userText
 * @param {Object} [opts.schema]     JSON schema for the reply (structured output)
 * @param {number} [opts.maxTokens]
 * @param {{label: string, base64: string, mediaType?: string}[]} [opts.images]  screenshots, each after its label
 * @returns {Promise<string>} the reply text
 */
async function callClaude({ system, userText, schema, maxTokens = 4000, images = [] }) {
    const p = provider();
    if (!p) throw new Error('No Claude key configured (CLAUDE_API_KEY or OPENROUTER_API_KEY).');
    const keyName = p === 'anthropic' ? 'CLAUDE_API_KEY' : 'OPENROUTER_API_KEY';

    // With images, the message is a list of parts: the text, then each label followed by its image.
    const parts = images.flatMap(img => {
        const type = img.mediaType || 'image/png';
        return [
            { type: 'text', text: img.label },
            p === 'anthropic'
                ? { type: 'image', source: { type: 'base64', media_type: type, data: img.base64 } }
                : { type: 'image_url', image_url: { url: `data:${type};base64,${img.base64}` } },
        ];
    });
    const content = parts.length ? [{ type: 'text', text: userText }, ...parts] : userText;

    let res, busy;
    if (p === 'anthropic') {
        const body = { model: CLAUDE_MODEL, max_tokens: maxTokens, system, messages: [{ role: 'user', content }] };
        if (schema) body.output_config = { format: { type: 'json_schema', schema } };
        ({ res, busy } = await postWithRetry(CLAUDE_API_URL, { 'x-api-key': CLAUDE_API_KEY, 'anthropic-version': '2023-06-01' }, body));
    } else {
        const body = {
            model:      OPENROUTER_MODEL,
            max_tokens: maxTokens,
            messages:   [{ role: 'system', content: system }, { role: 'user', content }],
        };
        if (schema) body.response_format = { type: 'json_schema', json_schema: { name: 'reply', strict: true, schema } };
        ({ res, busy } = await postWithRetry(OPENROUTER_API_URL, {
            Authorization:  `Bearer ${OPENROUTER_API_KEY}`,
            'X-Title':      'Suntek QC',
        }, body));
    }

    if (res.status === 401) throw new Error(`${p === 'anthropic' ? 'Claude' : 'OpenRouter'} rejected ${keyName} (401). Check the key in .env and restart.`);
    if (res.status === 402) throw new Error('OpenRouter account is out of credits (402). Add credits at openrouter.ai/settings/credits.');
    if (p === 'openrouter' && res.status === 403) {
        const msg = (await res.text()).slice(0, 300);
        if (/limit/i.test(msg)) throw new Error('OpenRouter key has hit its spending limit (403). Raise the key\'s limit at openrouter.ai/settings/keys.');
        throw new Error(`OpenRouter API error 403: ${msg}`);
    }
    if (busy) throw new Error(`Claude is busy right now (${res.status}). Try again in a minute.`);
    if (!res.ok) throw new Error(`${p === 'anthropic' ? 'Claude' : 'OpenRouter'} API error ${res.status}: ${(await res.text()).slice(0, 300)}`);

    const data = await res.json();
    if (p === 'anthropic') {
        if (data.stop_reason === 'refusal') throw new Error('Claude declined this request.');
        // Thinking may be on by default, so take the text block rather than content[0].
        return (data.content || []).find(b => b.type === 'text')?.text || '';
    }
    if (data.error) throw new Error(`OpenRouter error: ${data.error.message || JSON.stringify(data.error)}`);
    const choice = (data.choices || [])[0] || {};
    if (choice.finish_reason === 'refusal') throw new Error('Claude declined this request.');
    return choice.message?.content || '';
}

module.exports = { callClaude, provider, models: { CLAUDE_MODEL, OPENROUTER_MODEL } };
