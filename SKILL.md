---
name: verify-web-vitals
description: Measure Core Web Vitals and record headless videos, one per viewport width, that prove a page meets its acceptance criteria.
disable-model-invocation: true
---

# Verify Web Vitals

Record one video per width in which every acceptance criterion is **verifiable** from the frames alone: a viewer reads the measured value and its ✅/❌ on screen, without trusting the narration. A clean run adds nothing visible to the page: it injects the vitals collector, plus the overlay and your checks in clean mode, which only drive the journey.

`scripts/record.mjs` drives headless Chromium. The checks for each task are yours to write.

## 1. Set up once

In this skill's folder: `bun install`, then `bunx playwright-core install chromium`.

Without a copy of the skill, `npx verify-web-vitals <options>` runs the same runner from npm, and `npx verify-web-vitals-frame` runs `frame.mjs`; install Chromium once with `npx -p verify-web-vitals playwright-core install chromium`, which matches the package's pinned Playwright.

Done when both commands exit 0.

## 2. Map criteria to observables

For every criterion, write down:

- **Observable**: the DOM value that proves it.
- **Unit**: the unit the criterion itself names. A proxy unit logs false ❌ on correct behaviour.
- **Widths**: both sides of every breakpoint the criterion names, plus one mobile and one wide width. Read breakpoint values from source.

Include the empty, loading, error, disabled, focus and overflow states the criteria touch. Clipping, overlap and focus visibility need a frame, not only a DOM value; mark those partial until you have inspected one.

Done when every criterion has an observable, a unit and a width list.

## 3. Write the checks file

One function expression in a scratchpad file.

Hide third-party widgets that cover the overlay or the element under test with `verify.hide(selector)`: the evidence run discloses it on screen and the clean runs keep the widget, so vitals measure the real page. For OneTrust, Cookiebot and Didomi consent dialogs, `--hide-consent` does the same without a selector and adds the disclosure to the conditions line.

For a layout-shift criterion, use `verify.layoutShifts(root)`. `performance.getEntriesByType('layout-shift')` returns nothing in Chromium, so a check built on it passes on an empty list.

## 4. Dry run

```sh
node <skill-dir>/scripts/record.mjs --url <url> --widths 390,719,720,1440 --checks <checks.js> --wait-for '<selector>' --no-video
```

It also saves `<out>/<width>px.png`, taken at the end of the journey, even when the journey fails.

Every check prints its `detail` next to its ✅ or ❌.

`--wait-for` is the element your checks query first.

Done when every width prints ✅ for every key and every required vital is available, with any INP exclusion reported, or each ❌ is a real defect you can explain in the criterion's unit. An unavailable required vital is a ❌. INP needs a qualifying interaction such as a click or keypress. For an intentionally passive journey, explicitly add `--inp-not-applicable` and report that exclusion; INP displays “Not applicable” and does not fail verification. The exit code is 0 only when all criteria and required vitals pass.

## 5. Record and report

The same command without `--no-video`, plus `--out <dir>`. The clean-run samples are saved to `<dir>/benchmark.json`, keyed by URL, viewport, `--wait-for`, run count, throttle, time zone, locale and a hash of the request headers. To re-record after changing only the evidence (overlay steps, pauses, check labels), add `--reuse-benchmark`: matching widths skip their clean runs and the conditions line says the results were reused. Do not reuse after changing the page or the journey. Read back the frames that carry visual criteria and the final vitals frame:

```sh
node <skill-dir>/scripts/frame.mjs <dir>/390px.webm <seconds|end> <frame.png>
```

Inspect every video at its recorded size: the benchmark rows must show median, worst, configured budget and matching status, or an explicit unavailable/not-applicable state. Verify that all three rows, conditions and final check results fit without clipping. Benchmark results appear at the end of the evidence run, after the checks; they come from the clean runs.

Done when decoded frames from every video are readable and agree with the command-line results.

Report each video path, the per-width results with measured values, the vitals medians, worst values and conditions line, every hidden widget, and each criterion you could only partly prove. The vitals are lab values under the printed conditions; Google assesses Core Web Vitals at the 75th percentile of real-user page loads.

## Runner options

| Option                                         | Default                       | Use                                                                                                                                |
| ---------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `--url`, `--widths`, `--checks`                | required                      | Page, comma-separated widths, checks file                                                                                          |
| `--wait-for <selector>`                        | none                          | Wait until the element is in the DOM before injecting                                                                              |
| `--out <dir>`                                  | `output`                      | Where `<width>px.webm` goes                                                                                                        |
| `--height <px>`                                | `900`                         | Viewport and video height                                                                                                          |
| `--timeout <ms>`                               | `60000`                       | Per run; a journey that never finishes fails that run                                                                              |
| `--runs <n>`                                   | `3`, or `1` with `--no-video` | Clean runs per width; the report gives the median and worst                                                                        |
| `--throttle`                                   | off                           | Clean runs only: Lighthouse's mobile preset (CPU 4×, 562.5ms latency, 1474.56/675 Kbps)                                            |
| `--budget-lcp`, `--budget-inp`, `--budget-cls` | `2500`, `200`, `0.1`          | Budgets for the median; use the criterion's own when it is stricter                                                                |
| `--inp-not-applicable`                         | off                           | Explicitly exclude INP for an intentionally passive journey; other missing metrics still fail                                      |
| `--no-video`                                   | off                           | Dry run; saves `<out>/<width>px.png` instead of a video                                                                            |
| `--reuse-benchmark`                            | off                           | Reuse matching clean-run samples from `<out>/benchmark.json` instead of measuring again                                            |
| `--header 'name: value'`                       | none                          | Request header on every request, repeatable (Playwright `extraHTTPHeaders`). The conditions line names the header, never its value |
| `--timezone <IANA zone>`                       | system                        | Browser time zone, such as `Europe/Berlin` (Playwright `timezoneId`)                                                               |
| `--locale <BCP 47>`                            | system                        | `navigator.language` and `Accept-Language`, such as `de-DE`                                                                        |
| `--ignore-https-errors`                        | off                           | Accept self-signed and otherwise invalid certificates, for local HTTPS                                                             |
| `--hide-consent`                               | off                           | Evidence run only: hide OneTrust, Cookiebot and Didomi consent dialogs                                                             |
