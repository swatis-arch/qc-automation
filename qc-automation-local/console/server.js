/**
 * console/server.js — QC Console: a web page where the team types commands
 * ("run smoke on koh mobile", "why did the cart tests fail?") and this machine
 * runs the suite and keeps every run's results.
 *
 *   npm run console          → http://localhost:4000
 *   npm run console:share    → public https URL through a Cloudflare quick tunnel
 *
 * Access is gated by QC_CONSOLE_KEY (.env). If it is unset a random key is
 * generated and printed at start-up. Runs execute one at a time (workers: 1 and
 * a shared reports/ folder), through scripts/run-suite.js.
 *
 * Data kept per run in reports/console/runs/<id>/: log.txt, results.json, html/ (Playwright report).
 * Every typed command is appended to reports/console/commands.jsonl.
 */

require('dotenv').config();

const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const { spawn, spawnSync } = require('child_process');

const ai = require('./ai');
const { buildPdf } = require('./pdf-report');
const jira = require('./jira');

const ROOT     = path.resolve(__dirname, '..');
const DATA_DIR = process.env.QC_CONSOLE_DATA_DIR || path.join(ROOT, 'reports', 'console');   // override for tests
const RUNS_DIR = path.join(DATA_DIR, 'runs');
const INDEX    = path.join(DATA_DIR, 'runs.json');
const CMD_LOG  = path.join(DATA_DIR, 'commands.jsonl');
const PUBLIC   = path.join(__dirname, 'public');

const PORT = Number(process.env.QC_CONSOLE_PORT || 4000);
const HOST = process.env.QC_CONSOLE_HOST || '127.0.0.1';   // the tunnel connects locally
const KEY  = process.env.QC_CONSOLE_KEY || crypto.randomBytes(9).toString('base64url');
// Public address of the console, used for the "Open report" link in Slack.
const PUBLIC_URL = (process.env.QC_CONSOLE_PUBLIC_URL || '').replace(/\/$/, '');
const SLACK_ON   = process.env.QC_CONSOLE_SLACK !== 'false';
// Shared secret for the Jira Automation webhook (header X-QC-Webhook-Secret). Unset = webhook disabled.
const WEBHOOK_SECRET = process.env.QC_JIRA_WEBHOOK_SECRET || '';

fs.mkdirSync(RUNS_DIR, { recursive: true });

// ── Run store ─────────────────────────────────────────────────────────────────

/** @type {object[]} newest first */
let runs = fs.existsSync(INDEX) ? JSON.parse(fs.readFileSync(INDEX, 'utf8')) : [];
for (const r of runs) {
    if (r.status === 'running' || r.status === 'queued') r.status = 'interrupted';   // server restarted mid-run
}
const saveIndex = () => fs.writeFileSync(INDEX, JSON.stringify(runs, null, 2));
saveIndex();

const queue     = [];           // run ids waiting
let   current   = null;         // { run, child }
const listeners = new Map();    // run id → Set<res> (SSE)

const publicRun = r => r && ({ ...r, log: undefined });

function createRun(plan, user, command, ticket = null) {
    const id  = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14) + '-' + crypto.randomBytes(2).toString('hex');
    const run = {
        id, plan, user, command, ticket,
        label:    ai.describePlan(plan),
        status:   'queued',
        created:  new Date().toISOString(),
        started:  null, finished: null, exitCode: null,
        summary:  null, failures: [],
    };
    runs.unshift(run);
    saveIndex();
    queue.push(id);
    pump();
    return run;
}

