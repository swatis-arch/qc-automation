/**
 * console/stores.js — storefronts the console has already run on that the suite isn't set up for.
 *
 * Read from earlier runs (reports/console/runs.json), so nothing is configured: once one RYD ticket
 * has run on https://rydertoys.com, later RYD tickets without a link use it, and "test rydertoys"
 * finds it by name. JIRA_PROJECT_MAP in .env still wins (console/ai.js).
 */

const fs   = require('fs');
const path = require('path');

const RUNS_FILE = path.join(__dirname, '..', 'reports', 'console', 'runs.json');

/** Ad-hoc runs, newest first: [{ origin, project }] (project null for runs without a ticket). */
function adhocRuns() {
    let runs;
    try { runs = JSON.parse(fs.readFileSync(RUNS_FILE, 'utf8')); } catch { return []; }
    return (Array.isArray(runs) ? runs : [])
        .filter(r => r && r.plan && r.plan.merchant === 'adhoc' && r.plan.storeUrl)
        .sort((a, b) => String(b.created || '').localeCompare(String(a.created || '')))
        .map(r => ({ origin: r.plan.storeUrl, project: r.ticket && r.ticket.key ? r.ticket.key.split('-')[0] : null }));
}

/** Every store run on so far. */
const known = () => [...new Set(adhocRuns().map(r => r.origin))];

/** The store a project's latest ticket run used, or null. */
function forProject(project) {
    const hit = adhocRuns().find(r => r.project === project);
    return hit ? hit.origin : null;
}

module.exports = { known, forProject };
