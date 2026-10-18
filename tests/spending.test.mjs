import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS,STRATEGIES,evaluate,validate} from '../dist/engine.js';
import {currencyDefaults,restoreConfig} from '../dist/currency.js';

const config=over=>({...DEFAULTS,paths:100,years:3,initial:30000000,rate:.04,minimumMonthlySpending:80000,...over});
const flat=(c,inflation=1)=>({paths:c.paths,years:c.years,factors:new Float64Array(c.paths*c.years).fill(1),inflation:new Float64Array(c.paths*c.years).fill(inflation)});

test('the same monetary minimum remains binding across different assets and initial rates',()=>{
  for(const [over,expected]of [[{},1],[{rate:.03},0],[{initial:20000000},0]]){
    const c=config(over),r=evaluate(c,flat(c));
    assert.equal(r.survival,1);assert.equal(r.lifestyle,expected);
  }
});

test('minimum spending is measured in initial purchasing power, including the exact boundary',()=>{
  const c=config({years:5,minimumMonthlySpending:100000}),m=flat(c,1.1);
  const equal=evaluate(c,m),above=evaluate({...c,minimumMonthlySpending:100000.01},m);
  assert.equal(equal.lifestyle,1);assert.equal(above.lifestyle,0);
  assert.deepEqual(above.spendingPercentiles,equal.spendingPercentiles);
  assert.deepEqual(above.assetPercentiles,equal.assetPercentiles);
});

test('every year must meet the minimum, including first-year shortfall and subsequent real cuts',()=>{
  const c=config({initial:1000000,rate:.12,strategy:'percent',minimumMonthlySpending:8000});
  // First two real annual payments are 120,000 and 96,000; the third is 76,800.
  assert.equal(evaluate({...c,years:2},flat({...c,years:2},1.1)).lifestyle,1);
  assert.equal(evaluate(c,flat(c,1.1)).lifestyle,0);
  for(const strategy of Object.keys(STRATEGIES)){
    const firstYear=config({strategy,minimumMonthlySpending:100000.01});
    assert.equal(evaluate(firstYear,flat(firstYear)).lifestyle,0);
  }
});

test('zero withdrawals only meet a zero minimum; exhaustion still fails with no spending minimum',()=>{
  const c=config({rate:0});
  assert.equal(evaluate(c,flat(c)).lifestyle,0);
  assert.equal(evaluate({...c,minimumMonthlySpending:0},flat(c)).lifestyle,1);
  const depleted=config({years:5,rate:.2,minimumMonthlySpending:0});
  assert.equal(evaluate(depleted,flat(depleted)).lifestyle,0);
});

test('monthly floor validation accepts money above initial spending and rejects invalid amounts',()=>{
  validate(config({minimumMonthlySpending:200000}));
  for(const minimumMonthlySpending of [-1,NaN,Infinity,1e12+.01])assert.throws(()=>validate(config({minimumMonthlySpending})),/minimumMonthlySpending/);
});

test('legacy relative floors migrate once to cents, preserving zero and explicit monetary settings',()=>{
  const saved={currency:'TWD',initial:30000000,rate:.04,spendingFloor:.5,successTarget:.95,successMetric:'survival'};
  const migrated=restoreConfig(saved);
  assert.equal(migrated.minimumMonthlySpending,50000);
  for(const key of ['spendingFloor','successTarget','successMetric'])assert.equal(Object.hasOwn(migrated,key),false);
  assert.equal(restoreConfig({...migrated,initial:60000000,rate:.06}).minimumMonthlySpending,50000);
  assert.equal(restoreConfig({...saved,spendingFloor:0}).minimumMonthlySpending,0);
  assert.equal(restoreConfig({...saved,minimumMonthlySpending:1234.56}).minimumMonthlySpending,1234.56);
  assert.equal(restoreConfig({...saved,minimumMonthlySpending:0}).minimumMonthlySpending,0);
  assert.equal(restoreConfig({currency:'USD',initial:1000000,rate:.04,spendingFloor:.8}).minimumMonthlySpending,2666.67);
  assert.equal(restoreConfig({currency:'TWD',initial:30000000,rate:.04}).minimumMonthlySpending,80000);
  assert.equal(currencyDefaults('TWD').minimumMonthlySpending,80000);
  assert.equal(currencyDefaults('USD').minimumMonthlySpending,2666.67);
});
