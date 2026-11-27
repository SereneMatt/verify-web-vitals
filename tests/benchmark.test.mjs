import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { chromium } from 'playwright-core';

const exec = promisify(execFile);

test('benchmark rows respect supplied results, fit mobile, and survive the display loop', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
    await page.setContent('<body><h1>Page under test</h1></body>');
    const source = (await readFile('scripts/verify.js', 'utf8')).trim().replace(/;$/, '');
    const benchmark = {
      conditions: 'median · not throttled · headless Chromium · web-vitals',
      vitals: [
        { name: 'LCP', status: 'measured', median: 100, worst: 120, budget: 50, pass: false },
        {
          name: 'INP',
          status: 'not-applicable',
          pass: true,
          text: 'INP Not applicable — explicitly excluded for this journey'
        },
        { name: 'CLS', status: 'unavailable', pass: false, text: 'CLS unavailable in 1/3 runs ≤0.1 ❌' }
      ]
    };
    await page.evaluate(`(${source})(() => {}, 'evidence', ${JSON.stringify(benchmark)})`);
    assert.equal(await page.locator('[data-metric="LCP"]').isVisible(), false);
    await page.evaluate(() => window.verify.summary('Benchmark complete'));
    await page.waitForTimeout(100);
    const lcp = await page.locator('[data-metric="LCP"]').innerText();
    assert.match(lcp, /100ms ❌/);
    assert.match(lcp, /120ms worst · budget ≤50ms/);
    assert.match(await page.locator('[data-metric="INP"]').innerText(), /Not applicable/);
    assert.match(await page.locator('[data-metric="CLS"]').innerText(), /Unavailable ❌/);
    assert.doesNotMatch(await page.locator('body').innerText(), /⏳/);
    for (const element of await page.locator('[data-metric], [data-summary]').all()) {
      const box = await element.boundingBox();
      assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= 390 && box.y + box.height < 900);
    }
  } finally {
    await browser.close();
  }
});

test('passive journeys fail missing INP unless explicitly excluded; custom budgets fail', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'verify-vitals-test-'));
  try {
    const checks = path.join(dir, 'checks.js');
    await writeFile(
      checks,
      "(verify) => { verify.check('content', () => ({pass: true})); return async () => { await verify.sleep(100); }; }"
    );
    const url = 'data:text/html,' + encodeURIComponent('<h1>Benchmark fixture</h1><p>Static content</p>');
    const args = [
      'scripts/record.mjs',
      '--url',
      url,
      '--widths',
      '390',
      '--checks',
      checks,
      '--runs',
      '1',
      '--no-video',
      '--out',
      dir
    ];
    await assert.rejects(exec(process.execPath, args), (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stdout, /INP unavailable/);
      return true;
    });
    const excluded = await exec(process.execPath, [...args, '--inp-not-applicable']);
    assert.match(excluded.stdout, /INP Not applicable/);
    assert.match(excluded.stdout, /LCP .*✅/);
    assert.match(excluded.stdout, /CLS .*✅/);
    await assert.rejects(exec(process.execPath, [...args, '--inp-not-applicable', '--budget-lcp', '0']), (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stdout, /LCP .*≤0ms ❌/);
      return true;
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
