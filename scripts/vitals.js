() => {
  window.__verifyVitals = {};
  const report = (metric) => {
    window.__verifyVitals[metric.name] = metric.value;
  };
  webVitals.onLCP(report, { reportAllChanges: true });
  webVitals.onINP(report, { reportAllChanges: true });
  webVitals.onCLS(report, { reportAllChanges: true });
  // Registered after web-vitals so it sees each Event Timing batch after web-vitals has queued it.
  let lastInput = -1;
  let lastEntry = -1;
  window.__verifyInput = () => {
    lastInput = performance.now();
  };
  const seen = (list) => {
    for (const entry of list.getEntries()) {
      if (entry.interactionId) {
        lastEntry = Math.max(lastEntry, entry.startTime);
      }
    }
  };
  new PerformanceObserver(seen).observe({ type: 'event', durationThreshold: 16, buffered: true });
  new PerformanceObserver(seen).observe({ type: 'first-input', buffered: true });
  // Event Timing entries arrive after the next paint. Interactions faster than 16ms never produce one, hence the cap.
  window.__verifyVitalsSettled = (capMs) =>
    new Promise((resolve) => {
      const deadline = performance.now() + capMs;
      const poll = () => {
        if (lastInput >= 0 && lastEntry < lastInput && performance.now() < deadline) {
          setTimeout(poll, 16);
          return;
        }
        // web-vitals processes INP entries when idle, which headless Chromium rarely is; any visibilitychange flushes them.
        dispatchEvent(new Event('visibilitychange'));
        resolve();
      };
      poll();
    });
};
