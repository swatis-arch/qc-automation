/**
 * utils/ga4.js — record GA4 events a page sends
 *
 * GA4 batches events into /g/collect hits: one event in the query string, or
 * several newline-separated records in the POST body. Each record's `en` is the
 * event name; item data rides in `pr1`, `pr2`, ... (`id...~nm...~pr...`).
 */

const GA4_HOST = /^(www\.|region1\.)?google-analytics\.com$|^analytics\.google\.com$/;

/**
 * Start recording GA4 events. Call before the navigation/action that should fire them.
 * @param {import('@playwright/test').Page} page
 * @returns {{ events: (name: string) => URLSearchParams[] }}
 */
function recordGa4Events(page) {
    const records = [];
    page.on('request', request => {
        let requestUrl;
        try { requestUrl = new URL(request.url()); } catch { return; }
        if (!GA4_HOST.test(requestUrl.hostname) || !/\/g\/collect$/.test(requestUrl.pathname)) return;
        // The query string carries shared params; a body record carries per-event ones on top.
        const shared = requestUrl.search.replace(/^\?/, '');
        const body = (request.postData() ?? '').split('\n').filter(Boolean);
        for (const record of body.length ? body : ['']) {
            const params = new URLSearchParams(shared);
            for (const [key, value] of new URLSearchParams(record)) params.set(key, value);
            records.push(params);
        }
    });
    return {
        events: name => records.filter(params => params.get('en') === name),
    };
}

module.exports = { recordGa4Events };
