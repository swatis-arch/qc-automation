/**
 * notifications/slack.js — Slack QA Report Notification
 *
 * Sends a formatted management-oriented QA summary to Slack.
 * The message is concise and action-focused — not raw Playwright logs.
 *
 * Format (as specified in Section 29 of the SUNTEK AI QC guide):
 *   SUNTEK AI QC
 *   [N] Merchants | [N] Tests
 *   PASS [N] | WARNING [N] | FAILED [N]
 *   P0: N | P1: N | P2: N
 *   [Per failure: merchant, test, severity, probable cause, confidence]
 *
 * Usage:
 *   node notifications/slack.js                   ← uses reports/qa-report.json
 *   node notifications/slack.js --dry-run         ← prints payload without sending
 *   SLACK_WEBHOOK_URL=... node notifications/slack.js
 */

require('dotenv').config();

const fs   = require('fs');
const path = require('path');

const WEBHOOK_URL  = process.env.SLACK_WEBHOOK_URL;
const QA_REPORT    = path.join(process.cwd(), 'reports', 'qa-report.json');

// ── Build Slack Blocks ────────────────────────────────────────────────────────

/**
 * Build the Slack Block Kit payload from a QA report.
 * @param {Object} report - From generate-report.js
 * @returns {Object} Slack API payload
 */
function buildSlackPayload(report) {
    const { summary, severity, merchant, merchantBreakdown = [] } = report;
    const passRate    = summary.passRate;
    const isAllPassed = summary.failed === 0;
    const statusEmoji = isAllPassed ? '✅' : (severity.P0 > 0 ? '🔴' : severity.P1 > 0 ? '🟠' : '🟡');
    const sevEmojis    = { P0: '🔴', P1: '🟠', P2: '🟡', P3: '🟢' };

    // Slack hard limits: 50 blocks / message, ~3000 chars per section text.
    // A full per-test breakdown (per QA's requested report format) can't fit
    // for a large run, so Slack gets a merchant-wise summary + a capped
    // preview per merchant; the complete table-per-merchant detail always
    // lives in reports/qa-report.md (no such size limit there).
    const MAX_MERCHANTS_SHOWN  = 5;
    const MAX_FAILURES_PER_MERCHANT = 3;

    const blocks = [];

    // ── Header ────────────────────────────────────────────────────────────────
    blocks.push({
        type: 'header',
        text: {
            type:  'plain_text',
            text:  `${statusEmoji} SUNTEK AI QC — ${merchant || 'QA Report'}`,
            emoji: true,
        },
    });

    // ── Summary stats ─────────────────────────────────────────────────────────
    blocks.push({
        type: 'section',
        fields: [
            { type: 'mrkdwn', text: `*Total Tests*\n${summary.total}` },
            { type: 'mrkdwn', text: `*Pass Rate*\n${passRate}` },
            { type: 'mrkdwn', text: `*✅ Passed*\n${summary.passed}` },
            { type: 'mrkdwn', text: `*❌ Failed*\n${summary.failed}` },
        ],
    });

    // ── Severity breakdown ────────────────────────────────────────────────────
    if (!isAllPassed) {
        blocks.push({ type: 'divider' });
        blocks.push({
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: [
                    `*Severity Breakdown*`,
                    `🔴 P0 Critical: *${severity.P0}*   🟠 P1 High: *${severity.P1}*   🟡 P2 Medium: *${severity.P2}*   🟢 P3 Low: *${severity.P3}*`,
                ].join('\n'),
            },
        });
    }

    // ── Merchant-wise failure summary ────────────────────────────────────────
    if (merchantBreakdown.length > 0) {
        blocks.push({ type: 'divider' });
        blocks.push({
            type: 'section',
            text: { type: 'mrkdwn', text: `*Merchant-wise Failure Summary*` },
        });
        // Slack sections allow up to 10 fields (2-col grid); chunk if needed.
        for (let i = 0; i < merchantBreakdown.length; i += 10) {
            blocks.push({
                type: 'section',
                fields: merchantBreakdown.slice(i, i + 10).map(({ merchant: m, failedCount }) => ({
                    type: 'mrkdwn',
                    text: `*${m}*\n${failedCount} failed`,
                })),
            });
        }

        // ── Per-merchant failure preview ─────────────────────────────────────
        for (const { merchant: m, failedCount, failures } of merchantBreakdown.slice(0, MAX_MERCHANTS_SHOWN)) {
            blocks.push({ type: 'divider' });
            blocks.push({
                type: 'section',
                text: { type: 'mrkdwn', text: `*${m} — ${failedCount} Failed Test${failedCount === 1 ? '' : 's'}*` },
            });

            for (const { evidence, rca = {} } of failures.slice(0, MAX_FAILURES_PER_MERCHANT)) {
                const confidence = Math.round((rca.confidence || 0) * 100);
                const sevEmoji   = sevEmojis[rca.severity] || '❓';

                blocks.push({
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: [
                            `${sevEmoji} *${evidence.test || 'Unknown test'}* — \`${evidence.browser || 'unknown'}\` — \`${rca.severity || 'P3'}\``,
                            `*Reason:* ${rca.probableCause || 'Unknown'}`,
                            `*Confidence:* ${confidence}%   *Action:* ${rca.recommendedAction || 'Investigate manually'}`,
                        ].join('\n'),
                    },
                });
            }

            if (failedCount > MAX_FAILURES_PER_MERCHANT) {
                blocks.push({
                    type: 'context',
                    elements: [{
                        type: 'mrkdwn',
                        text: `_...and ${failedCount - MAX_FAILURES_PER_MERCHANT} more for ${m}. Full table: reports/qa-report.md_`,
                    }],
                });
            }
        }

        if (merchantBreakdown.length > MAX_MERCHANTS_SHOWN) {
            blocks.push({ type: 'divider' });
            blocks.push({
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `_...and ${merchantBreakdown.length - MAX_MERCHANTS_SHOWN} more merchants with failures. Full breakdown: reports/qa-report.md_`,
                },
            });
        }
    }

    if (isAllPassed) {
        blocks.push({ type: 'divider' });
        blocks.push({
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `✅ *All ${summary.total} tests passed. No failures detected.*`,
            },
        });
    }

    // ── Footer ────────────────────────────────────────────────────────────────
    blocks.push({ type: 'divider' });
    const triggeredByText = report.triggeredBy ? ` | Triggered by ${report.triggeredBy}` : '';
    blocks.push({
        type: 'context',
        elements: [{
            type: 'mrkdwn',
            text: `🤖 SUNTEK AI QC | Playwright + Claude | ${new Date(report.generated || new Date()).toLocaleString('en-US', { timeZone: 'UTC' })} UTC${triggeredByText}`,
        }],
    });

    return {
        username:    'SUNTEK AI QC',
        icon_emoji:  ':robot_face:',
        blocks,
    };
}

