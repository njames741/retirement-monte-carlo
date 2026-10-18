// Independent numerical audit. Production modules and datasets are read only.
// --strict exits 1 while any recorded finding remains reproducible.
// --output PATH writes aggregates only; no original market/CPI observations.
import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';
import {DEFAULTS, prepareMarket, evaluate} from '../dist/engine.js';
import {currencyDefaults} from '../dist/currency.js';
import {datasetForCurrency} from '../dist/datasets.js';
import {EQUITY_PARAMETERS} from '../dist/equity-parameters.js';
import {SCENARIO_VERSION} from '../dist/scenarios.js';

const {values: options} = parseArgs({options: {
  strict: {type: 'boolean'}, output: {type: 'string'},
}});
const checks = [], findings = [], summaries = {};
const near = (a, b, label = '') => assert.ok(Math.abs(a - b) <= 1e-8 * Math.max(1, Math.abs(b)), `${label}: ${a} != ${b}`);
const base = {...DEFAULTS, paths: 100, years: 30, fee: 0, drag: 0, cagr: .06, vol: 0, inflation: .02, rate: .02};
const flat = (c, gross = 1.06, inflation = 1.02) => ({paths: c.paths, years: c.years,
  factors: new Float64Array(c.paths * c.years).fill(gross), inflation: new Float64Array(c.paths * c.years).fill(inflation)});
function check(name, fn) {
  try { const detail = fn(); checks.push({name, status: 'pass', ...detail}); }
  catch (error) { checks.push({name, status: 'fail', message: error.message}); }
}
function percentile(values, q) {
  const a = [...values].sort((x, y) => x - y), h = (a.length - 1) * q;
  return a[Math.floor(h)] * (1 - h % 1) + a[Math.ceil(h)] * (h % 1);
}

check('Fixed real withdrawals agree with a closed-form annuity calculation', () => {
  const q = 1.06 / 1.02, r = evaluate(base, flat(base));
  const expected = base.initial * q ** base.years - q * base.initial * base.rate * (q ** base.years - 1) / (q - 1);
  near(r.terminal[3], expected);
  for (const row of r.spendingPercentiles) near(row.values[3], base.initial * base.rate);
  return {expectedRealTerminal: expected, actualRealTerminal: r.terminal[3]};
});
check('Fixed percentage agrees with a closed-form compound product', () => {
  const c = {...base, strategy: 'percent'}, r = evaluate(c, flat(c));
  const q = (1 - c.rate) * 1.06 / 1.02;
  near(r.terminal[3], c.initial * q ** c.years);
  for (const row of r.spendingPercentiles) near(row.values[3], c.initial * c.rate * q ** (row.year - 1));
});
check('Yearly spending uses beginning prices; assets use ending prices', () => {
  const c = {...base, initial: 1000, years: 2, rate: .1}, r = evaluate(c, flat(c, 1.1, 1.1));
  near(r.assetPercentiles[1].values[3], 900);
  near(r.assetPercentiles[2].values[3], 800);
  near(r.spendingPercentiles[0].values[3], 100);
  near(r.spendingPercentiles[1].values[3], 100);
});

