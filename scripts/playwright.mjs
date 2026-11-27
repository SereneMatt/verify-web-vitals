import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const skillDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const bases = [skillDir, process.cwd()];
export const setupHint = `Run \`bun install\` and \`bunx playwright-core install chromium\` in ${skillDir}.`;

export const readExpression = async (file) => (await readFile(file, 'utf8')).trim().replace(/;$/, '');

export const loadChromium = () => {
  for (const base of bases) {
    for (const name of ['playwright-core', 'playwright', '@playwright/test']) {
      try {
        return createRequire(path.join(base, 'index.js'))(name).chromium;
      } catch {}
    }
  }
  console.error(`Playwright not found. ${setupHint}`);
  process.exit(2);
};