function emit(runId, event, data) {
    for (const res of listeners.get(runId) || []) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function pump() {
    if (current || !queue.length) return;
    const run = runs.find(r => r.id === queue.shift());
    if (!run) return pump();

    const dir  = path.join(RUNS_DIR, run.id);
    fs.mkdirSync(dir, { recursive: true });
    const log  = fs.createWriteStream(path.join(dir, 'log.txt'));
    const args = ['scripts/run-suite.js', run.plan.target, run.plan.viewport];
    if (run.plan.grep) args.push('--grep', run.plan.grep);

    const env = {
        ...process.env,
        MERCHANT:     run.plan.merchant === 'all' ? '' : run.plan.merchant,
        TRIGGERED_BY: `${run.user} via QC Console`,
        FORCE_COLOR:  '0',
        CI:           '',
    };
    archiveOldEvidence(run.id);
    const child = spawn(process.execPath, args, { cwd: ROOT, env, detached: process.platform !== 'win32' });
    current = { run, child };

    run.status  = 'running';
    run.started = new Date().toISOString();
    saveIndex();
    emit(run.id, 'status', publicRun(run));

    const onData = buf => {
        const text = buf.toString().replace(/\x1b\[[0-9;]*m/g, '');
        log.write(text);
        emit(run.id, 'log', text);
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('close', async code => {
        run.exitCode = code;
        run.finished = new Date().toISOString();
        if (run.status !== 'cancelled') run.status = code === 0 ? 'passed' : 'failed';
        collectResults(run, dir);
        const s = run.summary;
        if (run.status === 'failed' && s && !s.passed && !s.failed && !s.flaky && !s.skipped) run.status = 'no tests';
        saveIndex();

        // The next run would overwrite reports/, so the reports are built before releasing the queue.
        if (run.status === 'passed' || run.status === 'failed') {
            emit(run.id, 'status', { ...publicRun(run), status: 'reporting' });
            await buildReports(run, dir, env, onData);
            saveIndex();
        }
        log.end();
        emit(run.id, 'status', publicRun(run));
        emit(run.id, 'done', {});
        current = null;
        pump();
    });
}

/**
 * Evidence and RCA files from earlier runs would otherwise end up in this run's
 * Slack report. Move them aside (never delete) before a run starts.
 */
function archiveOldEvidence(runId) {
    for (const name of ['evidence', 'rca']) {
        const src   = path.join(ROOT, 'reports', name);
        const files = fs.existsSync(src) ? fs.readdirSync(src) : [];
        if (!files.length) continue;
        const dest = path.join(DATA_DIR, 'archived-evidence', `before-${runId}`, name);
        fs.mkdirSync(dest, { recursive: true });
        for (const f of files) fs.renameSync(path.join(src, f), path.join(dest, f));
    }
}

/** The steps of `npm run qa:report` after Playwright (RCA → qa-report), then the PDF, then Slack. */
async function buildReports(run, dir, env, onData) {
    const base = PUBLIC_URL ? `${PUBLIC_URL}/runs/${run.id}` : '';
    const stepEnv = { ...env, QC_REPORT_URL: base && `${base}/report/index.html`, QC_PDF_URL: base && `${base}/files/report.pdf` };
    const node = args => new Promise(resolve => {
        const c = spawn(process.execPath, args, { cwd: ROOT, env: stepEnv });
        c.stdout.on('data', onData);
        c.stderr.on('data', onData);
        c.on('close', code => { if (code !== 0) onData(`(${args[0]} exited with ${code})\n`); resolve(code); });
    });

    onData('\n── Reports ──\n');
    if (run.summary && (run.summary.failed || run.summary.flaky)) await node(['ai/analyze-failure.js']);
    await node(['ai/generate-report.js']);
    for (const f of ['qa-report.md', 'qa-report.json']) {
        const src = path.join(ROOT, 'reports', f);
        if (fs.existsSync(src)) fs.copyFileSync(src, path.join(dir, f));
    }

    try {
        await buildPdf(run, dir);
        run.hasPdf = true;
        onData('[PDF] report.pdf written\n');
    } catch (e) {
        onData(`[PDF] failed: ${e.message}\n`);
    }

    if (SLACK_ON) {
        if (!run.hasPdf) delete stepEnv.QC_PDF_URL;
        await node(['notifications/slack.js']);
        run.slack = true;
    }
}

function cancelCurrent() {
    if (!current) return false;
    current.run.status = 'cancelled';
    const pid = current.child.pid;
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(pid), '/T', '/F']);
    else try { process.kill(-pid, 'SIGTERM'); } catch { /* already gone */ }
    return true;
}

/** Copy this run's Playwright output (reports/ is overwritten by the next run) and summarise it. */
function collectResults(run, dir) {
    const resultsFile = path.join(ROOT, 'reports', 'results.json');
    const htmlDir     = path.join(ROOT, 'reports', 'html');
    // Only take results written after this run started — otherwise they belong to an older run.
    if (!fs.existsSync(resultsFile) || fs.statSync(resultsFile).mtime < new Date(run.started)) return;

    fs.copyFileSync(resultsFile, path.join(dir, 'results.json'));
    if (fs.existsSync(htmlDir)) fs.cpSync(htmlDir, path.join(dir, 'html'), { recursive: true });
    run.hasReport = fs.existsSync(path.join(dir, 'html', 'index.html'));

    const results = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
    const s = results.stats || {};
    run.summary = {
        passed: s.expected || 0, failed: s.unexpected || 0, flaky: s.flaky || 0, skipped: s.skipped || 0,
        durationMin: Math.round((s.duration || 0) / 60000),
    };
    run.failures = [];
    const walk = suite => {
        for (const spec of suite.specs || []) {
            for (const t of spec.tests || []) {
                if (t.status !== 'unexpected' && t.status !== 'flaky') continue;
                const last = (t.results || []).slice(-1)[0] || {};
                const err  = (last.error && (last.error.message || last.error.value)) || '';
                // test-results/ is wiped by the next run, so keep the failure screenshot with this run.
                const png  = (last.attachments || []).find(a => a.contentType === 'image/png' && a.path && fs.existsSync(a.path));
                let screenshot = null;
                if (png) {
                    fs.mkdirSync(path.join(dir, 'shots'), { recursive: true });
                    screenshot = path.join('shots', `${run.failures.length + 1}.png`);
                    fs.copyFileSync(png.path, path.join(dir, screenshot));
                }
                run.failures.push({
                    title:   spec.title,
                    file:    spec.file,
                    project: t.projectName,
                    status:  t.status,
                    error:   err.replace(/\x1b\[[0-9;]*m/g, '').slice(0, 1200),
                    screenshot,
                });
            }
        }
        (suite.suites || []).forEach(walk);
    };
    (results.suites || []).forEach(walk);
}

/** Compact text the AI gets so it can answer questions about recent runs. */
function aiContext() {
    const lines = [];
    if (current) lines.push(`Running now: ${current.run.label} (started ${current.run.started} by ${current.run.user})`);
    if (queue.length) lines.push(`Queued: ${queue.length}`);
    for (const r of runs.slice(0, 8)) {
        const s = r.summary;
        lines.push(`Run ${r.id} [${r.status}] ${r.label}${r.ticket ? ` for ${r.ticket.key}` : ''} by ${r.user} at ${r.created}` +
            (s ? ` — ${s.passed} passed, ${s.failed} failed, ${s.flaky} flaky, ${s.skipped} skipped, ${s.durationMin} min` : ''));
    }
    const latest = runs.find(r => r.failures && r.failures.length);
    if (latest) {
        lines.push(`\nFailures in run ${latest.id} (${latest.label}):`);
        for (const f of latest.failures.slice(0, 25)) lines.push(`- [${f.project}] ${f.title}\n  ${f.error.split('\n').slice(0, 6).join('\n  ')}`);
    }
    return lines.join('\n') || 'No runs yet.';
}

function statusText() {
    if (!current && !queue.length) return 'Nothing is running. The queue is empty.';
    const parts = [];
    if (current) parts.push(`Running: ${current.run.label} (started by ${current.run.user}).`);
    if (queue.length) parts.push(`${queue.length} run(s) queued.`);
    return parts.join(' ');
}

// ── HTTP ──────────────────────────────────────────────────────────────────────

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
               '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webm': 'video/webm', '.zip': 'application/zip',
               '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8' };

function send(res, status, body, type = 'application/json') {
    res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(type === 'application/json' ? JSON.stringify(body) : body);
}

function sendFile(res, file) {
    fs.stat(file, (err, st) => {
        if (err || !st.isFile()) return send(res, 404, { error: 'Not found' });
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': st.size });
        fs.createReadStream(file).pipe(res);
    });
}

/** Resolve `rel` inside `base`, refusing anything that escapes it. */
function safeJoin(base, rel) {
    const p = path.resolve(base, '.' + path.sep + decodeURIComponent(rel));
    return p.startsWith(base + path.sep) || p === base ? p : null;
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let data = '';
        req.on('data', c => { data += c; if (data.length > 1e5) req.destroy(); });
        req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
        req.on('error', reject);
    });
}

