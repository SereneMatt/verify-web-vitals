import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { bases, readExpression, setupHint, skillDir } from './playwright.mjs';

// web-vitals does not export its IIFE build, so locate the package folder the way Node resolution walks node_modules.
const findPackage = (name) => {
  for (const base of bases) {
    for (let dir = base; ; dir = path.dirname(dir)) {
      const candidate = path.join(dir, 'node_modules', name);
      if (existsSync(path.join(candidate, 'package.json'))) {
        return candidate;
      }
      if (dir === path.dirname(dir)) {
        break;
      }
    }
  }
  console.error(`${name} not found. ${setupHint}`);
  process.exit(2);
};

export const loadVitals = async () => {
  const dir = findPackage('web-vitals');
  const { version } = JSON.parse(await readFile(path.join(dir, 'package.json'), 'utf8'));
  const library = await readFile(path.join(dir, 'dist', 'web-vitals.iife.js'), 'utf8');
  const collector = await readExpression(path.join(skillDir, 'scripts', 'vitals.js'));
  // One init script, because Playwright does not guarantee the order of several.
  return { version, script: `${library}\n;(${collector})();` };
};

const median = (numbers) => {
  const sorted = [...numbers].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const format = (name, value) => (name === 'CLS' ? value.toFixed(3) : `${Math.round(value)}ms`);

export const summarizeVitals = (samples, { budgets, inpNotApplicable }) =>
  Object.entries(budgets).map(([name, budget]) => {
    const budgetText = name === 'CLS' ? `≤${budget}` : `≤${budget}ms`;
    if (name === 'INP' && inpNotApplicable) {
      return {
        name,
        status: 'not-applicable',
        pass: true,
        text: 'INP Not applicable — explicitly excluded for this journey'
      };
    }
    const measured = samples.map((sample) => sample[name]).filter(Number.isFinite);
    if (measured.length < samples.length || measured.length === 0) {
      return {
        name,
        status: 'unavailable',
        pass: false,
        text: `${name} unavailable in ${samples.length - measured.length}/${samples.length} runs ${budgetText} ❌`
      };
    }
    const mid = median(measured);
    const worst = Math.max(...measured);
    const pass = mid <= budget;
    return {
      name,
      status: 'measured',
      median: mid,
      worst,
      budget,
      pass,
      text: `${name} ${format(name, mid)} median / ${format(name, worst)} worst ${budgetText} ${pass ? '✅' : '❌'}`
    };
  });
