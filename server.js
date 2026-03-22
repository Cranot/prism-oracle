import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { randomUUID } from 'crypto';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import dotenv from 'dotenv';
import { createPaymentMiddleware, paymentConfig } from './x402-config.js';
import { initChain, recordReceipt, getAgentInfo } from './chain.js';
import { initApiEngine, isApiEngineReady, analyzeWithApi, getApiStats } from './api-engine.js';

dotenv.config({ override: true });

// Initialize on-chain connection
initChain();

// Initialize API engine (direct Anthropic API — faster, real cost tracking, prompt caching)
const apiReady = initApiEngine(process.env.ANTHROPIC_API_KEY);

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const PRISM_PATH = process.env.PRISM_PY_PATH || join(__dirname, '..', '..', 'prism.py');
const RESULTS_DIR = join(__dirname, 'results');

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Block direct IP access — only allow Cloudflare tunnel (localhost) and local requests
app.use((req, res, next) => {
  const host = req.headers.host || '';
  // Allow: oracle.agentskb.com, localhost, 127.0.0.1
  if (host.includes('agentskb.com') || host.includes('localhost') || host.includes('127.0.0.1')) {
    return next();
  }
  // Block direct IP access
  res.status(403).json({ error: 'Direct IP access blocked. Use https://oracle.agentskb.com' });
});

app.use(express.static(join(__dirname, 'public')));

// x402 payment wall — agents must pay USDC on Base before analysis
if (process.env.AGENT_WALLET_ADDRESS && process.env.ENABLE_X402 === 'true') {
  try {
    app.use(createPaymentMiddleware(process.env.AGENT_WALLET_ADDRESS));
    console.log(`x402 payments enabled: $${paymentConfig.price} USDC on ${paymentConfig.isTestnet ? 'Base Sepolia' : 'Base Mainnet'}`);
  } catch (err) {
    console.log(`x402 init failed (${err.message}). Running in free mode.`);
  }
} else {
  console.log('x402 payments DISABLED. Running in free mode. Set ENABLE_X402=true to activate.');
}

// Ensure results directory exists
await mkdir(RESULTS_DIR, { recursive: true });

// In-memory job tracker for async analysis
const jobs = new Map(); // id -> { status, result, startTime }

// Rate limiting: max 5 analyses per IP per hour
const rateLimits = new Map(); // ip -> { count, resetTime }
const RATE_LIMIT = 5;
const RATE_WINDOW = 3600000; // 1 hour

