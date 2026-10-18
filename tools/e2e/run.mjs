#!/usr/bin/env node
// Runs every end-to-end suite against the app in a real Chromium, fully offline.
//   node tools/e2e/run.mjs            -> all suites
//   node tools/e2e/run.mjs backup     -> only suites whose file name contains "backup"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { startServer, launch } from './lib.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const only = process.argv[2];
const files = fs.readdirSync(dir).filter(f => /^suite-.*\.mjs$/.test(f) && (!only || f.includes(only))).sort();
if (!files.length) { console.error(`no suite matches "${only}"`); process.exit(2); }

const server = await startServer();
let browser, totalPass = 0, totalFail = 0;
try {
  browser = await launch();
  for (const f of files) {
    const mod = await import(pathToFileURL(path.join(dir, f)).href);
    console.log(`\n▶ ${mod.name}`);
    let pass = 0, fail = 0;
    const check = (label, ok, extra = '') => { ok ? pass++ : fail++; console.log(`  ${ok ? '✓' : '✗'} ${label}${!ok && extra ? `  — ${extra}` : ''}`); };
    try { await mod.run({ browser, url: server.url, check }); }
    catch (e) { fail++; console.log(`  ✗ suite crashed: ${e.message.split('\n')[0]}`); }
    totalPass += pass; totalFail += fail;
  }
} finally { await browser?.close(); await server.close(); }
console.log(`\n${totalFail ? '✗' : '✓'} ${totalPass} passed, ${totalFail} failed`);
process.exit(totalFail ? 1 : 0);
