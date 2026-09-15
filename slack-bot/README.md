# SUNTEK QC Slack Bot — `/qc` slash command

Lets anyone in the Slack workspace type `/qc run smoke outset` and kick off a
regression run in GitHub Actions. Results are posted back to the same Slack
channel a few minutes later by the existing `notifications/slack.js` step.

```
Slack (/qc run smoke outset)
        │
        ▼
Cloudflare Worker (this folder)  ── verifies the request came from Slack
        │
        ▼
GitHub Actions API  ── starts .github/workflows/regression.yml
        │
        ▼
Playwright runs → Claude RCA → Slack incoming webhook  ── posts PASS/FAIL results
```

## One-time setup

### 1. Push this repo to GitHub
The Worker triggers a GitHub Actions workflow, so the code needs to live in a
GitHub repo first. If that hasn't happened yet, do that before continuing.

### 2. Create a GitHub token the Worker can use to start runs
GitHub Settings → Developer settings → **Fine-grained personal access tokens** → Generate new token
- Repository access: only this repo
- Permissions: **Actions → Read and write**

Copy the token — you'll paste it into Cloudflare in step 5.

### 3. Create the Slack app
Go to https://api.slack.com/apps → **Create New App** → From scratch.
- Name it e.g. "SUNTEK QC", pick your workspace.
- Under **Slash Commands**, click **Create New Command**:
  - Command: `/qc`
  - Request URL: `https://suntek-qc-slack-bot.<your-subdomain>.workers.dev/slack/qc`
    (you'll get the real URL in step 6 — come back and fill this in after deploying)
  - Short description: `Run SUNTEK QC regression tests`
  - Usage hint: `run smoke outset`
- Under **Basic Information**, copy the **Signing Secret** — you'll need it in step 5.
- Install the app to your workspace (Install App → Install to Workspace).

### 4. Configure this Worker
Edit `wrangler.toml` and set:
```toml
GITHUB_OWNER = "your-github-org-or-username"
GITHUB_REPO  = "your-repo-name"
GITHUB_REF   = "main"   # or whatever your default branch is called
```

### 5. Set secrets and deploy
From this `slack-bot/` folder:
```bash
npx wrangler login              # one-time, opens a browser to auth with Cloudflare
npx wrangler secret put SLACK_SIGNING_SECRET     # paste the value from step 3
npx wrangler secret put GITHUB_TOKEN             # paste the token from step 2
npx wrangler deploy
```
Wrangler prints the deployed URL, e.g. `https://suntek-qc-slack-bot.<subdomain>.workers.dev`.

### 6. Point Slack at the deployed URL
Back in the Slack app config (step 3) → Slash Commands → edit `/qc` → set the
Request URL to `<deployed URL>/slack/qc` → Save.

### 7. Try it
In any channel the app is in:
```
/qc help
/qc run smoke outset
```
You should see an immediate "🚀 started a run" message, then the full
PASS/FAIL report a few minutes later once the workflow finishes.

## Adding a merchant
When you activate a new merchant in `merchants/index.js`, also add its slug to
`VALID_MERCHANTS` in `src/index.js` and redeploy (`npx wrangler deploy`).

## Local testing
```bash
npx wrangler dev
```
Slack requires a public HTTPS URL, so to test slash commands against a local
dev server you'd need a tunnel (e.g. `cloudflared tunnel --url http://localhost:8787`).
For most changes it's simpler to just `wrangler deploy` and test against the
real Slack app.