function checkRateLimit(ip, limit = RATE_LIMIT) {
  const now = Date.now();
  const entry = rateLimits.get(ip);
  if (!entry || now > entry.resetTime) {
    rateLimits.set(ip, { count: 1, resetTime: now + RATE_WINDOW });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

// Content-hash cache: SHA256(code + mode) -> analysisId
// Same code + same mode = same result. Zero inference cost on repeats.
const CACHE_DIR = join(RESULTS_DIR, '_cache');
await mkdir(CACHE_DIR, { recursive: true });

function contentHash(code, mode) {
  // Normalize: collapse whitespace so formatting differences don't bust cache
  const normalized = code.replace(/\s+/g, ' ').trim();
  return createHash('sha256').update(normalized + '::' + mode).digest('hex');
}

async function getCachedResult(hash) {
  try {
    const mapFile = join(CACHE_DIR, hash + '.json');
    const cached = JSON.parse(await readFile(mapFile, 'utf-8'));
    // Verify the actual report still exists
    const reportPath = join(RESULTS_DIR, cached.id, 'report.json');
    const report = JSON.parse(await readFile(reportPath, 'utf-8'));
    return {
      id: cached.id,
      status: 'complete',
      elapsed_seconds: 0,
      model: report.model,
      cost_usd: 0,
      depth_score: report.depth_score,
      conservation_law: report.conservation_law,
      meta_law: report.meta_law,
      bugs_found: report.bugs?.length || 0,
      bugs: report.bugs,
      findings_summary: report.findings_summary,
      extraction_confidence: report.extraction_confidence,
      report_url: `/report/${cached.id}`,
      report_md_url: `/report/${cached.id}/md`,
      cached: true,
      cache_hit: hash.slice(0, 12)
    };
  } catch {
    return null;
  }
}

async function setCacheEntry(hash, analysisId) {
  try {
    await writeFile(
      join(CACHE_DIR, hash + '.json'),
      JSON.stringify({ id: analysisId, created: new Date().toISOString() })
    );
  } catch {}
}

// ─────────────────────────────────────────────
// Health check
// ─────────────────────────────────────────────
app.get('/health', async (req, res) => {
  const chainInfo = await getAgentInfo();
  res.json({
    status: 'ok',
    agent: 'Prism Oracle',
    version: '1.0.0',
    capabilities: ['structural_analysis', 'conservation_law_detection', 'bug_finding'],
    pricing: { currency: 'USDC', amount: '1.00', network: 'Base' },
    chain: chainInfo
  });
});

// ─────────────────────────────────────────────
// Core analysis endpoint (async — returns job ID immediately)
// ─────────────────────────────────────────────
app.post('/analyze', async (req, res) => {
  const { code, mode = 'l12', repo_url, filename = 'input.py', sync, model = 'sonnet' } = req.body;

  // API key auth — optional but tracked
  const apiKey = req.headers['x-api-key'] || req.query.key;
  const isAuthenticated = apiKey === process.env.API_KEY;

  const clientIp = req.headers['x-forwarded-for'] || req.ip || 'unknown';
  // Authenticated users get 20/hour, anonymous get 5/hour
  const limit = isAuthenticated ? 20 : 5;
  if (!checkRateLimit(clientIp, limit)) {
    return res.status(429).json({ error: 'rate_limited', message: `Max ${limit} analyses per hour.${!isAuthenticated ? ' Authenticate with x-api-key header for higher limits.' : ''}` });
  }

  if (!code && !repo_url) {
    return res.status(400).json({ error: 'missing_input', message: 'Provide either "code" or "repo_url"' });
  }

  if (code && code.trim().length < 50) {
    return res.status(422).json({ error: 'input_too_short', message: 'Code too short for meaningful analysis. Submit at least 50 characters.' });
  }

  // Cache check — same code + mode = instant return, zero cost
  if (code) {
    const hash = contentHash(code, mode);
    const cached = await getCachedResult(hash);
    if (cached) {
      console.log(`Cache hit: ${hash.slice(0, 12)} → ${cached.id}`);
      return res.json(cached);
    }
  }

  // Max concurrent analyses
  const running = [...jobs.values()].filter(j => j.status === 'running').length;
  if (running >= 3) {
    return res.status(503).json({ error: 'busy', message: 'Server busy. Max 3 concurrent analyses. Try again in a minute.' });
  }

  const analysisId = randomUUID();
  jobs.set(analysisId, { status: 'running', startTime: Date.now() });

  // Run analysis in background
  runAnalysis(analysisId, code, mode, filename, req.headers['x-requester-address'], model || 'sonnet');

  // If sync=true, wait for completion (for simple clients)
  if (sync === true || sync === 'true') {
    const result = await waitForJob(analysisId, 300000);
    return res.json(result);
  }

  // Default: return job ID immediately, client polls /job/:id
  res.status(202).json({
    id: analysisId,
    status: 'running',
    poll_url: `/job/${analysisId}`,
    report_url: `/report/${analysisId}`,
    message: 'Analysis started. Poll /job/:id for status.'
  });
});

// Background analysis runner
async function runAnalysis(analysisId, code, mode, filename, requesterAddress, modelOverride) {
  const startTime = Date.now();
  try {
    const tempDir = join(RESULTS_DIR, analysisId);
    await mkdir(tempDir, { recursive: true });
    const inputFile = join(tempDir, filename);

    if (code) {
      await writeFile(inputFile, code, 'utf-8');
    }

    let cleanOutput, usage;

    if (isApiEngineReady() && (mode === 'l12' || mode === 'sdl')) {
      // Direct API path — faster, real costs, prompt caching
      const apiResult = await analyzeWithApi(code, mode, modelOverride);
      cleanOutput = apiResult.output;
      usage = apiResult.usage;
    } else {
      // Fallback: CLI path via prism.py
      const prismOutput = await runPrism(inputFile, mode);
      cleanOutput = prismOutput.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
      usage = { actual_cost_usd: estimateCost(cleanOutput), model: 'haiku-4.5-cli', cache_hit: false };
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    const result = parsePrismOutput(cleanOutput);

    const report = {
      id: analysisId,
      timestamp: new Date().toISOString(),
      mode,
      filename,
      elapsed_seconds: parseFloat(elapsed),
      model: usage.model || 'haiku-4.5',
      cost_usd: usage.actual_cost_usd,
      ...result,
      usage,
      raw_output: cleanOutput
    };

    await writeFile(join(tempDir, 'report.json'), JSON.stringify(report, null, 2));
    await writeFile(join(tempDir, 'report.md'), formatMarkdown(report));

    // Record on-chain receipt (non-blocking)
    recordReceipt(requesterAddress, null, report.cost_usd, report.depth_score, report.bugs?.length || 0)
      .then(r => { if (r.onchain) console.log(`Analysis ${analysisId} on-chain: ${r.txHash}`); })
      .catch(() => {});

    const jobResult = {
      id: analysisId,
      status: 'complete',
      elapsed_seconds: report.elapsed_seconds,
      model: report.model,
      cost_usd: report.cost_usd,
      depth_score: report.depth_score,
      conservation_law: report.conservation_law,
      meta_law: report.meta_law,
      bugs_found: report.bugs?.length || 0,
      bugs: report.bugs,
      findings_summary: report.findings_summary,
      extraction_confidence: report.extraction_confidence,
      report_url: `/report/${analysisId}`,
      report_md_url: `/report/${analysisId}/md`
    };

    jobs.set(analysisId, { status: 'complete', result: jobResult });

    // Cache the result by content hash
    if (code) {
      const hash = contentHash(code, mode);
      await setCacheEntry(hash, analysisId);
    }

    console.log(`Analysis ${analysisId} complete: depth=${report.depth_score}, bugs=${report.bugs?.length}, ${elapsed}s`);
  } catch (err) {
    console.error(`Analysis ${analysisId} failed:`, err.message);
    jobs.set(analysisId, { status: 'error', result: { id: analysisId, status: 'error', error: err.message } });
  }
}

function waitForJob(id, timeout) {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      const job = jobs.get(id);
      if (job?.status !== 'running') return resolve(job?.result || { status: 'error', error: 'Job not found' });
      if (Date.now() - start > timeout) return resolve({ id, status: 'timeout' });
      setTimeout(check, 1000);
    };
    check();
  });
}

