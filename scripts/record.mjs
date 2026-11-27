#!/usr/bin/env node
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { benchmarkWidths, loadSavedBenchmarks, throttle } from './benchmark.mjs';
import { evidenceRuns } from './journey.mjs';
import { parseOptions } from './options.mjs';
import { loadChromium, readExpression, setupHint, skillDir } from './playwright.mjs';
import { printReport } from './report.mjs';
import { loadVitals } from './vitals.mjs';

const options = parseOptions();
const verifySource = await readExpression(path.join(skillDir, 'scripts', 'verify.js'));
const checksSource = await readExpression(options.checks);
const vitals = await loadVitals();

const chromium = loadChromium();
let browser;
try {
  browser = await chromium.launch();
} catch (error) {
  console.error(`Chromium did not launch: ${error.message.split('\n')[0]}\n${setupHint}`);
  process.exit(2);
}
const { runs } = options;
const conditions = [
  `${runs} benchmark ${runs === 1 ? 'run' : 'runs'} (no overlay, no recording, cold cache)`,
  options.throttle
    ? `throttled: CPU ${throttle.cpu}×, ${throttle.latencyMs}ms latency, ${throttle.downloadKbps}/${throttle.uploadKbps} Kbps`
    : 'not throttled',
  `headless Chromium ${browser.version()}`,
  `web-vitals ${vitals.version}`,
  ...(options.timezone ? [`timezone ${options.timezone}`] : []),
  ...(options.locale ? [`locale ${options.locale}`] : []),
  // Names only: header values can be credentials, and this line is printed and recorded.
  ...(options.headers ? [`headers ${Object.keys(options.headers).join(', ')}`] : [])
].join(' · ');

const session = { browser, options, verifySource, checksSource, vitalsScript: vitals.script };
const saved = await loadSavedBenchmarks(path.join(options.out, 'benchmark.json'));

let rows;
try {
  await mkdir(options.out, { recursive: true });
  const benchmarks = await benchmarkWidths(session, conditions, saved);
  rows = await evidenceRuns(session, benchmarks);
} catch (error) {
  console.error(`Runner failed: ${error.message}`);
  await browser.close();
  process.exit(2);
}
await browser.close();

process.exit(printReport(rows) ? 1 : 0);
