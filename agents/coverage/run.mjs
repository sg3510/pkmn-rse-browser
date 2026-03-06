#!/usr/bin/env node
/**
 * Coverage Agent: C-to-TypeScript Analysis CLI
 *
 * Iterates over all C source folders in public/pokeemerald/, sends batches
 * to an LLM (Claude or Codex CLI), and builds a comprehensive coverage report.
 *
 * Usage:
 *   node agents/coverage_agent/run.mjs                       # default (Claude sonnet 4.6)
 *   node agents/coverage_agent/run.mjs --backend codex       # use Codex
 *   node agents/coverage_agent/run.mjs --dry-run             # show batch plan only
 *   node agents/coverage_agent/run.mjs --limit 10            # first 10 batches
 *   node agents/coverage_agent/run.mjs --concurrency 8       # 8 parallel LLM calls
 *   node agents/coverage_agent/run.mjs --folders "src/battle*"
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { globSync } from 'node:fs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const POKEEMERALD = path.join(ROOT, 'public', 'pokeemerald');
const PROMPT_TEMPLATE = path.join(import.meta.dirname, 'prompt-template.md');
const OUTPUT_FILE = path.join(import.meta.dirname, 'coverage.md');
const CONFIG_FILE = path.join(import.meta.dirname, 'config.json');

// ---------------------------------------------------------------------------
// Config file + CLI argument parsing (CLI flags override config)
// ---------------------------------------------------------------------------

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function parseArgs() {
  const config = loadConfig();
  const args = process.argv.slice(2);

  // Start from config defaults, fall back to hardcoded defaults
  const opts = {
    backend: config.backend ?? 'claude',
    model: config.model ?? null,     // resolved after backend is known
    delay: config.delay ?? 2000,
    charLimit: config.charLimit ?? 150_000,
    concurrency: config.concurrency ?? 5,
    dryRun: false,
    limit: 0,
    folders: null,
    resume: config.resume ?? true,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--backend':     opts.backend = args[++i]; break;
      case '--model':       opts.model = args[++i]; break;
      case '--delay':       opts.delay = parseInt(args[++i], 10); break;
      case '--char-limit':  opts.charLimit = parseInt(args[++i], 10); break;
      case '--concurrency': opts.concurrency = parseInt(args[++i], 10); break;
      case '--dry-run':     opts.dryRun = true; break;
      case '--limit':       opts.limit = parseInt(args[++i], 10); break;
      case '--folders':     opts.folders = args[++i]; break;
      case '--resume':      opts.resume = args[++i] !== 'false'; break;
      case '--no-resume':   opts.resume = false; break;
      default:
        console.error(`Unknown flag: ${args[i]}`);
        process.exit(1);
    }
  }

  if (!opts.model) {
    opts.model = opts.backend === 'claude' ? 'claude-sonnet-4-6' : 'gpt-5.3-codex';
  }
  return opts;
}

// ---------------------------------------------------------------------------
// 1. buildStaticContext — TS file tree, generated files, generator manifest
// ---------------------------------------------------------------------------

function buildStaticContext() {
  // TS file tree (hand-written files only)
  const allTs = globSync('src/**/*.{ts,tsx}', { cwd: ROOT })
    .filter(f => !f.endsWith('.gen.ts'))
    .sort();
  const tsFileTree = allTs.join('\n');

  // Generated files
  const genFiles = globSync('src/**/*.gen.ts', { cwd: ROOT }).sort();
  const generatedFilesList = genFiles.join('\n');

  // Generator manifest: scan each generate-*.cjs for source paths and outputs
  const generatorScripts = globSync('scripts/generate-*.cjs', { cwd: ROOT }).sort();
  const manifestLines = [];

  for (const script of generatorScripts) {
    const content = fs.readFileSync(path.join(ROOT, script), 'utf-8');
    const sources = [];
    const outputs = [];

    // Extract paths from variable assignments pointing to pokeemerald/
    const pathMatches = content.matchAll(/path\.join\(ROOT,\s*['"]([^'"]+)['"]\)/g);
    for (const m of pathMatches) {
      const p = m[1];
      if (p.includes('pokeemerald')) {
        sources.push(p);
      } else if (p.endsWith('.gen.ts') || p.endsWith('.ts')) {
        outputs.push(p);
      }
    }

    // Also check for string literal paths
    const strMatches = content.matchAll(/['"]((public\/pokeemerald|src\/)[^'"]+)['"]/g);
    for (const m of strMatches) {
      const p = m[1];
      if (p.includes('pokeemerald') && !sources.includes(p)) {
        sources.push(p);
      } else if ((p.endsWith('.gen.ts') || p.endsWith('.ts')) && !outputs.includes(p)) {
        outputs.push(p);
      }
    }

    if (sources.length || outputs.length) {
      manifestLines.push(`${script}:`);
      if (sources.length) manifestLines.push(`  reads: ${sources.join(', ')}`);
      if (outputs.length) manifestLines.push(`  writes: ${outputs.join(', ')}`);
    }
  }

  const generatorManifest = manifestLines.join('\n');

  const ctx = { tsFileTree, generatedFilesList, generatorManifest };
  const totalChars = tsFileTree.length + generatedFilesList.length + generatorManifest.length;
  console.log(`Static context: ${(totalChars / 1024).toFixed(1)}KB (TS tree: ${allTs.length} files, generated: ${genFiles.length}, generators: ${generatorScripts.length})`);
  return ctx;
}