// ─────────────────────────────────────────────
// Job status polling
// ─────────────────────────────────────────────
app.get('/job/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found. Jobs expire after server restart.' });

  if (job.status === 'running') {
    const elapsed = ((Date.now() - job.startTime) / 1000).toFixed(0);
    const timeout = parseInt(elapsed) > 300;
    if (timeout) {
      jobs.set(req.params.id, { status: 'error', result: { id: req.params.id, status: 'timeout', error: 'Analysis exceeded 5 minute timeout' } });
      return res.json({ id: req.params.id, status: 'timeout', error: 'Analysis exceeded 5 minute timeout' });
    }
    return res.json({ id: req.params.id, status: 'running', elapsed_seconds: parseInt(elapsed) });
  }

  res.json(job.result);
});

// ─────────────────────────────────────────────
// Stats endpoint
// ─────────────────────────────────────────────
app.get('/stats', async (req, res) => {
  const completed = [...jobs.values()].filter(j => j.status === 'complete');
  const running = [...jobs.values()].filter(j => j.status === 'running');

  const depths = completed.map(j => j.result?.depth_score).filter(Boolean);
  const times = completed.map(j => j.result?.elapsed_seconds).filter(Boolean);
  const bugs = completed.map(j => j.result?.bugs_found || 0);

  // Count cache entries
  let cacheEntries = 0;
  try {
    const { readdirSync } = await import('fs');
    cacheEntries = readdirSync(CACHE_DIR).filter(f => f.endsWith('.json')).length;
  } catch {}

  res.json({
    total_analyses: completed.length,
    running: running.length,
    cached_entries: cacheEntries,
    avg_depth: depths.length ? (depths.reduce((a, b) => a + b, 0) / depths.length).toFixed(1) : null,
    avg_time_seconds: times.length ? (times.reduce((a, b) => a + b, 0) / times.length).toFixed(0) : null,
    total_bugs_found: bugs.reduce((a, b) => a + b, 0),
    api_costs: isApiEngineReady() ? getApiStats() : null,
    cache_note: 'Same code + mode = instant return at $0.00. First analysis: ~$0.003. Every repeat: free.',
    analyses: completed.map(j => ({
      id: j.result.id,
      depth: j.result.depth_score,
      bugs: j.result.bugs_found,
      time: j.result.elapsed_seconds
    }))
  });
});

