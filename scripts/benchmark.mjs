import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { openPage, runJourney } from './journey.mjs';

// Lighthouse's mobileSlow4G preset, with the DevTools adjustments Lighthouse applies for protocol-level throttling.
export const throttle = { cpu: 4, latencyMs: 562.5, downloadKbps: 1474.56, uploadKbps: 675 };
const applyThrottle = async (page) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle.cpu });
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: throttle.latencyMs,
    downloadThroughput: (throttle.downloadKbps * 1024) / 8,
    uploadThroughput: (throttle.uploadKbps * 1024) / 8
  });
};

const benchmarkKey = (options, width) =>
  JSON.stringify({
    url: options.url,
    width,
    height: options.height,
    waitFor: options.waitFor ?? null,
    runs: options.runs,
    throttle: options.throttle,
    timezone: options.timezone ?? null,
    locale: options.locale ?? null,
    headers: options.headers ? createHash('sha256').update(JSON.stringify(options.headers)).digest('hex') : null
  });

export const loadSavedBenchmarks = async (file) => {
  if (!existsSync(file)) {
    return {};
  }
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch (error) {
    console.error(`${file} ignored: ${error.message}`);
  }
  return {};
};

const benchmarkRuns = async (session, width) => {
  const { browser, options, vitalsScript } = session;
  const samples = [];
  for (let run = 0; run < options.runs; run++) {
    const context = await browser.newContext({
      ...options.contextOptions,
      viewport: { width, height: options.height }
    });
    const page = await openPage(context);
    try {
      if (options.throttle) {
        await applyThrottle(page);
      }
      await page.addInitScript({ content: vitalsScript });
      await runJourney(page, session, 'clean');
      await page.evaluate('window.__verifyVitalsSettled(1000)');
      samples.push(await page.evaluate('window.__verifyVitals'));
    } catch (error) {
      samples.push({});
      console.error(`${width}px clean run ${run + 1}: ${error.message}`);
    }
    await context.close();
  }
  return samples;
};

export const benchmarkWidths = async (session, conditions, saved) => {
  const { options } = session;
  // Benchmark runs go one at a time so they do not compete for CPU; evidence runs measure nothing and share it.
  const benchmarks = [];
  for (const width of options.widths) {
    const key = benchmarkKey(options, width);
    const entry = options.reuseBenchmark ? saved[key] : undefined;
    if (entry) {
      benchmarks.push({
        width,
        samples: entry.samples,
        conditions: `${entry.conditions} · reused from benchmark.json (${entry.recordedAt})`
      });
      continue;
    }
    const samples = await benchmarkRuns(session, width);
    // A failed run leaves an empty sample; measure again next time instead of reusing it.
    if (samples.every((sample) => Object.keys(sample).length > 0)) {
      saved[key] = { samples, conditions, recordedAt: new Date().toISOString() };
    }
    benchmarks.push({ width, samples, conditions });
  }
  if (options.recordVideo) {
    await writeFile(path.join(options.out, 'benchmark.json'), `${JSON.stringify(saved, null, 2)}\n`);
  }
  return benchmarks;
};
