import {DEFAULTS,prepareMarket,evaluate} from '../dist/engine.js';
import {writeFileSync} from 'node:fs';
import os from 'node:os';
const reports=[];
for(const paths of [10000,100000]){
  const c={...DEFAULTS,paths},begin=performance.now();
  const market=prepareMarket(c),prepared=performance.now();
  const r=evaluate(c,market),end=performance.now();
  const report={runtime:process.version,cpu:os.cpus()[0]?.model,paths,years:c.years,currency:c.currency,minimumMonthlySpending:c.minimumMonthlySpending,model:c.sampling,marketMs:prepared-begin,evaluationMs:end-prepared,totalMs:end-begin,ruin:1-r.survival,lifestyle:r.lifestyle,seed:c.seed};
  reports.push(report);console.log(JSON.stringify(report));
}
writeFileSync('docs/benchmark-node.json',JSON.stringify({executed:new Date().toISOString(),environment:'Node on development host, not a browser claim',reports},null,2));