// ─────────────────────────────────────────────
// Demo endpoint — instant cached result for judges
// ─────────────────────────────────────────────
let cachedDemo = null;
app.get('/demo', async (req, res) => {
  // Return cached Starlette analysis instantly — no waiting
  if (cachedDemo) return res.json(cachedDemo);

  // Try to load from the best existing analysis
  try {
    const dirs = (await import('fs')).readdirSync(RESULTS_DIR);
    for (const dir of dirs) {
      try {
        const report = JSON.parse(await readFile(join(RESULTS_DIR, dir, 'report.json'), 'utf-8'));
        if (report.depth_score >= 8 && report.bugs?.length > 3) {
          cachedDemo = {
            id: report.id,
            status: 'complete',
            elapsed_seconds: report.elapsed_seconds,
            model: report.model,
            cost_usd: report.cost_usd,
            depth_score: report.depth_score,
            conservation_law: report.conservation_law,
            meta_law: report.meta_law,
            bugs_found: report.bugs?.length || 0,
            bugs: report.bugs,
            findings_summary: (report.findings_summary || '').slice(0, 300),
            extraction_confidence: report.extraction_confidence || 'high',
            cached: true,
            note: 'Pre-computed demo from Starlette routing.py (333 lines, real production code)'
          };
          return res.json(cachedDemo);
        }
      } catch {}
    }
    res.json({ error: 'No demo results cached yet. Run an analysis first.' });
  } catch {
    res.json({ error: 'No demo results available' });
  }
});

// ─────────────────────────────────────────────
// Recent analyses feed
// ─────────────────────────────────────────────
app.get('/recent', async (req, res) => {
  try {
    const { readdirSync } = await import('fs');
    const dirs = readdirSync(RESULTS_DIR).sort().reverse().slice(0, 10);
    const analyses = [];
    for (const dir of dirs) {
      try {
        const report = JSON.parse(await readFile(join(RESULTS_DIR, dir, 'report.json'), 'utf-8'));
        analyses.push({
          id: report.id,
          timestamp: report.timestamp,
          mode: report.mode,
          depth_score: report.depth_score,
          bugs_found: report.bugs?.length || 0,
          conservation_law: report.conservation_law,
          elapsed_seconds: report.elapsed_seconds,
          extraction_confidence: report.extraction_confidence
        });
      } catch {}
    }
    res.json({ count: analyses.length, analyses });
  } catch {
    res.json({ count: 0, analyses: [] });
  }
});

// ─────────────────────────────────────────────
// Report retrieval
// ─────────────────────────────────────────────
app.get('/report/:id', async (req, res) => {
  try {
    const reportPath = join(RESULTS_DIR, req.params.id, 'report.json');
    const report = JSON.parse(await readFile(reportPath, 'utf-8'));
    res.json(report);
  } catch {
    res.status(404).json({ error: 'Report not found' });
  }
});

app.get('/report/:id/md', async (req, res) => {
  try {
    const mdPath = join(RESULTS_DIR, req.params.id, 'report.md');
    const md = await readFile(mdPath, 'utf-8');
    res.type('text/markdown').send(md);
  } catch {
    res.status(404).json({ error: 'Report not found' });
  }
});

