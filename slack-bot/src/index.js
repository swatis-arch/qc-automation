/**
 * slack-bot/src/index.js — /qc Slack slash command receiver
 *
 * Lets anyone in the Slack workspace type:
 *   /qc run smoke outset
 *   /qc run regression
 *   /qc help
 *
 * and have it kick off the SUNTEK AI QC regression pipeline
 * (.github/workflows/regression.yml) via the GitHub Actions API.
 * The actual pass/fail results are posted back to Slack a few
 * minutes later by the existing notifications/slack.js step in
 * that workflow — this Worker only handles the "start a run" part
 * and an immediate acknowledgement.
 *
 * Deploy: see slack-bot/README.md
 */

const VALID_SUITES = ['smoke', 'regression', 'visual', 'technical'];

// Keep in sync with ACTIVE_MERCHANTS in merchants/index.js
const VALID_MERCHANTS = ['outset'];

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const url = new URL(request.url);
    if (url.pathname !== '/slack/qc') {
      return new Response('Not found', { status: 404 });
    }

    const rawBody = await request.text();

    const verified = await verifySlackSignature(request, rawBody, env.SLACK_SIGNING_SECRET);
    if (!verified) {
      return new Response('Invalid signature', { status: 401 });
    }

    const params = new URLSearchParams(rawBody);
    const text = (params.get('text') || '').trim();
    const userName = params.get('user_name') || 'someone';

    const args = text.split(/\s+/).filter(Boolean);
    const subcommand = (args[0] || 'help').toLowerCase();

    if (subcommand === 'help' || args.length === 0) {
      return jsonResponse(helpMessage());
    }

    if (subcommand !== 'run') {
      return jsonResponse(ephemeral(`Unknown command \`${subcommand}\`. Try \`/qc help\`.`));
    }

    const suite = (args[1] || 'smoke').toLowerCase();
    const merchant = (args[2] || 'outset').toLowerCase();

    if (!VALID_SUITES.includes(suite)) {
      return jsonResponse(ephemeral(
        `Unknown suite \`${suite}\`. Valid suites: ${VALID_SUITES.map(s => `\`${s}\``).join(', ')}.`
      ));
    }

    if (!VALID_MERCHANTS.includes(merchant)) {
      return jsonResponse(ephemeral(
        `Unknown merchant \`${merchant}\`. Valid merchants: ${VALID_MERCHANTS.map(m => `\`${m}\``).join(', ')}.`
      ));
    }

    try {
      await triggerWorkflow({ env, suite, merchant, triggeredBy: `@${userName} via Slack` });
    } catch (err) {
      return jsonResponse(ephemeral(`Failed to start the run: ${err.message}`));
    }

    return jsonResponse({
      response_type: 'in_channel',
      text: `🚀 *${userName}* started a *${suite}* regression run for *${merchant}*. Results will be posted here in a few minutes.`,
    });
  },
};

async function triggerWorkflow({ env, suite, merchant, triggeredBy }) {
  const owner = env.GITHUB_OWNER;
  const repo = env.GITHUB_REPO;
  const ref = env.GITHUB_REF || 'main';

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/regression.yml/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'suntek-qc-slack-bot',
      },
      body: JSON.stringify({
        ref,
        inputs: { suite, merchant, triggered_by: triggeredBy },
      }),
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GitHub API ${response.status}: ${detail}`);
  }
}

async function verifySlackSignature(request, rawBody, signingSecret) {
  const timestamp = request.headers.get('X-Slack-Request-Timestamp');
  const signature = request.headers.get('X-Slack-Signature');
  if (!timestamp || !signature || !signingSecret) return false;

  // Reject requests older than 5 minutes to prevent replay attacks.
  const fiveMinutes = 60 * 5;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > fiveMinutes) return false;

  const base = `v0:${timestamp}:${rawBody}`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(signingSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const macBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(base));
  const mac = [...new Uint8Array(macBuffer)].map(b => b.toString(16).padStart(2, '0')).join('');
  const expected = `v0=${mac}`;

  return timingSafeEqual(expected, signature);
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function jsonResponse(body) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
  });
}

function ephemeral(text) {
  return { response_type: 'ephemeral', text };
}

function helpMessage() {
  return ephemeral(
    [
      '*SUNTEK AI QC — /qc commands*',
      '`/qc run <suite> [merchant]` — start a regression run',
      `  suites: ${VALID_SUITES.join(', ')}`,
      `  merchants: ${VALID_MERCHANTS.join(', ')} (defaults to outset)`,
      'Examples:',
      '`/qc run smoke` — quick smoke test on outset',
      '`/qc run regression outset` — full regression on outset',
      '`/qc help` — show this message',
    ].join('\n')
  );
}
