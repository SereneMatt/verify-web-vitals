# verify-web-vitals

A tool to help agents record LCP, INP, and CLS on the same workflow you use for functional checks.

https://github.com/user-attachments/assets/eb4dbbc8-9e6a-4405-8102-f5ba9d2948cd

---

## When to use this tool

When you would like to

- verify performance, or
- measure Core Web Vitals

Exit code is 0 only when everything passes — perfect for CI.

## How to use

```bash
npx -p verify-web-vitals playwright-core install chromium
```

To start a verification:

```bash
npx verify-web-vitals \
  --url https://your-site.com \
  --widths 390,719,720,1440 \
  --checks ./checks.js \
  --wait-for '[data-ready]' \
  --out ./output
```

## Core Web Vitals

Measured from **benchmark runs** of the exact same user journey:

| Metric | Good (default budget) |
| ------ | --------------------- |
| LCP    | ≤ 2500 ms             |
| INP    | ≤ 200 ms              |
| CLS    | ≤ 0.1                 |

Add `--no-video` for a dry run: it prints each check's measured value and saves `<out>/<width>px.png` per width, so dialogs that cover the page show up before you record. `--header`, `--timezone`, `--locale` and `--ignore-https-errors` set up the browser for geo, CDN-header and local-HTTPS pages.

To read a frame back from a recording:

```bash
npx verify-web-vitals-frame output/390px.webm end final.png
```

## Requirements

- Node.js 22 or later

## License

[MIT](./LICENSE)

---

Full skill contract, check authoring rules, runner options, and reporting requirements live in [SKILL.md](./SKILL.md).
