// Direct Anthropic API engine for Prism Oracle
// Bypasses claude -p CLI for: speed, real cost tracking, prompt caching

import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Prism directory — resolved at call time, not import time, so dotenv has loaded
function getPrismBase() {
  return process.env.PRISM_DIR || join(__dirname, '..', '..', 'prisms');
}

const PRISM_FILES = {
  l12: 'l12.md',
  sdl: 'deep_scan.md',
  claim: 'claim.md',
  pedagogy: 'pedagogy.md',
  emergence: 'emergence.md',
  counterfactual: 'counterfactual.md',
  genesis: 'genesis.md',
  scarcity: 'scarcity.md',
  exploit: 'exploit_surface.md',
};

// Trust-critical analysis uses Sonnet for maximum accuracy.
// Haiku available for quick triage scans.
const MODELS = {
  opus: 'claude-opus-4-20250514',
  sonnet: 'claude-sonnet-4-20250514',
  haiku: 'claude-haiku-4-5-20251001'
};
const DEFAULT_MODEL = 'sonnet';

let client = null;
let totalCost = { input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_creation_tokens: 0, calls: 0 };

export function initApiEngine(apiKey) {
  if (!apiKey) {
    console.log('API Engine: DISABLED (no ANTHROPIC_API_KEY)');
    return false;
  }
  client = new Anthropic({ apiKey, timeout: 10 * 60 * 1000 }); // 10 min timeout
  console.log(`API Engine: READY (Sonnet default, prompt caching enabled)`);
  return true;
}

export function isApiEngineReady() {
  return client !== null;
}

export async function analyzeWithApi(code, mode = 'l12', modelOverride = null) {
  if (!client) throw new Error('API engine not initialized');

  const modelKey = modelOverride || DEFAULT_MODEL;
  const model = MODELS[modelKey] || MODELS[DEFAULT_MODEL];

  // Load the prism prompt
  const prismFile = PRISM_FILES[mode] || PRISM_FILES.l12;
  const prismPath = join(getPrismBase(), prismFile);
  let prismPrompt;
  try {
    const raw = await readFile(prismPath, 'utf-8');
    // Strip YAML frontmatter
    prismPrompt = raw.replace(/^---[\s\S]*?---\n*/m, '').trim();
  } catch (err) {
    throw new Error(`Prism file not found: ${prismPath} (${err.message})`);
  }

  // Construct the API call with prompt caching on the system prompt
  const response = await client.messages.create({
    model,
    max_tokens: 64000,
    system: [
      {
        type: 'text',
        text: prismPrompt,
        cache_control: { type: 'ephemeral' }
      }
    ],
    messages: [
      {
        role: 'user',
        content: `Analyze the following code:\n\n\`\`\`\n${code}\n\`\`\``
      }
    ]
  });

  // Track costs
  const usage = response.usage || {};
  totalCost.input_tokens += usage.input_tokens || 0;
  totalCost.output_tokens += usage.output_tokens || 0;
  totalCost.cache_read_tokens += usage.cache_read_input_tokens || 0;
  totalCost.cache_creation_tokens += usage.cache_creation_input_tokens || 0;
  totalCost.calls += 1;

  // Calculate actual cost based on model
  // Opus 4: $15/MTok input, $75/MTok output
  // Sonnet 4: $3/MTok input, $15/MTok output
  // Haiku 4.5: $1/MTok input, $5/MTok output
  const isOpus = model.includes('opus');
  const isSonnet = model.includes('sonnet');
  const inputRate = isOpus ? 15 : isSonnet ? 3 : 1;
  const outputRate = isOpus ? 75 : isSonnet ? 15 : 5;
  const cacheReadRate = isOpus ? 1.5 : isSonnet ? 0.3 : 0.1;
  const cacheWriteRate = isOpus ? 18.75 : isSonnet ? 3.75 : 1.25;

  const inputCost = ((usage.input_tokens || 0) * inputRate) / 1_000_000;
  const outputCost = ((usage.output_tokens || 0) * outputRate) / 1_000_000;
  const cacheReadCost = ((usage.cache_read_input_tokens || 0) * cacheReadRate) / 1_000_000;
  const cacheWriteCost = ((usage.cache_creation_input_tokens || 0) * cacheWriteRate) / 1_000_000;
  const actualCost = inputCost + outputCost + cacheReadCost + cacheWriteCost;

  const output = response.content.map(c => c.text || '').join('\n');

  return {
    output,
    usage: {
      input_tokens: usage.input_tokens || 0,
      output_tokens: usage.output_tokens || 0,
      cache_read_tokens: usage.cache_read_input_tokens || 0,
      cache_creation_tokens: usage.cache_creation_input_tokens || 0,
      actual_cost_usd: parseFloat(actualCost.toFixed(6)),
      model,
      model_key: modelKey,
      cache_hit: (usage.cache_read_input_tokens || 0) > 0
    }
  };
}

export function getApiStats() {
  const inputCost = (totalCost.input_tokens * 1) / 1_000_000;
  const outputCost = (totalCost.output_tokens * 5) / 1_000_000;
  const cacheReadCost = (totalCost.cache_read_tokens * 0.1) / 1_000_000;
  const totalUsd = inputCost + outputCost + cacheReadCost;

  return {
    total_calls: totalCost.calls,
    total_input_tokens: totalCost.input_tokens,
    total_output_tokens: totalCost.output_tokens,
    total_cache_read_tokens: totalCost.cache_read_tokens,
    total_cache_creation_tokens: totalCost.cache_creation_tokens,
    total_cost_usd: parseFloat(totalUsd.toFixed(6)),
    avg_cost_per_call: totalCost.calls ? parseFloat((totalUsd / totalCost.calls).toFixed(6)) : 0
  };
}