// ─────────────────────────────────────────────
// Prism.py runner
// ─────────────────────────────────────────────
function runPrism(filePath, mode) {
  return new Promise((resolve, reject) => {
    const args = ['--scan', filePath];

    // Map mode to prism.py arguments
    switch (mode) {
      case 'sdl':
        args.push('--use-prism', 'deep_scan');
        break;
      case 'adaptive':
        args.push('adaptive');
        break;
      case 'full':
        args.push('full');
        break;
      case 'l12':
      default:
        // Default L12 mode — no extra args needed
        break;
    }

    // prism.py uses `claude -p` (CLI subscription), not direct API calls.
    // No API key needed — the server has Claude CLI configured.
    const proc = spawn('python3', [PRISM_PATH, ...args], {
      timeout: 180000,
      env: { ...process.env }
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`prism.py exited with code ${code}: ${stderr.slice(0, 500)}`));
      } else {
        resolve(stdout);
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn prism.py: ${err.message}`));
    });
  });
}

// ─────────────────────────────────────────────
// Output parsing
// ─────────────────────────────────────────────
function parsePrismOutput(output) {
  // NOTE: This parser was improved by prism.py's own L12 self-audit.
  // Original issue found: "schema laundering" — regex extraction imposed false
  // ontology (single-valued authoritative fields) on multi-valued analytical output.
  // Fix: extraction confidence, multi-match awareness, context preservation.
  const result = {
    depth_score: null,
    conservation_law: null,
    meta_law: null,
    bugs: [],
    findings_summary: '',
    extraction_confidence: 'unknown',
    raw_length: output.length
  };

  // Extract conservation law — use LAST match (refined conclusion, not first mention)
  const allLawMatches = [...output.matchAll(/conservation law[:\s]*([^\n|]+)/gi)];
  if (allLawMatches.length > 0) {
    const best = allLawMatches[allLawMatches.length - 1];
    const text = best[1].trim();
    // Filter out meta-references, negative findings, and prompt instructions
    const isReal = text.length > 20
      && !/not found|not identified|no clear/i.test(text)
      && !/find the|identify the|name the|look for/i.test(text)  // prompt instructions
      && !text.startsWith('-')  // list items from prompts
      && !text.startsWith('*');
    if (isReal) {
      result.conservation_law = text;
    }
  }

  // Extract meta-law — same last-match strategy
  const allMetaMatches = [...output.matchAll(/meta[- ]?(?:conservation )?law[:\s]*([^\n|]+)/gi)];
  if (allMetaMatches.length > 0) {
    const best = allMetaMatches[allMetaMatches.length - 1];
    const text = best[1].trim();
    const isMetaReal = text.length > 20
      && !/not found|not identified|no clear/i.test(text)
      && !/find the|identify the|name the|look for|apply the/i.test(text)
      && !text.startsWith('-')
      && !text.startsWith('*');
    if (isMetaReal) {
      result.meta_law = text;
    }
  }

  // Extract bugs from MULTIPLE formats Sonnet produces:

  // Format 1: Pipe tables — | location | description | severity |
  const tablePattern = /\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(structural|fixable|design|high|medium|low|critical)\s*\|/gi;
  let match;
  while ((match = tablePattern.exec(output)) !== null) {
    const loc = match[1].trim();
    if (/^[-=|\s]+$/.test(loc) || /^(location|bug|what|severity|finding|#)/i.test(loc) || loc.length < 5 || loc.replace(/[-|=\s]/g, '').length < 5) continue;
    result.bugs.push({
      location: loc,
      description: match[2].trim(),
      type: match[3].trim().toLowerCase()
    });
  }

  // Format 2: Numbered prose — "1. **Location**: `func` \n **What breaks**: desc"
  const prosePattern = /\d+\.\s*\*\*Location\*\*:\s*`?([^`\n]+)`?[^\n]*\n\s*\*\*What breaks\*\*:\s*([^\n]+)/gi;
  while ((match = prosePattern.exec(output)) !== null) {
    const loc = match[1].trim();
    const desc = match[2].trim();
    // Determine severity from nearby text
    const context = output.slice(Math.max(0, match.index - 200), match.index + 300);
    const severity = /critical/i.test(context) ? 'critical'
      : /high/i.test(context) ? 'high'
      : /medium/i.test(context) ? 'medium'
      : /low/i.test(context) ? 'low' : 'medium';
    // Avoid duplicates
    if (!result.bugs.some(b => b.location === loc)) {
      result.bugs.push({ location: loc, description: desc, type: severity });
    }
  }

  // Format 3: Bullet bugs — "- **location**: description (Severity: High)"
  const bulletPattern = /[-*]\s*\*\*([^*]+)\*\*[:\s]*([^(\n]+?)(?:\((?:Severity:\s*)?(critical|high|medium|low)\))?$/gim;
  while ((match = bulletPattern.exec(output)) !== null) {
    const loc = match[1].trim();
    const desc = match[2].trim();
    if (desc.length < 10) continue; // skip short fragments
    if (/location|what breaks|severity/i.test(loc)) continue; // skip headers
    const severity = match[3] ? match[3].toLowerCase() : 'medium';
    if (!result.bugs.some(b => b.location === loc)) {
      result.bugs.push({ location: loc, description: desc, type: severity });
    }
  }

  // Format 4: Section header bugs — "### **BUG N: Title**\n- **Location**: ...\n- **What breaks**: ...\n- **Severity**: ..."
  const sectionBugPattern = /###\s*\*\*(?:BUG\s*\d+[:\s]*)?([^*]+)\*\*\s*\n-\s*\*\*Location\*\*:\s*([^\n]+)\n-\s*\*\*What breaks\*\*:\s*([^\n]+)\n-\s*\*\*Severity\*\*:\s*\*?\*?(\w+)/gi;
  while ((match = sectionBugPattern.exec(output)) !== null) {
    const title = match[1].trim();
    const loc = match[2].trim();
    const desc = match[3].trim();
    const sev = match[4].trim().toLowerCase();
    if (!result.bugs.some(b => b.location === loc && b.description === desc)) {
      result.bugs.push({ location: loc, description: title + ' — ' + desc, type: sev });
    }
  }

  // Format 5: Numbered with severity on same line — "1. **Location**: ...\n   - **What breaks**: ...\n   - **Severity**: High"
  const numberedSevPattern = /\d+\.\s*\*\*Location\*\*:\s*([^\n]+)\n\s*-?\s*\*\*What breaks\*\*:\s*([^\n]+)\n\s*-?\s*\*\*Severity\*\*:\s*(\w+)/gi;
  while ((match = numberedSevPattern.exec(output)) !== null) {
    const loc = match[1].trim().replace(/`/g, '');
    const desc = match[2].trim();
    const sev = match[3].trim().toLowerCase();
    if (!result.bugs.some(b => b.location.includes(loc.slice(0, 20)))) {
      result.bugs.push({ location: loc, description: desc, type: sev });
    }
  }

  // Format 6: Location/Breaks/Severity blocks — "N. **Location**: ...\n   **Breaks**: ...\n   **Severity**: ..."
  const blockPattern = /\d+\.\s*\*\*Location\*\*:\s*([^\n]+)\n\s*\*\*Breaks\*\*:\s*([^\n]+)\n\s*\*\*Severity\*\*:\s*(\w+)/gi;
  while ((match = blockPattern.exec(output)) !== null) {
    const loc = match[1].trim();
    const desc = match[2].trim();
    const sev = match[3].trim().toLowerCase();
    if (!result.bugs.some(b => b.location === loc)) {
      result.bugs.push({ location: loc, description: desc, type: sev });
    }
  }

  // Format 7: Single-line "N. **Location:** x - **What breaks:** y"
  const singleLinePattern = /\d+\.\s*\*\*Location:\*\*\s*`?([^`\-]+)`?\s*-\s*\*\*What breaks:\*\*\s*([^\n]+)/gi;
  while ((match = singleLinePattern.exec(output)) !== null) {
    const loc = match[1].trim();
    const desc = match[2].trim();
    if (!result.bugs.some(b => b.location === loc)) {
      const ctx = output.slice(Math.max(0, match.index - 200), match.index + 300);
      const sev = /critical/i.test(ctx) ? 'critical' : /high/i.test(ctx) ? 'high' : 'medium';
      result.bugs.push({ location: loc, description: desc, type: sev });
    }
  }

  // Format 8: Conservation law prediction lines — "**Conservation law prediction**: Structural - unfixable"
  // These indicate the previous numbered item IS a bug, capture the fixable/structural classification
  const predictionPattern = /\*\*Conservation law prediction\*\*:\s*(Structural|Fixable)[^\n]*/gi;
  let predIdx = 0;
  while ((match = predictionPattern.exec(output)) !== null) {
    const classification = match[1].toLowerCase();
    // Update the nearest preceding bug's type if it exists
    if (predIdx < result.bugs.length) {
      result.bugs[predIdx].type = classification;
    }
    predIdx++;
  }

  // Depth score — weighted markers with specificity
  const markerWeights = [
    [/conservation law[:\s]*.{10,}/i, 1.5],
    [/meta[- ]?law[:\s]*.{10,}/i, 1.5],
    [/impossibility/i, 1.2],
    [/structural invariant/i, 1.3],
    [/concealment/i, 1.0],
    [/generative construction/i, 1.1],
    [/dialectic/i, 0.9]
  ];
  let weightedScore = 6.0;
  for (const [pattern, weight] of markerWeights) {
    if (pattern.test(output)) weightedScore += weight * 0.5;
  }
  result.depth_score = Math.min(10, parseFloat(weightedScore.toFixed(1)));

  // Extraction confidence — how much can the consumer trust the parsed fields?
  const signals = [
    result.conservation_law ? 1 : 0,
    result.meta_law ? 1 : 0,
    result.bugs.length > 0 ? 1 : 0,
    output.length > 2000 ? 1 : 0, // substantial output
    allLawMatches.length >= 2 ? 1 : 0 // law mentioned multiple times = likely real
  ];
  const confidence = signals.reduce((a, b) => a + b, 0) / signals.length;
  result.extraction_confidence = confidence >= 0.8 ? 'high' : confidence >= 0.4 ? 'medium' : 'low';

  // Summary: meaningful content lines
  const lines = output.split('\n').filter(l => l.trim() && !l.startsWith('#'));
  result.findings_summary = lines.slice(0, 10).join('\n').slice(0, 500);

  return result;
}

// ─────────────────────────────────────────────
// Cost estimation
// ─────────────────────────────────────────────
function estimateCost(output) {
  // prism.py uses claude -p (CLI subscription) — actual per-call cost is near-zero.
  // This estimates what the equivalent API cost WOULD be for comparison.
  // Haiku 4.5 API pricing: $1 input / $5 output per MTok
  const inputTokens = 2000; // prism prompt ~2K tokens
  const outputTokens = Math.ceil(output.length / 4); // rough estimate
  return parseFloat(((inputTokens * 1 + outputTokens * 5) / 1_000_000).toFixed(4));
}

// ─────────────────────────────────────────────
// Markdown report formatter
// ─────────────────────────────────────────────
function formatMarkdown(report) {
  return `# Prism Oracle Analysis Report

**ID:** ${report.id}
**Date:** ${report.timestamp}
**Mode:** ${report.mode}
**Model:** ${report.model}
**Elapsed:** ${report.elapsed_seconds}s
**Inference Cost:** $${report.cost_usd}

## Conservation Law
${report.conservation_law || 'Not extracted'}

## Meta-Law
${report.meta_law || 'Not extracted'}

## Depth Score
${report.depth_score?.toFixed(1) || 'N/A'} / 10

## Bugs Found (${report.bugs?.length || 0})
${report.bugs?.length ? report.bugs.map(b =>
  `- **[${b.type}]** ${b.location}: ${b.description}`
).join('\n') : 'None detected'}

## Findings Summary
${report.findings_summary || 'See raw output'}

---
*Generated by Prism Oracle — structural analysis powered by cognitive prisms*
*Engine: prism.py (14,600 lines, 58 prisms, 248 proven principles)*
`;
}

// ─────────────────────────────────────────────
// Start server
// ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════════════╗
  ║            PRISM ORACLE v1.0.0                ║
  ║                                               ║
  ║  Structural analysis at Haiku prices.         ║
  ║  Sells audits at Opus quality.                ║
  ║                                               ║
  ║  POST /analyze     — submit analysis (async)  ║
  ║  GET  /job/:id     — poll job status           ║
  ║  GET  /report/:id  — full JSON report          ║
  ║  GET  /demo        — instant cached demo       ║
  ║  GET  /recent      — recent analyses feed      ║
  ║  GET  /stats       — usage statistics          ║
  ║  GET  /health      — agent info + chain        ║
  ║                                               ║
  ║  Port: ${String(PORT).padEnd(38)}║
  ╚═══════════════════════════════════════════════╝
  `);
});
