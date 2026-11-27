import os from 'node:os';
import path from 'node:path';
import { summarizeVitals } from './vitals.mjs';

export const consentDialogs = [
  { vendor: 'OneTrust', selector: '#onetrust-consent-sdk' },
  { vendor: 'Cookiebot', selector: '#CybotCookiebotDialog' },
  { vendor: 'Didomi', selector: '#didomi-host' }
];

export const openPage = async (context) => {
  const page = await context.newPage();
  await page.exposeFunction('verifyAct', async (action, selector, target) => {
    const actions = {
      click: () => page.click(selector),
      hover: () => page.hover(selector),
      drag: () => page.dragAndDrop(selector, target),
      press: () => page.keyboard.press(selector)
    };
    if (!actions[action]) {
      throw new Error(`verify.act: unknown action "${action}"`);
    }
    await actions[action]();
  });
  return page;
};

export const runJourney = async (page, session, mode, benchmark = null, recording = false) => {
  const { options, verifySource, checksSource } = session;
  await page.goto(options.url, { waitUntil: 'load' });
  if (options.waitFor) {
    await page.waitForSelector(options.waitFor, { state: 'attached', timeout: options.timeout });
  }
  if (mode === 'evidence' && options.hideConsent) {
    await page.addStyleTag({
      content: `${consentDialogs.map(({ selector }) => selector).join(',')}{display:none!important}`
    });
  }
  await page.evaluate(
    `(${verifySource})(${checksSource}, ${JSON.stringify(mode)}, ${JSON.stringify(benchmark)}, ${recording})`
  );
  let timer;
  const timedOut = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`checks did not finish within ${options.timeout}ms`)), options.timeout);
  });
  return Promise.race([page.evaluate('window.verify.run()'), timedOut]).finally(() => clearTimeout(timer));
};

const evidenceRun = async (session, width, vitals, benchmarkConditions) => {
  const { browser, options } = session;
  const { recordVideo, out } = options;
  const conditions = options.hideConsent
    ? `${benchmarkConditions} · consent dialogs hidden in the evidence run (${consentDialogs.map(({ vendor }) => vendor).join(', ')})`
    : benchmarkConditions;
  const viewport = { width, height: options.height };
  const context = await browser.newContext({
    ...options.contextOptions,
    viewport,
    ...(recordVideo ? { recordVideo: { dir: out, size: viewport } } : {})
  });
  const page = await openPage(context);
  let results;
  try {
    results = await runJourney(page, session, 'evidence', { vitals, conditions }, recordVideo);
    await page.evaluate(
      ([step, text]) => {
        window.verify.step(step);
        window.verify.summary(text);
      },
      [`${width}px · results`, 'Benchmark complete']
    );
    if (recordVideo) {
      await page.waitForTimeout(1500);
    }
  } catch (error) {
    results = { error: { pass: false, detail: error.message } };
    console.error(`${width}px evidence run: ${error.message}`);
  }
  let screenshotPath;
  if (!recordVideo) {
    screenshotPath = path.resolve(out, `${width}px.png`);
    try {
      await page.screenshot({ path: screenshotPath });
    } catch (error) {
      screenshotPath = undefined;
      console.error(`${width}px screenshot: ${error.message}`);
    }
  }

  const video = page.video();
  await context.close();
  let videoPath;
  if (video) {
    videoPath = path.resolve(out, `${width}px.webm`);
    await video.saveAs(videoPath);
    await video.delete();
  }
  return { width, results, vitals, videoPath, screenshotPath, conditions };
};

export const evidenceRuns = async (session, benchmarks) => {
  const concurrency = Math.min(benchmarks.length, Math.max(1, Math.floor(os.availableParallelism() / 2)));
  const rows = new Array(benchmarks.length);
  let next = 0;
  const worker = async () => {
    while (next < benchmarks.length) {
      const index = next++;
      const { width, samples, conditions } = benchmarks[index];
      rows[index] = await evidenceRun(session, width, summarizeVitals(samples, session.options), conditions);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return rows;
};
