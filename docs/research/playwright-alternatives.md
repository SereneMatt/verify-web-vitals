# Playwright vs alternatives for verify-web-vitals

## Verdict

**Playwright was the right choice. Keep it.** Every metric this tool reports comes from CDP plus the `web-vitals` library, not from the automation layer. Any Chromium driver therefore produces the same numbers under the same flags. The repo's throttle already matches Lighthouse's DevTools mode: the same CDP calls and the same constants. What Playwright adds over the alternatives is a built-in, ffmpeg-free `recordVideo` per context, cheap isolated contexts per width, and first-class context options for headers, locale, time zone and HTTPS errors. Each alternative loses on at least one of the four success criteria.

Change two things, both inside Playwright:

1. **Launch the benchmark runs in new headless, not headless shell.** `chromium.launch()` with no `channel` runs `chromium-headless-shell` (verified in source). Playwright's own docs say the shell is less "authentic" than new headless, which is "the real Chrome browser". Passing `channel: 'chromium'` switches to new headless. The binary is already installed by `playwright install chromium`. This brings the browser closer to the Chrome that CrUX field data and Lighthouse measure. Whether it moves the vitals is unmeasured; see Open questions.
2. **Say plainly in the conditions line what the throttle does not cover.** CDP `Network.emulateNetworkConditions` is request-level and scoped to one target session. It does not cover service-worker targets (WebdriverIO's source documents this) and, by inference, out-of-process iframes. No driver fixes this. Only packet-level shaping does (Lighthouse `docs/throttling.md`).

Optional, separate from the driver choice: if "comparable to Lighthouse mobile" is a goal, `--throttle` should also emulate Lighthouse's mobile screen (412×823, DPR 1.75, mobile, touch) and UA. Today it emulates only network and CPU. Playwright already supports these through `isMobile`, `deviceScaleFactor`, `hasTouch` and `userAgent` context options.

## Comparison

| Candidate                                | CPU + network throttle                                                                  | Video                                                                        | Script before navigation                | Multi-viewport                                   | Engines                                                    | Release cadence (verified)                                                | Agent-CLI fit                                                                                              |
| ---------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Playwright 1.65.1** (current)          | CDP via `newCDPSession`, Chromium only. Same as Lighthouse `devtools`                   | `recordVideo` per context, webm, bundled ffmpeg                              | `addInitScript`                         | One context per width, cheap                     | Chromium, Firefox, WebKit (CDP and throttle Chromium-only) | 1.62.1 → 1.65.1 between 2026-07-30 and 2026-11-13                         | Good: the repo owns the output                                                                             |
| Puppeteer 25.19.0                        | `emulateCPUThrottling`, `emulateNetworkConditions` (CDP)                                | `screencast()` deprecated, needs system ffmpeg. `record()` experimental, mp4 | `evaluateOnNewDocument`                 | `browser.createBrowserContext()` + `setViewport` | Chrome; Firefox over BiDi (no throttle)                    | Several releases per month (25.18.0 to 25.19.0, 2026-11-17 to 2026-11-25) | Equal, but costs a rewrite and loses ffmpeg-free video                                                     |
| Raw CDP (chrome-remote-interface 0.34.0) | Same CDP calls                                                                          | DIY: encode `Page.screencastFrame` yourself                                  | `Page.addScriptToEvaluateOnNewDocument` | DIY `Target.createBrowserContext`                | Chromium                                                   | Last commit 2026-02-09                                                    | Worse: rebuilds Playwright. Playwright's `newCDPSession` already gives raw CDP where needed                |
| Lighthouse 13.6.0 user flows             | `simulate` (Lantern), `devtools` or `provided`. **Timespan forces `devtools`**          | None (screenshots and filmstrip only)                                        | Through the Puppeteer page              | One flow per config                              | Chrome only                                                | About monthly (13.3.0 to 13.6.0, May to Oct 2026)                         | Poor: requires a Puppeteer page, LCP only in navigation mode, INP only in timespan mode, large JSON report |
| WebdriverIO 10.2.0                       | `throttleCPU` / `throttleNetwork` open a **Puppeteer** CDP session                      | Through services/reporters (not evaluated)                                   | Through BiDi `script.addPreloadScript`  | Yes                                              | All WebDriver browsers; throttle Chromium-only             | Several per month                                                         | Worse: a WebDriver layer on top of the same CDP calls                                                      |
| Selenium 4.54.0 (BiDi)                   | BiDi: offline only, no CPU. CDP is "temporary" and version-coupled                      | BiDi `browsingContext.startScreencast` is in the spec draft                  | `script.addPreloadScript`               | Yes                                              | All                                                        | Weekly-ish (4.50 to 4.54, Sept to Nov 2026)                               | Worse: no standard throttle                                                                                |
| Cypress 16.4.0                           | No first-class CPU/network throttle (not found in docs)                                 | Video off by default, per spec file, `cypress run` only                      | Runs in the browser                     | One viewport per test                            | Chromium, Firefox, WebKit (experimental)                   | Several per month                                                         | Poor: the app under test runs **inside an iframe** next to the test runner, which skews vitals             |
| chrome-devtools-mcp 1.14.0               | `emulate` with `cpuThrottlingRate` and named `networkConditions` (Puppeteer underneath) | `screencast_start/stop`, mp4                                                 | No init-script tool listed              | `resize_page` / `emulate viewport`               | Chrome                                                     | Weekly to fortnightly                                                     | Wrong shape: interactive, multi-call, token-heavy. Good for diagnosis, not for a deterministic gate        |
| Playwright MCP 0.0.86                    | **None** (online/offline only)                                                          | `browser_start_video` / `stop_video`                                         | `--init-script`                         | `--viewport-size`, `--device`                    | Chromium, Firefox, WebKit                                  | About weekly                                                              | Wrong shape, and no throttle                                                                               |

## Findings by candidate

### Playwright (current)

- The repo throttles with `Emulation.setCPUThrottlingRate` and `Network.emulateNetworkConditions` over `newCDPSession` (`scripts/benchmark.mjs:9-19`). It records video only in the evidence run (`scripts/journey.mjs:56-60`), which keeps screencast overhead out of the benchmark. Vitals come from `web-vitals` 6.2.3 through `addInitScript` (`scripts/benchmark.mjs:62`, `scripts/vitals.mjs:23-30`).
- Default headless uses the shell binary. `getExecutableName` returns `options.headless ? "chromium-headless-shell" : "chromium"` unless a `channel` is set (`node_modules/playwright-core/lib/coreBundle.js`, 1.65.1). The docs describe opting into new headless with `channel: 'chromium'` and quote Chrome's description of the shell vs "the real Chrome browser" (microsoft/playwright `docs/src/browsers.md` @ v1.65.1, sections "Chromium: headless shell" and "Chromium: new headless mode"). `browsers.json` installs both `chromium` and `chromium-headless-shell` 159.0.8154.6 by default.
- Launch switches that differ from stock Chrome: `--disable-features=…PaintHolding…`, `--disable-back-forward-cache`, `--disable-renderer-backgrounding`, `--disable-background-timer-throttling`, `--disable-ipc-flooding-protection`. Headless also adds `--blink-settings=primaryHoverType=2,…primaryPointerType=4…` (`chromiumSwitches` in `coreBundle.js`). Puppeteer 25.19.0 (`packages/puppeteer-core/src/node/ChromeLauncher.ts`) and chrome-launcher (`src/flags.ts` @ `61143b6`, used by Lighthouse) share the backgrounding and IPC flags but **do not** disable PaintHolding.
  - _Inference:_ Paint holding affects same-origin navigations. The benchmark navigates from `about:blank` in a fresh context, so its effect on LCP here is probably nil. Not measured.
- `CDPSession` works only on Chromium-based browsers (`docs/src/api/class-cdpsession.md` @ v1.65.1). Throttling therefore cannot move to Firefox or WebKit under any driver; see the BiDi finding below.
- Video: saved when the context closes. Default size is the viewport scaled to fit 800×800; the repo sets `size: viewport` explicitly (`docs/src/videos.md` @ v1.65.1). Under the hood it is CDP `Page.startScreencast` with JPEG frames (`coreBundle.js`).
- Cadence: v1.62.1 (2026-07-30) through v1.65.1 (2026-11-13), from `gh release list -R microsoft/playwright`.

### Puppeteer

- It has the same primitives: `emulateCPUThrottling`, `emulateNetworkConditions` and `evaluateOnNewDocument` (`packages/puppeteer-core/src/api/Page.ts` @ puppeteer-v25.19.0).
- Video is weaker. `page.screencast()` is `@deprecated Use Page.record` and "You must have ffmpeg installed on your system". `page.record()` is `@experimental`, mp4, built on CDP `Page.startScreenRecording` (same file). The repo would also have to rework `frame.mjs`, which decodes webm.
- Default headless is new headless (`'--headless=new'`, full Chrome binary). `headless: 'shell'` opts into the shell (`ChromeLauncher.ts`, `BrowserLauncher.ts` @ puppeteer-v25.19.0). That is the one fidelity default it gets right out of the box, and Playwright gets the same with one option.
- Verdict: a lateral move that costs a rewrite and loses ffmpeg-free webm.

### Raw CDP

- chrome-remote-interface: latest tag v0.34.0, last commit 2026-02-09 (GitHub API).
- _Inference:_ every capability the repo needs is plain CDP. Going raw means reimplementing contexts, auto-waiting `click`/`dragAndDrop`, `exposeFunction`, and webm encoding of screencast frames, which is most of `journey.mjs`'s implicit dependencies. The repo already drops to raw CDP where it matters, through `newCDPSession`.

### Lighthouse user flows / timespan

- `startFlow(page, …)` takes `LH.Puppeteer.Page` (`core/index.js` @ v13.6.0), so it cannot drive a Playwright page.
- Timespan mode silently converts `simulate` to `devtools` throttling (`overrideSettingsForGatherMode`, `core/config/config.js:183-189` @ v13.6.0). Lantern simulation is therefore unavailable for interaction journeys. Devtools throttling uses the same two CDP commands as this repo (`core/lib/emulation.js:129-155` @ v13.6.0).
- The LCP audit has `supportedModes: ['navigation']` and the INP audit has `['timespan']` (`core/audits/metrics/largest-contentful-paint.js:29`, `interaction-to-next-paint.js:33`). The docs say timespan "Cannot analyze moment-based performance metrics (e.g. Largest Contentful Paint)" (`docs/user-flows.md:24`). Getting all three vitals for one journey takes a navigation step plus a timespan step.
- The repo's `--throttle` constants equal Lighthouse's `mobileSlow4G` DevTools-adjusted values: RTT 150×3.75 = 562.5 ms, 1.6×1024×0.9 = 1474.56 Kbps, 750×0.9 = 675 Kbps, CPU 4× (ChromeDevTools/devtools-frontend `front_end/models/trace/lantern/simulation/Constants.ts` @ `9f9f40ba5b`; Lighthouse re-exports it, `core/config/constants.js:10,62`).
- Lighthouse's mobile defaults also emulate a 412×823 screen at DPR 1.75 with a mobile UA (`core/config/constants.js:14-23,42`). The repo does not.
- Lighthouse's own doc calls request-level ("DevTools") throttling "not highly accurate", and says packet-level shaping is the most accurate option (`docs/throttling.md` @ v13.6.0).
- Verdict: useful as a cross-check, not as the driver. It needs Puppeteer, has no video, and produces a large report.

### WebdriverIO

- `throttleCPU` and `throttleNetwork` call `this.getPuppeteer()` and send the same CDP commands. The docs note they need CDP and "can not be used when running automated tests in the cloud" (`packages/webdriverio/src/commands/browser/throttleCPU.ts`, `throttleNetwork.ts` @ v10.2.0).
- `throttleNetwork.ts` documents that `Network.emulateNetworkConditions` "is scoped to the CDP session", so "requests initiated by a service worker … bypass the page level emulation". WebdriverIO patches registered workers. This repo's single page session (`benchmark.mjs:10`) has the same gap.

### Selenium / WebDriver BiDi

- The BiDi spec (w3c/webdriver-bidi `index.bs` @ `5931e50`, 2026-11-26) defines `emulation.setNetworkConditions` with only `NetworkConditionsOffline`. It has no CPU throttling. It does define `script.addPreloadScript`, `network.setExtraHeaders`, `emulation.setLocaleOverride`, `emulation.setTimezoneOverride`, `browsingContext.setViewport` and `browsingContext.startScreencast`.
- Selenium docs: CDP support "is temporary until WebDriver BiDi has been implemented", and CDP "is not designed for testing, nor to have a stable API" (SeleniumHQ/seleniumhq.github.io `…/webdriver/bidi/cdp/_index.en.md` @ trunk).
- Verdict: cross-engine reach is real, but the throttling this tool needs exists only through CDP. BiDi cannot meet the throttle requirement today.

### Cypress

- "Cypress uses an `iframe` to load the application under test" (cypress-documentation `docs/api/commands/window.mdx:208` @ `f80b926`). Test code runs in the browser (`docs/app/core-concepts/trade-offs.mdx`).
- Video is disabled by default, one per spec file, `cypress run` only (`docs/app/run-tests/screenshots-and-videos.mdx:48-53`).
- _Inference:_ measuring LCP/CLS/INP of a page that sits in an iframe next to the runner's own UI and JS on the same main thread will not compare cleanly with field data. Ruled out.

### Agent-oriented: chrome-devtools-mcp, Playwright MCP

- chrome-devtools-mcp 1.14.0 is built on Puppeteer 25.18.1 and Lighthouse 13.6.0 (`package.json`). It exposes `emulate` (`cpuThrottlingRate`, named `networkConditions` presets), `performance_start_trace`/`stop_trace`/`analyze_insight` for CWV insights, `lighthouse_audit` (which "excludes performance") and `screencast_start`/`stop` (mp4) (`docs/tool-reference.md` @ v1.14.0). It ships a CLI (`docs/cli.md`). Performance tools may send trace URLs to the CrUX API unless `--no-performance-crux` is set, and Google collects usage statistics (`README.md`).
- Playwright MCP 0.0.86 has video (`browser_start_video`), `--init-script`, `--viewport-size` and `--device`, but network state is only online/offline (`browser_network_state_set`) and it has no CPU throttling (`README.md` @ v0.0.86).
- _Inference:_ both are built for exploratory, multi-call agent sessions. Each tool call returns structured text into the agent's context. That is the opposite of this tool's one-command, small, deterministic report. chrome-devtools-mcp complements it for diagnosing _why_ a vital failed, through trace insights. It cannot replace it.

### Cross-engine reach

- `web-vitals` 6.2.3: `onCLS()` is Chromium-only; `onLCP()` and `onINP()` work in Chromium, Firefox and Safari (`README.md` "Browser Support" @ v6.2.3).
- Combined with CDP-only throttling (above), a non-Chromium run could report at most unthrottled LCP and INP. _Inference:_ CrUX field data comes from Chrome, so Chromium is the right engine for "comparable to field data". Cross-engine reach is not worth paying for in a driver choice.

## Open questions

1. **Shell vs new headless delta.** Run the flip-squares example `--runs 10` both ways and compare LCP/INP medians. That decides whether change 1 is a fidelity fix or only a correctness hygiene item. Startup time per launch should be compared in the same run; no primary source gives numbers.
2. **Service workers and OOPIFs under `--throttle`.** Confirm with a fixture whether SW-served or cross-site-iframe requests escape throttling. If they do, apply `Network.emulateNetworkConditions` per target via `Target.setAutoAttach`, or disclose it in the conditions line.
3. **Mobile emulation.** Should `--throttle` imply Lighthouse's mobile screen and UA, or stay width-only? This is a product decision. It affects comparability with Lighthouse and PSI more than any driver choice does.
4. **Paint holding.** Playwright disables it and Puppeteer and chrome-launcher do not. It is probably irrelevant for `about:blank` → URL navigation, but a journey that navigates same-origin mid-run (MPA flows) could differ from real Chrome.
