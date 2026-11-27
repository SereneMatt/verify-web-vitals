# verify-web-vitals

Measure LCP, INP and CLS on the same journey you use for functional checks. Exit 0 only when every criterion **and** every required vital passes. Record one `.webm` per viewport that proves it.

https://github.com/user-attachments/assets/7ed32772-453e-406f-93ea-9c84433f5925

---

## When to use this tool

When you would like to

- verify performance, or
- measure Core Web Vitals

This skill records a video that shows the functional checks **and** ends with the benchmarked web vitals.

Exit code is 0 only when everything passes — perfect for CI.

## Quick start

```bash
npx -p verify-web-vitals playwright install chromium
```

Write a checks file (see SKILL.md for the full contract), then:

```bash
npx verify-web-vitals \
  --url https://example.com \
  --widths 390,719,720,1440 \
  --checks ./checks.js \
  --wait-for '[data-ready]' \
  --out ./output
```

## Core Web Vitals

Measured from **benchmark runs** of the exact same journey:

| Metric | Good (default budget) |
| ------ | --------------------- |
| LCP    | ≤ 2500 ms             |
| INP    | ≤ 200 ms              |
| CLS    | ≤ 0.1                 |

An overlay shows **Benchmark results** throughout the recording.

Add `--no-video` for a dry run: it prints each check's measured value and saves `<out>/<width>px.png` per width, so dialogs that cover the page show up before you record. `--header`, `--timezone`, `--locale` and `--ignore-https-errors` set up the browser for geo, CDN-header and local-HTTPS pages.

To read a frame back from a recording:

```bash
npx verify-web-vitals-frame output/390px.webm end final.png
```

## Requirements

- Node.js 22 or later
- One-time: `npx -p verify-web-vitals playwright install chromium`

To work on the tool itself: `bun install`, `bunx playwright install chromium`, then `bun run test`.

## License

[MIT](./LICENSE)

---

Full skill contract, check authoring rules, runner options, and reporting requirements live in [SKILL.md](./SKILL.md).
