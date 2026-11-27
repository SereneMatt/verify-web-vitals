# Squares

Five rounded squares in a row. Hovering a square flips it over to show its number, 1 to 5; hovering it again flips it back. Reset turns every square face down.

This is a showcase for the verify-web-vitals skill: [checks.js](checks.js) proves the criteria below, and [videos](videos) holds example evidence runs.

| Criterion                                     | Check                      |
| --------------------------------------------- | -------------------------- |
| Five squares load face down                   | `face down`                |
| The backs are numbered 1 to 5 in order        | `numbers 1–5`              |
| Hovering a square flips it to show its number | `#0 shows 1`, `#1 shows 2` |
| Re-hovering flips it back                     | `re-hover flips back`      |
| Other squares stay unchanged                  | `others unchanged`         |
| Reset turns every square face down            | `reset`                    |
| Squares fit the viewport                      | `fits viewport`            |

## Run

From the repo root (after `bun install` and `bunx playwright install chromium` in the skill folder):

```bash
node scripts/record.mjs \
  --url file://$(pwd)/examples/flip-squares/index.html \
  --widths 390,1440 \
  --checks examples/flip-squares/checks.js \
  --wait-for '[data-square]' \
  --throttle \
  --out examples/flip-squares/videos
```
