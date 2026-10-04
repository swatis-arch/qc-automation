/**
 * utils/midscene-env.js — model settings for the Midscene AI trial
 *
 * Midscene reads its model from MIDSCENE_MODEL_* env vars. When those are not set,
 * this falls back to the Gemini key the Magnitude trial already uses (GOOGLE_API_KEY),
 * so one key in .env drives both trials. Explicit MIDSCENE_MODEL_* values always win.
 *
 * Required by playwright.config.js (main process) and fixtures/ai.js (workers) before
 * Midscene is loaded.
 */

require('dotenv').config({ quiet: true });

if (!process.env.MIDSCENE_MODEL_API_KEY && process.env.GOOGLE_API_KEY) {
    process.env.MIDSCENE_MODEL_API_KEY  = process.env.GOOGLE_API_KEY;
    process.env.MIDSCENE_MODEL_BASE_URL = process.env.MIDSCENE_MODEL_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai/';
    process.env.MIDSCENE_MODEL_NAME     = process.env.MIDSCENE_MODEL_NAME     || 'gemini-3.5-flash';
    process.env.MIDSCENE_MODEL_FAMILY   = process.env.MIDSCENE_MODEL_FAMILY   || 'gemini';
    // Midscene otherwise asks Gemini for thinking level "minimal", which Gemini 3.8 rejects (HTTP 400).
    process.env.MIDSCENE_MODEL_REASONING_ENABLED = process.env.MIDSCENE_MODEL_REASONING_ENABLED || 'true';
    process.env.MIDSCENE_MODEL_REASONING_EFFORT  = process.env.MIDSCENE_MODEL_REASONING_EFFORT  || 'low';
}

const key = process.env.MIDSCENE_MODEL_API_KEY;
const midsceneConfigured = Boolean(key && key !== 'your_model_api_key_here');

module.exports = { midsceneConfigured };
