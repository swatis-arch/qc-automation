# SUNTEK AI QC

> Multi-merchant Shopify QA/QC automation powered by **Playwright** and **Claude AI**.

## Architecture

```
Merchant Config → Playwright Tests → PASS/FAIL
                                        │
                                      FAIL
                                        │
                                  Evidence JSON
                              (screenshot + trace + console + network)
                                        │
                                   Claude API
                                        │
                             RCA + Severity + Confidence
                                        │
                              Consolidated QA Report
                                        │
                               Slack Notification
```

## Technology Stack

| Component | Technology |
|-----------|------------|
| Language | JavaScript (CommonJS) |
| Runtime | Node.js LTS |
| Automation | Playwright Test |
| Browsers | Chromium (desktop + mobile) |
| AI Analysis | Claude (Anthropic) |
| CI/CD | GitHub Actions |
| Reports | Playwright HTML + JSON |
| Notifications | Slack |

## Project Structure

```
suntek-ai-qc/
├── merchants/
│   └── the-outset/
│       └── config.js          ← Merchant URL, features, pages, integrations
│
├── tests/
│   ├── homepage.spec.js       ← Homepage + nav regression
│   ├── navigation.spec.js     ← Navigation flows
│   ├── plp.spec.js            ← Product listing page
│   ├── pdp.spec.js            ← Product detail page + ATC
│   ├── cart.spec.js           ← Cart operations
│   ├── checkout.spec.js       ← Checkout flow
│   ├── visual.spec.js         ← Screenshot regression
│   └── technical.spec.js      ← Broken images, console errors, SEO
│
├── Pages/                     ← Page Object Model
│   ├── Homepage.js
│   ├── PLPPage.js
│   ├── PDPPage.js
│   ├── CartPage.js
│   ├── CheckoutPage.js
│   └── components/
│       └── Navbar.js
│
├── fixtures/
│   └── base.js                ← Custom test.extend() fixtures
│
├── utils/
│   ├── console.js             ← Console error capture
│   ├── network.js             ← Network failure capture
│   ├── screenshots.js         ← Screenshot helpers
│   ├── test-data.js           ← Shared test data
│   └── evidence.js            ← Failure evidence assembler
│
├── ai/
│   ├── analyze-failure.js     ← Claude API → RCA JSON
│   ├── classify-severity.js   ← Severity helpers
│   └── generate-report.js     ← Consolidated QA report
│
├── notifications/
│   └── slack.js               ← Slack webhook posting
│
├── reports/                   ← Generated at runtime (git-ignored)
│
├── .github/workflows/
│   └── regression.yml         ← GitHub Actions CI
│
├── playwright.config.js
├── package.json
├── CLAUDE.md                  ← QA governance rules
└── .env.example               ← Environment variable template
```

## Quick Start

### 1. Prerequisites
- Node.js LTS (v20+)
- Git
- Claude API key (Anthropic Console)
- Slack webhook URL (optional)

### 2. Install
```bash
git clone <repo-url> suntek-ai-qc
cd suntek-ai-qc
npm install
npx playwright install chromium
```

### 3. Configure
```bash
cp .env.example .env
# Edit .env with your BASE_URL and API keys
```

### 4. Run Tests
```bash
# Full regression (desktop + mobile)
npm test

# Smoke tests only (fast — ~5 min)
npm run test:smoke

# Desktop only
npm run test:desktop

# Mobile only
npm run test:mobile

# Headed mode for debugging
npm run test:headed

# Open Playwright UI
npm run test:ui

# View HTML report
npm run test:report
```

### 5. AI Analysis
```bash
# Analyze failed test results (requires CLAUDE_API_KEY)
npm run analyze:failures

# Generate consolidated QA report
npm run generate:report

# Send Slack notification
npm run notify:slack
```

## Merchant Configuration

Each merchant lives in `merchants/<slug>/config.js`. To onboard a new merchant:

1. Copy `merchants/the-outset/config.js` to `merchants/<new-slug>/config.js`
2. Update all URLs, page paths, feature flags, and integrations
3. Set `BASE_URL=https://staging.newmerchant.com` in `.env`
4. Set `MERCHANT=new-slug` in `.env`
5. Run the smoke suite against staging to verify

## Test Types

| Type | Description | Run on |
|------|-------------|--------|
| Universal (Type A) | Core commerce flows | Every merchant |
| Feature-based (Type B) | Subscription, reviews, search | When feature enabled |
| Merchant-specific (Type C) | Custom business rules | Specific merchants |

## CI/CD

The GitHub Actions workflow (`.github/workflows/regression.yml`) runs:
- **Daily at 2 AM UTC** — full regression (all tests)
- **Manual trigger** — `workflow_dispatch` with suite selector

Required GitHub Secrets:
- `BASE_URL` — merchant staging URL
- `CLAUDE_API_KEY` — Anthropic API key
- `SLACK_WEBHOOK_URL` — Slack incoming webhook

## Severity Reference

| Severity | Description |
|----------|-------------|
| P0 | Site down / checkout completely broken |
| P1 | Critical commerce flow broken |
| P2 | Feature broken but workaround exists |
| P3 | Cosmetic / minor UX issue |

## Governance

See [CLAUDE.md](./CLAUDE.md) for full QA governance rules.

**Core principle**: Playwright determines what happened. Claude interprets why it probably happened. QA makes the final decision.
