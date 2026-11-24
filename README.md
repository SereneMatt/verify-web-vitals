# verify-ui-web-vitals

**One command. Headless Chromium. Clean Core Web Vitals. Video proof.**

Measure LCP, INP and CLS on the same journey you use for functional checks. Exit 0 only when every criterion **and** every vital passes. Record one `.webm` per viewport that proves it.

Built for any project and for CI. Needs Node + a one-time Playwright Chromium install.

---

## Why this exists

Most UI verification tools either:

- ignore performance, or
- measure lab scores that don't match how Core Web Vitals are actually collected.

This skill does both:

1. **Clean runs** (page untouched) collect LCP / INP / CLS medians and worst-case values.
2. **Evidence run** injects a minimal overlay and records a video that shows the functional checks **and** ends with the clean-run vitals.

Exit code is 0 only when everything passes — perfect for CI.

## Quick start

```bash
cd verify-web-vitals
npm install
npx playwright install chromium
```

Write a checks file (see SKILL.md for the full contract), then:

```bash
node scripts/record.mjs \
  --url https://example.com \
  --widths 390,719,720,1440 \
  --checks ./checks.js \
  --wait-for '[data-ready]' \
  --out ./verify-videos
```

Videos land in `./verify-videos/390px.webm`, etc.

### Dry run (no video)

Add `--no-video` to see pass/fail for criteria + vitals without recording.

## Core Web Vitals

Measured from **clean runs** (default 3) of the exact same journey:

| Metric | Good (default budget) |
|--------|-----------------------|
| LCP    | ≤ 2500 ms            |
| INP    | ≤ 200 ms             |
| CLS    | ≤ 0.1                |

- Median and worst values are reported.
- INP requires at least one `qa.act` interaction.
- Optional `--throttle` applies Lighthouse mobile Slow 4G only to clean runs.
- Budgets are overridable via `--budget-lcp`, `--budget-inp`, `--budget-cls`.

The overlay (evidence run only) shows the final clean-run vitals large and colour-coded. Functional criteria stay compact.

## Overlay philosophy

The recording should be watchable. The overlay:

- Highlights **Core Web Vitals** with large numbers and clear pass/fail colour.
- Shows only the current step + a compact criteria summary (or failures only).
- Avoids dense logs, long tables, and unnecessary text that obscure the page.
- Ends the video on a clear vitals summary so the proof is obvious from frames alone.

## Compared with the T3 Code edition

| | verify-ui-web-vitals | verify-ui-t3code-edition |
|---|---|---|
| Browser | Headless Chromium (Playwright) | T3 Code preview |
| Driven by | Custom script | Agent, one tool call at a time |
| Video | One `.webm` per width | One recording across all widths |
| Result | Exit code 0/1 for CI | Agent-written report |
| Setup | `npm install` + Playwright | None |
| Core Web Vitals | Measured (clean runs) | Not measured |

Use this one when you want vitals + CI. Use the T3 edition when you want zero extra tooling inside T3 Code.

## Requirements

- Node.js
- One-time: `npm install` + `npx playwright install chromium` in this folder

## License

MIT (or match your preference)

---

Full skill contract, check authoring rules, runner options, and reporting requirements live in [SKILL.md](./SKILL.md).