// ---------------------------------------------------------------------------
// 2. discoverAndGroupFiles — Enumerate C sources by folder
// ---------------------------------------------------------------------------

function discoverAndGroupFiles() {
  const groups = [];

  // pokeemerald/src/*.c — one group per file
  const srcCFiles = globSync('src/*.c', { cwd: POKEEMERALD }).sort();
  for (const f of srcCFiles) {
    groups.push({ label: `src/${path.basename(f)}`, files: [f] });
  }

  // pokeemerald/include/*.h — single group
  const includeH = globSync('include/*.h', { cwd: POKEEMERALD }).sort();
  if (includeH.length) {
    groups.push({ label: 'include/', files: includeH });
  }

  // pokeemerald/include/constants/*.h — single group
  const constH = globSync('include/constants/*.h', { cwd: POKEEMERALD }).sort();
  if (constH.length) {
    groups.push({ label: 'include/constants/', files: constH });
  }

  // pokeemerald/src/data/**/*.h — group by subfolder
  const dataH = globSync('src/data/**/*.h', { cwd: POKEEMERALD }).sort();
  const dataSubfolders = new Map();
  for (const f of dataH) {
    const dir = path.dirname(f);
    if (!dataSubfolders.has(dir)) dataSubfolders.set(dir, []);
    dataSubfolders.get(dir).push(f);
  }
  for (const [dir, files] of [...dataSubfolders].sort((a, b) => a[0].localeCompare(b[0]))) {
    groups.push({ label: `${dir}/`, files });
  }

  // pokeemerald/data/scripts/*.inc — single group
  const dataScripts = globSync('data/scripts/*.inc', { cwd: POKEEMERALD }).sort();
  if (dataScripts.length) {
    groups.push({ label: 'data/scripts/', files: dataScripts });
  }

  // pokeemerald/data/text/*.inc — single group
  const dataText = globSync('data/text/*.inc', { cwd: POKEEMERALD }).sort();
  if (dataText.length) {
    groups.push({ label: 'data/text/', files: dataText });
  }

  // pokeemerald/data/*.s top-level assembly files
  const dataAsm = globSync('data/*.s', { cwd: POKEEMERALD }).sort();
  if (dataAsm.length) {
    groups.push({ label: 'data/ (asm)', files: dataAsm });
  }

  // pokeemerald/asm/**/*.{s,inc} — single group
  const asmFiles = globSync('asm/**/*.{s,inc}', { cwd: POKEEMERALD }).sort();
  if (asmFiles.length) {
    groups.push({ label: 'asm/', files: asmFiles });
  }

  return groups;
}

// ---------------------------------------------------------------------------
// 3. planBatches — Split groups into token-safe batches
// ---------------------------------------------------------------------------