// A separate ledger denominated entirely in initial purchasing power.
// It never calls production withdrawal(), quantile(), or evaluate().
function realLedger(c, market) {
  const assets = Array.from({length: c.years + 1}, () => []), spending = Array.from({length: c.years}, () => []);
  let ruined = 0, lifestyle = 0;
  const drops = [0, 0, 0, 0], depletion = Array(c.years + 1).fill(0);
  for (let p = 0; p < c.paths; p++) {
    let a = c.initial, lastSpending = c.initial * c.rate, lastInflation = 1, lastGross = 1, minimum = 1, minimumPaid = Infinity, death = 0;
    assets[0].push(a);
    for (let y = 0; y < c.years; y++) {
      let desired = c.initial * c.rate;
      if (y && c.strategy === 'percent') desired = a * c.rate;
      if (y && c.strategy === 'dynamic') desired = Math.max(lastSpending * (1 - c.floor), Math.min(lastSpending * (1 + c.ceiling), a * c.rate));
      if (y && c.strategy === 'gk') {
        desired = lastSpending;
        if (lastGross < 1 && desired / a > c.rate && lastInflation > 1) desired /= lastInflation;
        if (desired / a > c.rate * (1 + c.guard) && y < c.years - 15) desired *= 1 - c.adjust;
        else if (desired / a < c.rate * (1 - c.guard)) desired *= 1 + c.adjust;
      }
      const paid = Math.min(a, Math.max(0, desired));
      if (!death && a - paid <= c.initial * 1e-12) death = y + 1;
      if(c.rate>0) minimum = Math.min(minimum, paid / (c.initial * c.rate));
      minimumPaid = Math.min(minimumPaid, paid);
      spending[y].push(paid);
      const k = p * c.years + y;
      a = (a - paid) * market.factors[k] / market.inflation[k];
      assets[y + 1].push(a);
      lastSpending = paid; lastInflation = market.inflation[k]; lastGross = market.factors[k];
    }
    if (death) { ruined++; depletion[death]++; }
    if (!death && minimumPaid + 1e-8 >= c.minimumMonthlySpending * 12) lifestyle++;
    [.9, .8, .7, .5].forEach((level, i) => { if (minimum < level - 1e-10) drops[i]++; });
  }
  return {assets, spending, ruined, lifestyle: lifestyle / c.paths, drops: drops.map(n => n / c.paths), depletion};
}
check('Four strategies agree with an independent real-purchasing-power ledger', () => {
  let scenarios = 0;
  for (const strategy of ['fixed', 'percent', 'gk', 'dynamic']) for (const seed of [3, 19, 741]) {
    const c = {...base, strategy, seed, years: 40, rate: .065, vol: .38, inflationModel: 'lognormal', inflationVol: .08};
    const market = prepareMarket(c), actual = evaluate(c, market), expected = realLedger(c, market);
    assert.equal(actual.ruined, expected.ruined);
    near(actual.lifestyle, expected.lifestyle);
    assert.deepEqual(actual.depletion, expected.depletion);
    actual.drops.forEach((v, i) => near(v, expected.drops[i]));
    for (const [rows, raw] of [[actual.assetPercentiles, expected.assets], [actual.spendingPercentiles, expected.spending]]) {
      rows.forEach((row, i) => [.01, .05, .25, .5, .75, .95, .99].forEach((q, j) => near(row.values[j], percentile(raw[i], q), `${strategy}/${seed}/${i}/${q}`)));
    }
    scenarios++;
  }
  return {scenarios, pathsPerScenario: 100, years: 40};
});
check('Amounts scale linearly; currency labels do not silently change stock returns', () => {
  for (const strategy of ['fixed', 'percent', 'gk', 'dynamic']) {
    const c = {...base, strategy, vol: .25, rate: .05}, market = prepareMarket(c), a = evaluate(c, market), b = evaluate({...c, currency: 'TWD', initial: c.initial * 30, minimumMonthlySpending: c.minimumMonthlySpending * 30}, market);
    assert.equal(a.ruined, b.ruined); assert.equal(a.lifestyle, b.lifestyle);
    a.terminal.forEach((v, i) => near(b.terminal[i], v * 30));
    a.spendingPercentiles.forEach((row, i) => row.values.forEach((v, j) => near(b.spendingPercentiles[i].values[j], v * 30)));
  }
});
check('Histogram and depletion counts conserve all simulated paths', () => {
  const c = {...base, years: 50, vol: .3, rate: .06}, r = evaluate(c, prepareMarket(c));
  assert.equal(r.histogram.reduce((n, b) => n + b.count, 0), c.paths);
  assert.equal(r.depletion.reduce((a, b) => a + b, 0), r.ruined);
});
check('Zero volatility, fee and tracking costs agree with exact products', () => {
  const c = {...base, rate: 0, fee: .006, drag: .002}, market = prepareMarket(c);
  near(evaluate(c, market).terminal[3], c.initial * (1.06 * .994 * Math.exp(-.002) / 1.02) ** c.years);
});

