/**
 * tests/magnitude/magnitude.config.ts — Magnitude AI trial (TRIAL)
 *
 * Magnitude (npm: magnitude-test) drives the browser from natural-language steps using a
 * vision model. It runs with its own CLI and only picks up *.mag.ts files, so the normal
 * Playwright suite is unaffected.
 *
 * Model: the first key set in .env wins —
 *          OPENAI_API_KEY      OpenAI (model: MAGNITUDE_MODEL, required)
 *          OPENROUTER_API_KEY  OpenRouter (default: Qwen 3.8 27B, free tier)
 *          GOOGLE_API_KEY      Gemini (default: gemini-3.5-flash)
 *        MAGNITUDE_MODEL overrides the model for any of them.
 * Run:   npm run test:magnitude            ($MERCHANT, else the first active merchant)
 */

import { type MagnitudeConfig } from 'magnitude-test';
import { baseUrl } from './merchant';

const llm: MagnitudeConfig['llm'] = process.env.OPENAI_API_KEY
    ? {
        provider: 'openai',
        options: {
            model:  process.env.MAGNITUDE_MODEL as string,
            apiKey: process.env.OPENAI_API_KEY,
        },
    }
    : process.env.OPENROUTER_API_KEY
    ? {
        provider: 'openai-generic',
        options: {
            baseUrl: 'https://openrouter.ai/api/v1',
            model:   process.env.MAGNITUDE_MODEL || 'qwen/qwen3.8-27b:free',
            apiKey:  process.env.OPENROUTER_API_KEY,
        },
    }
    : {
        provider: 'google-ai',
        options: {
            model:  process.env.MAGNITUDE_MODEL || 'gemini-3.5-flash',
            apiKey: process.env.GOOGLE_API_KEY,
        },
    };

export default {
    url: baseUrl,
    llm,
    browser: {
        launchOptions: { headless: true },
    },
    telemetry: false,
} satisfies MagnitudeConfig;
