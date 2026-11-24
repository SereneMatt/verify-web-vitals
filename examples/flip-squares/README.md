# Flip squares

An 8×8 checkerboard where hovering a square flips it between black and white. Reset restores the board. The board grows on larger viewports and the section is center-aligned.

This is a showcase for the verify-web-vitals skill: [checks.js](checks.js) proves the criteria below, and [videos](videos) holds example evidence runs.

| Criterion | Check |
| --- | --- |
| The board loads as a checkerboard | `checkerboard` |
| Hovering a black square turns it white | `black→white` |
| Hovering a white square turns it black | `white→black` |
| Re-hovering flips it back | `re-hover flips` |
| Other squares stay unchanged | `others unchanged` |
| Reset restores the board | `reset` |
| Board fits the viewport | `fits viewport` |

## Run

From the repo root (after `npm install` and `npx playwright install chromium` in the skill folder):

```bash
node scripts/record.mjs \
  --url file://$(pwd)/examples/flip-squares/index.html \
  --widths 390,1440 \
  --checks examples/flip-squares/checks.js \
  --wait-for '[data-square]' \
  --throttle \
  --out examples/flip-squares/videos
```