// Recompute local calibration from endpoint growth and Welford sample variance,
// without using the production CSV parser or statistics implementation.
try {
  const csv = await readFile(new URL('../local-data/msci/acwi-imi-net-usd.csv', import.meta.url), 'utf8');
  const workbook = await readFile(new URL('../local-data/msci/historyIndex.xls', import.meta.url));
  check('Local MSCI calibration and provenance agree with published aggregates', () => {
    const rows = csv.trim().split(/\r?\n/).slice(1).map(row => row.split(','));
    const n = rows.length - 1;
    let mean = 0, m2 = 0;
    for (let i = 1; i <= n; i++) {
      const v = Math.log(Number(rows[i][1]) / Number(rows[i - 1][1])), delta = v - mean;
      mean += delta / i; m2 += delta * (v - mean);
    }
    const cagr = (Number(rows.at(-1)[1]) / Number(rows[0][1])) ** (12 / n) - 1, vol = Math.sqrt(m2 / (n - 1) * 12);
    near(cagr, EQUITY_PARAMETERS.parameters.cagr); near(vol, EQUITY_PARAMETERS.parameters.logVol);
    assert.equal(n, EQUITY_PARAMETERS.sample.months);
    assert.equal(createHash('sha256').update(csv).digest('hex'), EQUITY_PARAMETERS.provenance.inputSha256);
    assert.equal(createHash('sha256').update(workbook).digest('hex'), EQUITY_PARAMETERS.provenance.sourceSha256);
    return {months: n, cagr, logVol: vol, originalFileHashMatches: true};
  });
} catch (error) {
  if (error.code === 'ENOENT') checks.push({name: 'Local MSCI calibration', status: 'unavailable', reason: 'Private local source files are absent.'});
  else throw error;
}

// The pre-fix chain is retained as a historical comparison, not the current model.
function legacyCpiExpectation(cpi, block, years) {
  const n = cpi.inflation.length, logs = cpi.inflation.map(Math.log1p);
  const serial = s => Number(s.slice(0, 4)) * 12 + Number(s.slice(5));
  const continuous = cpi.dates.map((date, i) => i + 1 < n && serial(cpi.dates[i + 1]) - serial(date) === 1);
  let weights = Array(n).fill(1 / n), logTotal = 0;
  for (let month = 0; month < years * 12; month++) {
    logTotal += weights.reduce((s, p, i) => s + p * logs[i], 0);
    let restart = 0;
    const next = Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      if (continuous[i]) { next[i + 1] += weights[i] * (1 - 1 / block); restart += weights[i] / block; }
      else restart += weights[i];
    }
    weights = next.map(p => p + restart / n);
  }
  return {uniformSampleGeometricRate: Math.expm1(logs.reduce((a, b) => a + b, 0) / n * 12),
    legacyExpectedGeometricRate: Math.expm1(logTotal / years),
    legacyExpectedPriceGeometricRatioToUniform: Math.exp(logTotal - years * logs.reduce((a, b) => a + b, 0) / n * 12),
    uniformMonthWeight: 1 / n, legacyFirstMonthWeightAfterHorizon: weights[0]};
}
const cpiDetails = [];
for (const currency of ['TWD', 'USD']) for (const block of [24, 120]) {
  const dataset = datasetForCurrency(currency), c = {...currencyDefaults(currency), inflationModel: 'cpi', block};
  const market = prepareMarket(c, dataset), expected = legacyCpiExpectation(dataset.cpi, block, c.years);
  const pathLogRates = Array.from({length: c.paths}, (_, p) => {
    let total = 0;
    for (let y = 0; y < c.years; y++) total += Math.log(market.inflation[p * c.years + y]);
    return total / c.years;
  });
  const meanLogRate = pathLogRates.reduce((a, b) => a + b, 0) / c.paths;
  const standardError = Math.sqrt(pathLogRates.reduce((s, v) => s + (v - meanLogRate) ** 2, 0) / (c.paths - 1) / c.paths);
  const zAgainstUniform = (meanLogRate - Math.log1p(expected.uniformSampleGeometricRate)) / standardError;
  check(`CPI samples are finite and positive: ${currency}, block=${block}`, () => assert.ok(market.inflation.every(v => Number.isFinite(v) && v > 0)));
  cpiDetails.push({currency, block, ...expected, simulatedGeometricRate: Math.expm1(meanLogRate), annualLogMeanStandardError: standardError, zAgainstUniform});
}
if (cpiDetails.some(r => Math.abs(r.zAgainstUniform) > 6)) findings.push({
  id: 'CPI-BOUNDARY-WEIGHTS', severity: 'P2', source: 'dist/engine.js:65',
  description: 'Forced restarts at sample ends and gaps destroy uniform marginal month weights; the bundled samples produce lower geometric inflation than uniform stationary resampling.', details: cpiDetails,
});