const authed = req => {
    const m = (req.headers.cookie || '').match(/(?:^|;\s*)qc_key=([^;]+)/);
    const got = Buffer.from(m ? decodeURIComponent(m[1]) : '');
    const want = Buffer.from(KEY);
    return got.length === want.length && crypto.timingSafeEqual(got, want);
};

function logEvent(entry) {
    fs.appendFileSync(CMD_LOG, JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n');
}

/**
 * A ticket moved to a QA status: read it, let the AI pick the run, queue it. Results stay in the console and
 * Slack (no Jira comment unless someone clicks "Post result"). Long runs (full / unfiltered regression) are
 * not started automatically, and a ticket that already has a queued or running run is not queued twice.
 */
async function handleTicketWebhook(key, status) {
    const user = 'Jira automation';
    if (!jira.merchantForKey(key)) return logEvent({ source: 'jira-webhook', key, status, skipped: 'project not in JIRA_PROJECT_MAP' });
    if (runs.some(r => r.ticket && r.ticket.key === key && ['queued', 'running'].includes(r.status))) {
        return logEvent({ source: 'jira-webhook', key, status, skipped: 'already queued or running' });
    }
    const out = await ai.interpret(`test ${key}`, aiContext());
    if (out.action !== 'run') return logEvent({ source: 'jira-webhook', key, status, skipped: 'no run chosen', reply: out.reply });
    if (ai.needsConfirm(out.plan)) {
        return logEvent({ source: 'jira-webhook', key, status, skipped: 'long run needs a person to start it', plan: out.plan });
    }
    const run = createRun(out.plan, user, `Jira: ${key} moved to ${status || 'QA'}`, out.ticket || null);
    run.note = out.reply;
    saveIndex();
    logEvent({ source: 'jira-webhook', key, status, runId: run.id, plan: out.plan });
}

/** A ticket sent back from the UI on a confirmed run: keep only a well-formed key + summary. */
function cleanTicket(t) {
    if (!t || !/^[A-Z][A-Z0-9]+-\d+$/.test(String(t.key || ''))) return null;
    return { key: t.key, url: jira.browseUrl(t.key), summary: String(t.summary || '').slice(0, 200) };
}

/** Plain-text Jira comment for a finished run. */
function jiraComment(run) {
    const s = run.summary || {};
    const base = PUBLIC_URL ? `${PUBLIC_URL}/runs/${run.id}` : '';
    const lines = [
        `Suntek QC Console: automated test run (${run.status.toUpperCase()})`,
        `${run.label}, triggered by ${run.user} on ${new Date(run.started).toUTCString()}`,
        `Result: ${s.passed || 0} passed, ${s.failed || 0} failed, ${s.flaky || 0} flaky, ${s.skipped || 0} skipped (${s.durationMin ?? '?'} min)`,
    ];
    if ((run.failures || []).length) {
        lines.push('', 'Failures:');
        for (const f of run.failures.slice(0, 15)) lines.push(`- [${f.project}] ${f.title}: ${(f.error || '').split('\n')[0].slice(0, 160)}`);
        if (run.failures.length > 15) lines.push(`- ...and ${run.failures.length - 15} more (see the report)`);
    }
    if (base) {
        lines.push('');
        if (run.hasReport) lines.push(`Report: ${base}/report/index.html`);
        if (run.hasPdf) lines.push(`PDF: ${base}/files/report.pdf`);
        lines.push('(The links ask for the QC Console access key.)');
    }
    lines.push('', 'Playwright decides pass/fail; any probable causes are AI-assisted and advisory. QA makes the final call.');
    return lines.join('\n');
}

const cleanUser = u => String(u || 'anonymous').replace(/[^\w .@-]/g, '').slice(0, 40) || 'anonymous';

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const p   = url.pathname;

    try {
        if (p === '/' || p === '/index.html') return sendFile(res, path.join(PUBLIC, 'index.html'));

        if (p === '/api/login' && req.method === 'POST') {
            const { key } = await readBody(req);
            const ok = typeof key === 'string' && key.length === KEY.length && crypto.timingSafeEqual(Buffer.from(key), Buffer.from(KEY));
            if (!ok) return send(res, 401, { error: 'Wrong access key' });
            res.setHeader('Set-Cookie', `qc_key=${encodeURIComponent(KEY)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000`);
            return send(res, 200, { ok: true });
        }

        // Jira Automation ("Send web request" when a ticket moves to a QA status). Authenticated by its own
        // secret header, not the browser cookie. Answers at once; the ticket is handled in the background.
        if (p === '/api/jira/webhook' && req.method === 'POST') {
            if (!WEBHOOK_SECRET) return send(res, 404, { error: 'Not found' });
            const got = Buffer.from(String(req.headers['x-qc-webhook-secret'] || ''));
            const want = Buffer.from(WEBHOOK_SECRET);
            if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return send(res, 401, { error: 'Bad secret' });
            const body = await readBody(req);
            const key = String(body.key || '').toUpperCase();
            if (!/^[A-Z][A-Z0-9]+-\d+$/.test(key)) return send(res, 400, { error: 'Body must be {"key": "KOH-68", "status": "..."}' });
            send(res, 202, { accepted: key });
            handleTicketWebhook(key, String(body.status || '').slice(0, 60)).catch(e => logEvent({ source: 'jira-webhook', key, error: e.message }));
            return;
        }

        if (!authed(req)) {
            // Report links (e.g. from Slack): log in first, then come back here.
            if (req.method === 'GET' && p.startsWith('/runs/')) {
                res.writeHead(302, { Location: '/?next=' + encodeURIComponent(p) });
                return res.end();
            }
            return send(res, 401, { error: 'Login required' });
        }

        if (p === '/api/meta') {
            return send(res, 200, {
                ai:        ai.aiName(),
                jira:      jira.configured(),
                targets:   ai.meta.TARGETS,
                merchants: ai.meta.ACTIVE_MERCHANTS,
                viewports: ai.meta.VIEWPORTS,
                modules:   Object.fromEntries(Object.entries(ai.meta.MODULES).map(([k, m]) => [k, m.description])),
                tiers:     Object.fromEntries(Object.entries(ai.meta.TIERS).map(([k, t]) => [k, t.description])),
            });
        }

        if (p === '/api/runs' && req.method === 'GET') return send(res, 200, runs.slice(0, 100).map(publicRun));

        if (p === '/api/runs' && req.method === 'POST') {   // confirmed plan from the UI
            const body = await readBody(req);
            const plan = ai.validatePlan(body.plan);
            const run  = createRun(plan, cleanUser(body.user), String(body.command || '').slice(0, 500), cleanTicket(body.ticket));
            return send(res, 200, { run: publicRun(run) });
        }

        if (p === '/api/command' && req.method === 'POST') {
            const body = await readBody(req);
            const text = String(body.text || '').trim().slice(0, 2000);
            const user = cleanUser(body.user);
            if (!text) return send(res, 400, { error: 'Empty command' });

            let out;
            try {
                out = await ai.interpret(text, aiContext());
            } catch (e) {
                out = { action: 'answer', reply: `Couldn't interpret that: ${e.message}` };
            }
            let run = null, confirm = false;
            if (out.action === 'run') {
                if (ai.needsConfirm(out.plan)) confirm = true;
                else run = createRun(out.plan, user, text, out.ticket || null);
            } else if (out.action === 'status') {
                out.reply = statusText();
            } else if (out.action === 'cancel') {
                out.reply = cancelCurrent() ? `Cancelled: ${current.run.label}` : 'Nothing is running.';
            }
            fs.appendFileSync(CMD_LOG, JSON.stringify({ at: new Date().toISOString(), user, text, action: out.action, plan: out.plan || null, runId: run && run.id }) + '\n');
            return send(res, 200, { action: out.action, reply: out.reply, plan: out.plan || null, ticket: out.ticket || null, confirm, run: publicRun(run), source: out.source });
        }

        // Post a finished run's result to its Jira ticket. Only ever on an explicit click in the UI.
        const jiraRoute = p.match(/^\/api\/runs\/([\w-]+)\/jira$/);
        if (jiraRoute && req.method === 'POST') {
            const run = runs.find(r => r.id === jiraRoute[1]);
            if (!run || !run.ticket) return send(res, 400, { error: 'This run is not linked to a Jira ticket.' });
            if (!['passed', 'failed'].includes(run.status)) return send(res, 400, { error: 'Wait until the run has finished.' });
            const body = await readBody(req);
            await jira.addComment(run.ticket.key, jiraComment(run));
            run.jiraPosted = { at: new Date().toISOString(), by: cleanUser(body.user) };
            saveIndex();
            return send(res, 200, { ok: true, run: publicRun(run) });
        }

        if (p === '/api/cancel' && req.method === 'POST') {
            return send(res, 200, { cancelled: cancelCurrent() });
        }

        let m;
        if ((m = p.match(/^\/api\/runs\/([\w-]+)$/))) {
            const run = runs.find(r => r.id === m[1]);
            if (!run) return send(res, 404, { error: 'No such run' });
            const logFile = path.join(RUNS_DIR, run.id, 'log.txt');
            return send(res, 200, { ...publicRun(run), log: fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8').slice(-200000) : '' });
        }

        if ((m = p.match(/^\/api\/runs\/([\w-]+)\/stream$/))) {
            const run = runs.find(r => r.id === m[1]);
            if (!run) return send(res, 404, { error: 'No such run' });
            res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
            if (!listeners.has(run.id)) listeners.set(run.id, new Set());
            listeners.get(run.id).add(res);
            res.write(`event: status\ndata: ${JSON.stringify(publicRun(run))}\n\n`);
            const ping = setInterval(() => res.write(': ping\n\n'), 25000);
            req.on('close', () => { clearInterval(ping); listeners.get(run.id).delete(res); });
            return;
        }

        if ((m = p.match(/^\/runs\/([\w-]+)\/(report|files)\/(.*)$/))) {
            const base = path.join(RUNS_DIR, m[1], m[2] === 'report' ? 'html' : '');
            const file = safeJoin(base, m[3] || 'index.html');
            return file ? sendFile(res, file) : send(res, 400, { error: 'Bad path' });
        }

        return send(res, 404, { error: 'Not found' });
    } catch (e) {
        return send(res, 400, { error: e.message });
    }
});

server.listen(PORT, HOST, () => {
    console.log(`QC Console on http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
    console.log(`Access key: ${KEY}${process.env.QC_CONSOLE_KEY ? ' (from QC_CONSOLE_KEY)' : '  (random — set QC_CONSOLE_KEY in .env to keep it fixed)'}`);
    console.log(`AI: ${ai.aiName() || 'keyword parser (no CLAUDE_API_KEY or GOOGLE_API_KEY)'}`);
});
