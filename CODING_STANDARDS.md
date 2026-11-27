# Coding standards

Formatting belongs to `oxfmt` (`bun run format:check`); these rules cover what no formatter or linter can see.

Domain words come from [GLOSSARY.md](GLOSSARY.md): **journey**, **benchmark run**, **evidence run**, **not applicable**.

## Two runtimes

The runner is Node. `scripts/verify.js`, `scripts/vitals.js` and every checks file run in Chromium: `record.mjs` reads each as text and injects it into the page.

- Browser code written as a template string inside a Node module is a finding: oxfmt and the editor cannot see it.
- The repo is plain JavaScript: no TypeScript, no JSDoc type annotations, no build step. Chromium runs the injected files as written.
- Browser code runs inside the page's own context. Everything it defines on `window` is visible to the page, so prefix internal hooks `__verify`, and keep `window.verify` the one public name.

## Contracts

A behaviour change in a contract needs a test that goes red without it.

## Names

- Name a thing with the glossary word for what it is.
- Name a file after what it creates or owns, all of it: `verify.js` creates `window.verify` and draws the overlay only in the evidence run, so a name for the overlay alone undersells it.

## Modules

`record.mjs` is the run order and nothing more: parse options, launch Chromium, benchmark, evidence, report.

## Tests

- A test earns its run time by guarding behaviour this repo owns: output formatting, consent hiding, `verify.*` measurements, budgets. A test whose assertions would only go red if Playwright or Chromium broke is a finding.

## Comments

A comment states a reason the code cannot show: a browser or vendor quirk, a measured constraint, a security choice. For a full sweep, run the `no-comments` skill in `.agents/skills/`.