// ── Send to Slack ─────────────────────────────────────────────────────────────

/**
 * Send the QA report to Slack via incoming webhook.
 * @param {Object} report - From generate-report.js
 * @returns {Promise<boolean>} true if successful
 */
async function sendToSlack(report) {
    if (!WEBHOOK_URL || WEBHOOK_URL.includes('YOUR/WEBHOOK/HERE')) {
        console.warn('[Slack] No webhook URL configured. Set SLACK_WEBHOOK_URL in .env');
        console.warn('[Slack] Payload would be:\n', JSON.stringify(buildSlackPayload(report), null, 2));
        return false;
    }

    const payload = buildSlackPayload(report);

    try {
        const response = await fetch(WEBHOOK_URL, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(payload),
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Slack API error ${response.status}: ${text}`);
        }

        console.log('[Slack] Notification sent successfully.');
        return true;

    } catch (error) {
        console.error(`[Slack] Failed to send notification: ${error.message}`);
        return false;
    }
}

// ── CLI ───────────────────────────────────────────────────────────────────────

if (require.main === module) {
    const args    = process.argv.slice(2);
    const dryRun  = args.includes('--dry-run');

    if (!fs.existsSync(QA_REPORT)) {
        console.warn('[Slack] No qa-report.json found. Run: node ai/generate-report.js first.');
        process.exit(1);
    }

    const report = JSON.parse(fs.readFileSync(QA_REPORT, 'utf-8'));

    if (dryRun) {
        console.log('[Slack] Dry run — Slack payload:');
        console.log(JSON.stringify(buildSlackPayload(report), null, 2));
    } else {
        sendToSlack(report);
    }
}

module.exports = { sendToSlack, buildSlackPayload };
