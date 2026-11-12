#!/usr/bin/env node
// ============================================================================
// Anki Studio — Frontend Unit Suite Runner
//
// Why a bundler step instead of plain `node --test`: the frontend lives in
// `frontend/src` and uses bundler-style extensionless imports plus `.tsx`, which
// Node's ESM resolver and type-stripping cannot execute on their own. Rather
// than adding vitest/jest/jsdom (a large new dependency tree for a plugin that
// ships no frontend test runner today), this runner borrows the esbuild copy
// that Vite already installs under `frontend/node_modules`:
//
//   suite.ts ──esbuild bundle(platform=node, format=cjs)──▶  temp .cjs
//                                                              │
//                                                        node (run)
//
// Result: zero new dependencies, works on any Node version Vite 6 supports.
// ============================================================================

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ADDON_ROOT = path.resolve(HERE, '..', '..');
const FRONTEND_MODULES = path.join(ADDON_ROOT, 'frontend', 'node_modules');
const ESBUILD_ENTRY = path.join(FRONTEND_MODULES, 'esbuild', 'lib', 'main.js');
const ENTRY = path.join(HERE, 'suite.ts');

function fail(message, error) {
  console.error(`[frontend-unit] ${message}`);
  if (error) {
    console.error(error);
  }
  process.exitCode = 1;
}

if (!fs.existsSync(ESBUILD_ENTRY)) {
  fail(
    `esbuild not found at ${ESBUILD_ENTRY}. Run \`cd frontend && npm install\` first ` +
      '(the suite reuses the Vite dependency tree instead of adding its own).'
  );
  process.exit();
}

let esbuild;
try {
  esbuild = createRequire(import.meta.url)(ESBUILD_ENTRY);
} catch (error) {
  fail('failed to load esbuild', error);
  process.exit();
}

const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'anki-studio-fe-unit-'));
const outFile = path.join(outDir, 'suite.cjs');

try {
  esbuild.buildSync({
    entryPoints: [ENTRY],
    outfile: outFile,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node18',
    logLevel: 'warning',
    // `react` / `react-dom` / `lucide-react` live in frontend/node_modules, which
    // is not an ancestor of tests/frontend, so tell esbuild where to look.
    nodePaths: [FRONTEND_MODULES],
  });

  await import(pathToFileURL(outFile).href);
} catch (error) {
  fail('failed to build or run the frontend unit suite', error);
} finally {
  fs.rmSync(outDir, { recursive: true, force: true });
}
