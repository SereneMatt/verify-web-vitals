(checks, mode = 'evidence') => {
  const display = mode === 'evidence';
  const ok = (pass) => (pass === undefined || pass === null ? '⏳' : pass ? '✅' : '❌');

  // Colour helpers for vitals (default budgets; runner may override display later)
  const vitalColor = (name, value) => {
    if (value == null) return '#888';
    if (name === 'LCP') return value <= 2500 ? '#4ade80' : value <= 4000 ? '#fbbf24' : '#f87171';
    if (name === 'INP') return value <= 200 ? '#4ade80' : value <= 500 ? '#fbbf24' : '#f87171';
    if (name === 'CLS') return value <= 0.1 ? '#4ade80' : value <= 0.25 ? '#fbbf24' : '#f87171';
    return '#eee';
  };

  const formatVital = (name, value) => {
    if (value == null) return '—';
    if (name === 'CLS') return value.toFixed(3);
    return `${Math.round(value)}ms`;
  };

  const shiftEntries = [];
  if (display) {
    try {
      new PerformanceObserver((list) => shiftEntries.push(...list.getEntries())).observe({
        type: 'layout-shift',
        buffered: true
      });
    } catch {}
  }

  const channels = (color) => (color.match(/[\d.]+/g) || []).map(Number);
  const luminance = (color) => {
    const [r, g, b] = channels(color).map((value) => {
      const s = value / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const finiteAnimations = () =>
    document
      .getAnimations()
      .filter(
        (animation) =>
          animation.playState === 'running' &&
          animation.timeline instanceof DocumentTimeline &&
          animation.effect?.getComputedTiming().endTime !== Infinity
      );
  const animating = () => finiteAnimations().length > 0;
  const settle = () =>
    new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Animations did not settle within 5s')), 5000);
      Promise.all(finiteAnimations().map((animation) => animation.finished.catch(() => {})))
        .then(() => new Promise((done) => requestAnimationFrame(done)))
        .then(() => {
          clearTimeout(timeout);
          resolve();
        });
    });
  const evaluateSettled = (evaluate) => settle().then(evaluate);

  const width = innerWidth;
  const liveChecks = [];
  const loads = [];
  const results = {};
  let currentStep = '';

  let stepEl, criteriaEl, vitalsContainer, summaryEl;

  if (display) {
    // Slim bottom bar: step + compact criteria
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:fixed; left:8px; right:8px; bottom:8px; z-index:2147483647;
      background:rgba(15,15,20,.88); color:#eee;
      font:13px/1.4 system-ui, -apple-system, sans-serif;
      padding:10px 14px; border-radius:10px; pointer-events:none;
      display:flex; align-items:center; gap:16px; max-height:64px;
      box-shadow:0 4px 24px rgba(0,0,0,.4);
    `;
    overlay.innerHTML = `
      <div data-step style="font-weight:600; color:#ffd166; min-width:140px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"></div>
      <div data-criteria style="flex:1; color:#ccc; font-size:12px;"></div>
    `;
    document.body.append(overlay);
    stepEl = overlay.querySelector('[data-step]');
    criteriaEl = overlay.querySelector('[data-criteria]');

    // Floating vitals card (top-right) — visual focus
    const vitalsPanel = document.createElement('div');
    vitalsPanel.style.cssText = `
      position:fixed; top:12px; right:12px; z-index:2147483647;
      background:rgba(15,15,20,.92); color:#eee;
      font:14px/1.3 system-ui, -apple-system, sans-serif;
      padding:12px 16px; border-radius:12px; pointer-events:none;
      min-width:240px; box-shadow:0 6px 32px rgba(0,0,0,.5);
    `;
    vitalsPanel.innerHTML = `
      <div style="font-size:11px; letter-spacing:0.5px; color:#9ca3af; margin-bottom:6px; text-transform:uppercase;">Core Web Vitals</div>
      <div data-vitals style="display:flex; flex-direction:column; gap:4px;"></div>
      <div data-summary style="margin-top:8px; font-size:11px; color:#9ca3af; white-space:pre-wrap; max-height:120px; overflow:hidden;"></div>
    `;
    document.body.append(vitalsPanel);
    vitalsContainer = vitalsPanel.querySelector('[data-vitals]');
    summaryEl = vitalsPanel.querySelector('[data-summary]');
  }

  const updateVitalsDisplay = (vitals = {}) => {
    if (!display || !vitalsContainer) return;
    const lines = ['LCP', 'INP', 'CLS'].map(name => {
      const value = vitals[name];
      const color = vitalColor(name, value);
      const formatted = formatVital(name, value);
      const status = value == null ? '⏳' : (color === '#4ade80' ? '✅' : '❌');
      return `<div style="display:flex; justify-content:space-between; align-items:baseline;">
        <span style="color:#9ca3af;">${name}</span>
        <span style="font-weight:700; font-size:18px; color:${color};">${formatted} ${status}</span>
      </div>`;
    });
    vitalsContainer.innerHTML = lines.join('');
  };

  const updateCriteriaDisplay = () => {
    if (!display || !criteriaEl) return;
    const entries = Object.entries(results);
    if (entries.length === 0) {
      criteriaEl.textContent = 'running…';
      return;
    }
    const failed = entries.filter(([, pass]) => pass === false);
    const passed = entries.filter(([, pass]) => pass === true).length;
    if (failed.length === 0) {
      criteriaEl.textContent = `${passed}/${entries.length} checks ✅`;
    } else {
      criteriaEl.textContent = `${passed}/${entries.length} ✅  ·  failed: ${failed.map(([k]) => k).join(', ')}`;
    }
  };

  const qa = {
    width,
    ok,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    step: (text) => {
      currentStep = text;
      if (stepEl) stepEl.textContent = text;
    },
    record: (key, pass) => {
      results[key] = pass ?? null;
      updateCriteriaDisplay();
    },
    log: (text, pass, key) => {
      if (key !== undefined) {
        qa.record(key, results[key] === false || pass === false ? false : pass);
      }
      updateCriteriaDisplay();
    },
    check: (label, evaluate) => {
      liveChecks.push({ label, evaluate });
    },
    onLoad: (key, evaluate) => {
      let result = { pass: undefined, detail: 'settling…' };
      liveChecks.push({ label: `${key} (on load)`, evaluate: () => result, onLoad: true });
      loads.push(
        evaluateSettled(evaluate)
          .then((settled) => {
            result = settled;
            qa.log(settled.detail, settled.pass, key);
          })
          .catch((error) => {
            result = { pass: false, detail: error.message };
            qa.log(error.message, false, key);
          })
      );
    },
    settle,
    logSettled: (key, evaluate) =>
      evaluateSettled(evaluate).then(({ pass, detail }) => {
        qa.log(detail, pass, key);
        return pass;
      }),
    act: (action, selector, target) => window.qaAct(action, selector, target),
    hide: (selector) => {
      document.head.insertAdjacentHTML('beforeend', `<style>${selector}{display:none!important}</style>`);
    },
    color: (element) => getComputedStyle(element).color,
    background: (element) => {
      for (let node = element; node; node = node.parentElement) {
        const color = getComputedStyle(node).backgroundColor;
        const [, , , alpha = 1] = channels(color);
        if (alpha === 1) {
          return color;
        }
      }
      return 'rgb(255, 255, 255)';
    },
    contrast: (foreground, background) => {
      const [high, low] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
      return (high + 0.05) / (low + 0.05);
    },
    firstFullyVisible: (scroller) => {
      const { left, right } = scroller.getBoundingClientRect();
      return [...scroller.children].findIndex((child) => {
        const rect = child.getBoundingClientRect();
        return rect.left >= left - 1 && rect.right <= right + 1;
      });
    },
    table: () =>
      `${width}px results: ${Object.entries(results)
        .map(([key, pass]) => `${key}${ok(pass)}`)
        .join(' ')}`,
    summary: (text) => {
      // Runner calls this at the end with clean-run vitals text
      if (summaryEl) summaryEl.textContent = text || '';
      if (stepEl) stepEl.textContent = currentStep || `${width}px · results`;
    },
    shifts: (root) =>
      shiftEntries.filter((entry) => entry.sources?.some((source) => source.node && root.contains(source.node))),
    focus: (element) => {
      element.style.outline = '2px solid #0a7cff';
      const headerBottom = [...document.querySelectorAll('body *')].reduce((bottom, node) => {
        const { position } = getComputedStyle(node);
        if (position !== 'fixed' && position !== 'sticky') {
          return bottom;
        }
        const rect = node.getBoundingClientRect();
        return rect.top <= 0 && rect.bottom > 0 && rect.height < innerHeight / 2
          ? Math.max(bottom, rect.bottom)
          : bottom;
      }, 0);
      scrollTo({ top: element.getBoundingClientRect().top + scrollY - headerBottom - 60, behavior: 'instant' });
    }
  };

  if (!display) {
    const skip = () => {};
    Object.assign(qa, {
      step: skip,
      summary: skip,
      log: skip,
      onLoad: skip,
      hide: skip,
      focus: skip,
      logSettled: () => Promise.resolve(undefined)
    });
  }
  window.qa = qa;

  let script;
  let setupError;
  try {
    script = checks(qa);
  } catch (error) {
    setupError = error;
    qa.log(`checks failed to load: ${error.message}`, false, 'setup');
  }

  qa.run = async () => {
    try {
      if (setupError && !display) {
        throw setupError;
      }
      await Promise.all(loads);
      if (typeof script === 'function') {
        await script(qa);
      }
      if (display) {
        await qa.settle();
        for (const { label, evaluate } of liveChecks.filter((check) => !check.onLoad)) {
          try {
            const { pass, detail } = evaluate();
            qa.log(`${label}: ${detail}`, pass, label);
          } catch (error) {
            qa.log(`${label} threw ${error.message}`, false, label);
          }
        }
      }
    } catch (error) {
      qa.log(`script failed: ${error.message}`, false, 'script');
      if (!display) {
        throw error;
      }
    }
    qa.step(`${width}px · results`);
    return { ...results };
  };

  if (display) {
    const tick = () => {
      updateVitalsDisplay(window.__qaVitals || {});
      updateCriteriaDisplay();
      requestAnimationFrame(tick);
    };
    tick();
  }

  return liveChecks.map((check) => check.label);
};
