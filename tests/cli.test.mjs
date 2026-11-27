import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

const exec = promisify(execFile);
const page = (html) => 'data:text/html,' + encodeURIComponent(html);

const dryRun = async (dir, checks, extra = []) => {
  const file = path.join(dir, 'checks.js');
  await writeFile(file, checks);
  const args = [
    'scripts/record.mjs',
    '--widths',
    '390',
    '--checks',
    file,
    '--runs',
    '1',
    '--no-video',
    '--inp-not-applicable',
    '--out',
    dir,
    ...extra
  ];
  try {
    return (await exec(process.execPath, args)).stdout;
  } catch (error) {
    return error.stdout;
  }
};

const withDir = async (run) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'verify-web-vitals-cli-'));
  try {
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};

test('each check prints its measured detail next to its status', () =>
  withDir(async (dir) => {
    const stdout = await dryRun(
      dir,
      `(verify) => {
        verify.check('heading text', () => ({ pass: true, detail: 'reads Hello' }));
        verify.check('width', () => ({ pass: false, detail: '412px > 390px' }));
        return async () => { await verify.logSettled('settled', () => ({ pass: true, detail: '3 items' })); };
      }`,
      ['--url', page('<h1>Hello</h1>')]
    );
    assert.match(stdout, /✅ heading text — reads Hello/);
    assert.match(stdout, /❌ width — 412px > 390px/);
    assert.match(stdout, /✅ settled — 3 items/);
  }));

test('--hide-consent hides consent dialogs in the evidence run and says so', () =>
  withDir(async (dir) => {
    const stdout = await dryRun(
      dir,
      `(verify) => {
        verify.check('dialogs', () => ({
          pass: true,
          detail: ['#onetrust-consent-sdk', '#CybotCookiebotDialog', '#didomi-host']
            .map((selector) => getComputedStyle(document.querySelector(selector)).display)
            .join(',')
        }));
        return async () => {};
      }`,
      [
        '--url',
        page(
          '<div id="onetrust-consent-sdk">a</div><div id="CybotCookiebotDialog">b</div><div id="didomi-host">c</div>'
        ),
        '--hide-consent'
      ]
    );
    assert.match(stdout, /dialogs — none,none,none/);
    assert.match(stdout, /consent dialogs hidden in the evidence run/);
  }));

test('verify.layoutShifts reports each shift with the elements that moved', () =>
  withDir(async (dir) => {
    const stdout = await dryRun(
      dir,
      `(verify) => {
        verify.check('shifts', () => {
          const shifts = verify.layoutShifts();
          const moved = shifts.flatMap((shift) => shift.sources.map((source) => source.selector));
          const total = shifts.reduce((sum, shift) => sum + shift.value, 0);
          return { pass: total > 0, detail: moved.join(' ') };
        });
        verify.check('above banner', () => ({ pass: true, detail: String(verify.layoutShifts(document.querySelector('#above')).length) }));
        return async () => { await verify.sleep(800); };
      }`,
      [
        '--url',
        page(`<p id="above">still</p><div id="banner"></div><p id="content" class="body copy">moves</p>
          <script>setTimeout(() => { document.getElementById('banner').style.height = '300px'; }, 300);</script>`)
      ]
    );
    assert.match(stdout, /✅ shifts — .*p#content\.body\.copy/);
    assert.match(stdout, /above banner — 0\n/);
  }));