function planBatches(groups, charLimit, folderFilter) {
  const batches = [];

  for (const group of groups) {
    // Apply folder filter
    if (folderFilter) {
      const pattern = folderFilter.replace(/\*/g, '.*');
      const regex = new RegExp(`^${pattern}`);
      if (!regex.test(group.label)) continue;
    }

    // Read file sizes
    const fileSizes = group.files.map(f => {
      const fullPath = path.join(POKEEMERALD, f);
      try {
        return { file: f, size: fs.statSync(fullPath).size };
      } catch {
        return { file: f, size: 0 };
      }
    }).filter(f => f.size > 0);

    const totalChars = fileSizes.reduce((sum, f) => sum + f.size, 0);

    if (totalChars <= charLimit) {
      // Entire group fits in one batch
      batches.push({ label: group.label, files: fileSizes.map(f => f.file), totalChars });
    } else if (fileSizes.length === 1) {
      // Single large file — split at function boundaries
      const chunks = splitLargeFile(fileSizes[0].file, charLimit);
      for (let i = 0; i < chunks.length; i++) {
        batches.push({
          label: `${group.label} (part ${i + 1}/${chunks.length})`,
          files: [fileSizes[0].file],
          totalChars: chunks[i].length,
          preloadedContent: chunks[i],
        });
      }
    } else {
      // Multi-file group — greedy bin-packing
      let currentBatch = [];
      let currentSize = 0;
      let partNum = 0;

      for (const f of fileSizes) {
        if (currentSize + f.size > charLimit && currentBatch.length > 0) {
          partNum++;
          batches.push({
            label: `${group.label} (part ${partNum})`,
            files: currentBatch.map(x => x.file),
            totalChars: currentSize,
          });
          currentBatch = [];
          currentSize = 0;
        }
        currentBatch.push(f);
        currentSize += f.size;
      }

      if (currentBatch.length) {
        partNum++;
        const suffix = partNum > 1 ? ` (part ${partNum})` : '';
        batches.push({
          label: `${group.label}${suffix}`,
          files: currentBatch.map(x => x.file),
          totalChars: currentSize,
        });
      }
    }
  }

  return batches;
}

/**
 * Split a large C file at top-level function boundaries.
 * Returns array of string chunks, each under charLimit.
 */