const sameInflation = {...currencyDefaults(), inflationModel: 'constant'}, dataset = datasetForCurrency('TWD');
const constant = prepareMarket(sameInflation, dataset), zeroVol = prepareMarket({...sameInflation, inflationModel: 'lognormal', inflationVol: 0}, dataset);
const constantResult = evaluate(sameInflation, constant), zeroVolResult = evaluate(sameInflation, zeroVol);
const changedStockYears = constant.factors.reduce((n, v, i) => n + (v !== zeroVol.factors[i] ? 1 : 0), 0);
assert.deepEqual(constant.inflation, zeroVol.inflation);
if (changedStockYears) findings.push({id: 'INFLATION-RNG-COUPLING', severity: 'P2', source: 'dist/engine.js:67',
  description: 'Switching to zero-volatility lognormal inflation changes stock paths despite identical inflation; scenario comparisons include unrelated Monte Carlo differences.',
  changedStockYears, totalStockYears: constant.factors.length, constantRuined: constantResult.ruined,
  zeroVolatilityRuined: zeroVolResult.ruined, paths: sameInflation.paths,
  constantTerminalMedian: constantResult.terminal[3], zeroVolatilityTerminalMedian: zeroVolResult.terminal[3],
});

const defaultConfig = currencyDefaults(), defaultMarket = prepareMarket(defaultConfig, dataset);
summaries.default = {currency: defaultConfig.currency, years: defaultConfig.years, paths: defaultConfig.paths, seed: defaultConfig.seed,
  initial: defaultConfig.initial, rate: defaultConfig.rate, minimumMonthlySpending: defaultConfig.minimumMonthlySpending, cagr: EQUITY_PARAMETERS.parameters.cagr, logVol: EQUITY_PARAMETERS.parameters.logVol,
  inflation: defaultConfig.inflation, fee: defaultConfig.fee};
summaries.strategies = ['fixed', 'percent', 'gk', 'dynamic'].map(strategy => {
  const r = evaluate({...defaultConfig, strategy}, defaultMarket);
  return {strategy, ruined: r.ruined, survival: r.survival, lifestyle: r.lifestyle, terminalMedian: r.terminal[3], year50SpendingMedian: r.spendingPercentiles[49].values[3], drops: r.drops};
});
summaries.cpiSampling = cpiDetails;
summaries.equivalentInflation = {changedStockYears, paths: sameInflation.paths, constantRuined: constantResult.ruined, zeroVolatilityRuined: zeroVolResult.ruined};
const output = {auditDate: '2026-10-18', runtime: process.version, scenarioVersion: SCENARIO_VERSION, readOnlyAudit: true, checks, findings, summaries};
if (options.output) await writeFile(options.output, JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify(output, null, 2));
if (checks.some(c => c.status === 'fail') || options.strict && findings.length) process.exitCode = 1;
