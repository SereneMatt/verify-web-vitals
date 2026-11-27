import { parseArgs } from 'node:util';

const usage = `Usage: node record.mjs --url <url> --widths <390,1280> --checks <checks.js> [--wait-for <selector>] [--out <dir>] [--height <px>] [--timeout <ms>] [--runs <n>] [--throttle] [--budget-lcp <ms>] [--budget-inp <ms>] [--budget-cls <score>] [--inp-not-applicable] [--no-video] [--reuse-benchmark] [--header <name: value>]... [--timezone <IANA zone>] [--locale <BCP 47>] [--ignore-https-errors] [--hide-consent]`;

const parseHeaders = (raw) => {
  const headers = {};
  for (const [index, header] of raw.entries()) {
    const colon = header.indexOf(':');
    if (colon < 1) {
      console.error(`--header ${index + 1} is not in "name: value" form\n${usage}`);
      process.exit(2);
    }
    headers[header.slice(0, colon).trim()] = header.slice(colon + 1).trim();
  }
  return headers;
};

export const parseOptions = () => {
  const { values } = parseArgs({
    options: {
      url: { type: 'string' },
      widths: { type: 'string' },
      checks: { type: 'string' },
      'wait-for': { type: 'string' },
      out: { type: 'string', default: 'output' },
      height: { type: 'string', default: '900' },
      timeout: { type: 'string', default: '60000' },
      runs: { type: 'string' },
      throttle: { type: 'boolean', default: false },
      'budget-lcp': { type: 'string', default: '2500' },
      'budget-inp': { type: 'string', default: '200' },
      'budget-cls': { type: 'string', default: '0.1' },
      'inp-not-applicable': { type: 'boolean', default: false },
      'no-video': { type: 'boolean', default: false },
      'reuse-benchmark': { type: 'boolean', default: false },
      header: { type: 'string', multiple: true, default: [] },
      timezone: { type: 'string' },
      locale: { type: 'string' },
      'ignore-https-errors': { type: 'boolean', default: false },
      'hide-consent': { type: 'boolean', default: false }
    }
  });

  if (!values.url || !values.widths || !values.checks) {
    console.error(usage);
    process.exit(2);
  }

  const headers = parseHeaders(values.header);
  const hasHeaders = values.header.length > 0;
  const recordVideo = !values['no-video'];
  return {
    url: values.url,
    widths: values.widths.split(',').map(Number),
    checks: values.checks,
    waitFor: values['wait-for'],
    out: values.out,
    height: Number(values.height),
    timeout: Number(values.timeout),
    runs: Number(values.runs ?? (recordVideo ? 3 : 1)),
    throttle: values.throttle,
    budgets: {
      LCP: Number(values['budget-lcp']),
      INP: Number(values['budget-inp']),
      CLS: Number(values['budget-cls'])
    },
    inpNotApplicable: values['inp-not-applicable'],
    recordVideo,
    reuseBenchmark: values['reuse-benchmark'],
    headers: hasHeaders ? headers : null,
    timezone: values.timezone,
    locale: values.locale,
    hideConsent: values['hide-consent'],
    contextOptions: {
      ...(hasHeaders ? { extraHTTPHeaders: headers } : {}),
      ...(values.timezone ? { timezoneId: values.timezone } : {}),
      ...(values.locale ? { locale: values.locale } : {}),
      ...(values['ignore-https-errors'] ? { ignoreHTTPSErrors: true } : {})
    }
  };
};
