/**
 * console/jira.js — read Jira tickets and post run results back (Jira Cloud REST v3).
 *
 * .env:
 *   JIRA_BASE_URL     https://aisuntek.atlassian.net
 *   JIRA_EMAIL        the Atlassian account the token belongs to
 *   JIRA_API_TOKEN    https://id.atlassian.com/manage-profile/security/api-tokens
 *   JIRA_PROJECT_MAP  optional, project key → merchant slug (default "KOH=koh")
 *
 * Reading happens when someone types a ticket key or link. Writing (a comment with the
 * run result) only happens when someone clicks "Post result to Jira" on a run.
 */

require('dotenv').config();

const BASE  = (process.env.JIRA_BASE_URL || '').replace(/\/$/, '');
const EMAIL = process.env.JIRA_EMAIL || '';
const TOKEN = process.env.JIRA_API_TOKEN || '';

const PROJECT_MAP = Object.fromEntries((process.env.JIRA_PROJECT_MAP || 'KOH=koh')
    .split(',').map(s => s.trim().split('=')).filter(p => p.length === 2)
    .map(([k, v]) => [k.trim().toUpperCase(), v.trim().toLowerCase()]));

const KEY_RE = /\b([A-Z][A-Z0-9]+-\d+)\b/;

const configured = () => Boolean(BASE && EMAIL && TOKEN);

/** Ticket key from a link (…/browse/KOH-68) or a bare key ("test KOH-68 on koh"). */
function findTicketKey(text) {
    const link = text.match(/atlassian\.net\/browse\/([A-Z][A-Z0-9]+-\d+)/i);
    if (link) return link[1].toUpperCase();
    const bare = text.match(KEY_RE);
    return bare && PROJECT_MAP[bare[1].split('-')[0]] ? bare[1] : null;
}

const merchantForKey = key => PROJECT_MAP[key.split('-')[0]] || null;
const browseUrl = key => `${BASE}/browse/${key}`;

async function api(path, options = {}) {
    if (!configured()) throw new Error('Jira is not configured (JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN in .env).');
    const res = await fetch(`${BASE}/rest/api/3${path}`, {
        ...options,
        headers: {
            Authorization: 'Basic ' + Buffer.from(`${EMAIL}:${TOKEN}`).toString('base64'),
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
    });
    if (res.status === 404) throw new Error('Ticket not found, or this Jira account cannot see it.');
    if (res.status === 401 || res.status === 403) throw new Error(`Jira refused the request (${res.status}): check JIRA_EMAIL / JIRA_API_TOKEN and project access.`);
    if (!res.ok) throw new Error(`Jira error ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return res.status === 204 ? null : res.json();
}

/** Atlassian Document Format → plain text (enough for descriptions and acceptance criteria). */
function adfToText(node, depth = 0) {
    if (!node) return '';
    if (typeof node === 'string') return node;
    const kids = (node.content || []).map(c => adfToText(c, depth + 1)).join('');
    switch (node.type) {
        case 'text':        return node.text || '';
        case 'hardBreak':   return '\n';
        case 'paragraph':
        case 'heading':     return kids + '\n';
        case 'listItem':    return '- ' + kids.trim() + '\n';
        case 'bulletList':
        case 'orderedList': return kids;
        case 'codeBlock':   return '\n' + kids + '\n';
        case 'mention':     return '@' + ((node.attrs && node.attrs.text) || 'user');
        case 'inlineCard':  return (node.attrs && node.attrs.url) || '';
        case 'tableCell':
        case 'tableHeader': return kids.trim() + ' | ';
        case 'tableRow':    return kids + '\n';
        default:            return kids;
    }
}

/**
 * @returns {Promise<{key, url, summary, type, status, priority, labels, description, merchant}>}
 */
async function getIssue(key) {
    const fields = 'summary,description,status,issuetype,priority,labels';
    const data = await api(`/issue/${encodeURIComponent(key)}?fields=${fields}`);
    const f = data.fields || {};
    return {
        key,
        url:         browseUrl(key),
        summary:     f.summary || '',
        type:        f.issuetype && f.issuetype.name,
        status:      f.status && f.status.name,
        priority:    f.priority && f.priority.name,
        labels:      f.labels || [],
        description: adfToText(f.description).replace(/\n{3,}/g, '\n\n').trim().slice(0, 6000),
        merchant:    merchantForKey(key),
    };
}

/** Post a plain-text comment (paragraph per line). */
async function addComment(key, text) {
    const body = {
        type: 'doc', version: 1,
        content: text.split('\n').map(line => (line.trim()
            ? { type: 'paragraph', content: [{ type: 'text', text: line }] }
            : { type: 'paragraph', content: [] })),
    };
    return api(`/issue/${encodeURIComponent(key)}/comment`, { method: 'POST', body: JSON.stringify({ body }) });
}

module.exports = { configured, findTicketKey, merchantForKey, browseUrl, getIssue, addComment, PROJECT_MAP };