function splitLargeFile(relPath, charLimit) {
  const content = fs.readFileSync(path.join(POKEEMERALD, relPath), 'utf-8');
  const lines = content.split('\n');
  const chunks = [];
  let currentChunk = [];
  let currentSize = 0;

  // Detect function boundaries: line starts with a non-space, non-#, non-/ char,
  // contains '(' and the next line or same line has '{'
  const isFuncStart = (i) => {
    const line = lines[i];
    if (!line || /^[\s#\/\*{}]/.test(line)) return false;
    if (line.includes('(') && (line.includes('{') || (lines[i + 1] && lines[i + 1].trim() === '{'))) {
      return true;
    }
    return false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineSize = line.length + 1; // +1 for newline

    // If adding this line would exceed limit AND we're at a function boundary, split
    if (currentSize + lineSize > charLimit && currentChunk.length > 0 && isFuncStart(i)) {
      chunks.push(currentChunk.join('\n'));
      currentChunk = [];
      currentSize = 0;
    }

    currentChunk.push(line);
    currentSize += lineSize;
  }

  if (currentChunk.length) {
    chunks.push(currentChunk.join('\n'));
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// 4. executeBatch — Call LLM CLI (async)
// ---------------------------------------------------------------------------

function assemblePrompt(batch, staticCtx, template) {
  // Build C file contents section
  let cContent;
  if (batch.preloadedContent) {
    cContent = `### \`${batch.files[0]}\`\n\`\`\`c\n${batch.preloadedContent}\n\`\`\``;
  } else {
    const sections = [];
    for (const f of batch.files) {
      const fullPath = path.join(POKEEMERALD, f);
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        sections.push(`### \`${f}\`\n\`\`\`c\n${content}\n\`\`\``);
      } catch {
        sections.push(`### \`${f}\`\n*File not readable*`);
      }
    }
    cContent = sections.join('\n\n');
  }

  return template
    .replace('{{TS_FILE_TREE}}', staticCtx.tsFileTree)
    .replace('{{GENERATED_FILES}}', staticCtx.generatedFilesList)
    .replace('{{GENERATOR_MANIFEST}}', staticCtx.generatorManifest)
    .replace('{{C_FILE_CONTENTS}}', cContent);
}

/** Promise wrapper around child_process.execFile */
function execFileAsync(cmd, args, options) {
  return new Promise((resolve, reject) => {
    const child = execFile(cmd, args, options, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout);
    });
    if (options.input) {
      child.stdin.write(options.input);
      child.stdin.end();
    }
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function executeBatchAsync(prompt, opts) {
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (opts.backend === 'claude') {
        return await executeClaudeAsync(prompt, opts);
      } else {
        return await executeCodexAsync(prompt, opts);
      }
    } catch (err) {
      const msg = err.message || String(err);
      console.error(`  Attempt ${attempt}/${maxRetries} failed: ${msg.slice(0, 200)}`);
      if (attempt < maxRetries) {
        const backoff = opts.delay * Math.pow(2, attempt - 1);
        console.log(`  Retrying in ${backoff}ms...`);
        await sleep(backoff);
      } else {
        throw err;
      }
    }
  }
}

async function executeClaudeAsync(prompt, opts) {
  const result = await execFileAsync('claude', [
    '-p',
    '--model', opts.model,
    '--output-format', 'json',
    '--no-session-persistence',
    '--append-system-prompt', 'Respond ONLY with the markdown analysis. No preamble.',
  ], {
    input: prompt,
    maxBuffer: 50 * 1024 * 1024,
    timeout: 5 * 60 * 1000,
    encoding: 'utf-8',
    cwd: ROOT,
  });

  try {
    const parsed = JSON.parse(result);
    return parsed.result || parsed.content || result;
  } catch {
    return result;
  }
}

async function executeCodexAsync(prompt, opts) {
  return await execFileAsync('codex', [
    'exec',
    '-c', `model=${opts.model}`,
    '-c', 'model_reasoning_effort=medium',
    '--sandbox', 'read-only',
    '--ephemeral',
  ], {
    input: prompt,
    maxBuffer: 50 * 1024 * 1024,
    timeout: 5 * 60 * 1000,
    encoding: 'utf-8',
    cwd: ROOT,
  });
}

// ---------------------------------------------------------------------------
// 5. Resume support — check already-processed sections
// ---------------------------------------------------------------------------

function getProcessedLabels() {
  if (!fs.existsSync(OUTPUT_FILE)) return new Set();

  const content = fs.readFileSync(OUTPUT_FILE, 'utf-8');
  const labels = new Set();
  // Match "## batch: <label>" headers we write
  const matches = content.matchAll(/^## batch: (.+)$/gm);
  for (const m of matches) {
    labels.add(m[1]);
  }
  return labels;
}

// ---------------------------------------------------------------------------
// 6. appendResults — Write incrementally
// ---------------------------------------------------------------------------

function initOutputFile(opts) {
  if (fs.existsSync(OUTPUT_FILE) && opts.resume) {
    console.log(`Resuming — appending to existing ${path.relative(ROOT, OUTPUT_FILE)}`);
    return;
  }

  const header = `# C-to-TypeScript Coverage Report
Generated: ${new Date().toISOString().slice(0, 10)} | Backend: ${opts.backend} (${opts.model})

---

`;
  fs.writeFileSync(OUTPUT_FILE, header);
}

function appendResults(label, markdown) {
  const section = `\n## batch: ${label}\n\n${markdown.trim()}\n`;
  fs.appendFileSync(OUTPUT_FILE, section);
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseArgs();

  console.log(`Coverage Agent — backend: ${opts.backend}, model: ${opts.model}, concurrency: ${opts.concurrency}`);
  console.log(`Char limit per batch: ${(opts.charLimit / 1000).toFixed(0)}K (~${(opts.charLimit / 4000).toFixed(0)}K tokens)`);
  console.log();

  // Build static context
  const staticCtx = buildStaticContext();
  const template = fs.readFileSync(PROMPT_TEMPLATE, 'utf-8');
  console.log();

  // Discover and group files
  const groups = discoverAndGroupFiles();
  console.log(`Discovered ${groups.length} file groups`);

  // Plan batches
  const batches = planBatches(groups, opts.charLimit, opts.folders);
  console.log(`Planned ${batches.length} batches`);

  // Get already-processed labels for resume
  const processedLabels = opts.resume ? getProcessedLabels() : new Set();
  if (processedLabels.size) {
    console.log(`Resume: ${processedLabels.size} batches already processed`);
  }

  // Filter out already-processed batches
  const pendingBatches = batches.filter(b => !processedLabels.has(b.label));
  const limitedBatches = opts.limit > 0 ? pendingBatches.slice(0, opts.limit) : pendingBatches;

  console.log(`Pending: ${pendingBatches.length} batches (processing: ${limitedBatches.length})`);
  console.log();

  // Dry run: print batch plan and exit
  if (opts.dryRun) {
    console.log('=== Batch Plan ===\n');
    for (let i = 0; i < batches.length; i++) {
      const b = batches[i];
      const status = processedLabels.has(b.label) ? ' [DONE]' : '';
      const tokens = (b.totalChars / 4).toFixed(0);
      console.log(`  ${String(i + 1).padStart(3)}. ${b.label}${status}`);
      console.log(`       ${b.files.length} file(s), ~${(b.totalChars / 1024).toFixed(1)}KB (~${tokens} tokens)`);
      if (b.files.length <= 5) {
        for (const f of b.files) console.log(`         - ${f}`);
      } else {
        for (const f of b.files.slice(0, 3)) console.log(`         - ${f}`);
        console.log(`         ... and ${b.files.length - 3} more`);
      }
    }

    const totalChars = batches.reduce((s, b) => s + b.totalChars, 0);
    console.log(`\n  Total: ${batches.length} batches, ~${(totalChars / 1024 / 1024).toFixed(1)}MB C source`);
    const estCost = batches.length * 0.035;
    console.log(`  Estimated cost (Sonnet): ~$${estCost.toFixed(2)}`);
    const seqMinutes = (batches.length * (opts.delay / 1000 + 15)) / 60;
    const parMinutes = seqMinutes / opts.concurrency;
    console.log(`  Estimated time: ~${parMinutes.toFixed(0)} min (concurrency=${opts.concurrency})`);
    return;
  }

  // Initialize output file
  initOutputFile(opts);

  // Process batches in waves of `concurrency`
  let processed = 0;
  let errors = 0;

  for (let waveStart = 0; waveStart < limitedBatches.length; waveStart += opts.concurrency) {
    const wave = limitedBatches.slice(waveStart, waveStart + opts.concurrency);
    const waveNum = Math.floor(waveStart / opts.concurrency) + 1;
    const totalWaves = Math.ceil(limitedBatches.length / opts.concurrency);

    console.log(`=== Wave ${waveNum}/${totalWaves} (${wave.length} batches) ===`);

    // Launch all batches in this wave concurrently
    const promises = wave.map(async (batch, i) => {
      const idx = waveStart + i + 1;
      const tag = `[${idx}/${limitedBatches.length}]`;
      console.log(`${tag} Starting: ${batch.label} (${batch.files.length} files, ~${(batch.totalChars / 1024).toFixed(1)}KB)`);

      const prompt = assemblePrompt(batch, staticCtx, template);

      try {
        const result = await executeBatchAsync(prompt, opts);
        console.log(`${tag} Done: ${batch.label} (${result.length} chars)`);
        return { label: batch.label, result, error: null };
      } catch (err) {
        console.error(`${tag} FAILED: ${batch.label} — ${err.message?.slice(0, 200)}`);
        return { label: batch.label, result: null, error: err };
      }
    });

    // Wait for entire wave to finish
    const results = await Promise.all(promises);

    // Write results in order
    for (const r of results) {
      processed++;
      if (r.error) {
        errors++;
        const errMsg = `*Error processing this batch: ${(r.error.message || String(r.error)).slice(0, 200)}*`;
        appendResults(r.label, errMsg);
      } else {
        appendResults(r.label, r.result);
      }
    }

    console.log(`  Wave ${waveNum} complete.\n`);

    // Delay between waves (not after the last one)
    if (waveStart + opts.concurrency < limitedBatches.length) {
      await sleep(opts.delay);
    }
  }

  console.log();
  console.log(`Complete! Processed ${processed} batches (${errors} errors)`);
  console.log(`Output: ${path.relative(ROOT, OUTPUT_FILE)}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
