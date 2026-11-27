export const printReport = (rows) => {
  let failed = false;
  let printed;
  for (const { width, results, vitals, videoPath, screenshotPath, conditions } of rows) {
    if (conditions !== printed) {
      console.log(conditions);
      printed = conditions;
    }
    const entries = Object.entries(results);
    failed ||=
      entries.length === 0 || entries.some(([, { pass }]) => pass !== true) || vitals.some((vital) => !vital.pass);
    console.log(entries.length === 0 ? `${width}px  no results ❌` : `${width}px`);
    for (const [key, { pass, detail }] of entries) {
      console.log(`       ${pass === true ? '✅' : '❌'} ${key}${detail === undefined ? '' : ` — ${detail}`}`);
    }
    for (const vital of vitals) {
      console.log(`       ${vital.text}`);
    }
    for (const file of [videoPath, screenshotPath].filter(Boolean)) {
      console.log(`       ${file}`);
    }
  }
  return failed;
};
