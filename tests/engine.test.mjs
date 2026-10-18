import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS as D,prepareMarket,evaluate,withdrawal,rng,quantile,wilson,targetLog,validate} from '../dist/engine.js';
import {parseCSV,statistics,vcmmRate} from '../dist/data.js';
const near=(actual,expected,tol=1e-8)=>assert.ok(Math.abs(actual-expected)<tol,`${actual} != ${expected}`);
const config=over=>({...D,paths:100,years:5,vol:0,fee:0,inflation:0,cagr:0,...over});
const state=over=>({year:1,wealth:1e6,price:1,previous:40000,previousPrice:1,previousReturn:.1,...over});
const flat=(c,factor=1,inf=1)=>({paths:c.paths,years:c.years,factors:new Float64Array(c.paths*c.years).fill(factor),inflation:new Float64Array(c.paths*c.years).fill(inf)});

test('Seeded RNG reproducible, in open unit interval, distinct seeds',()=>{const a=rng(741),b=rng(741),c=rng(742);let different=false;for(let i=0;i<1000;i++){const n=a();assert.ok(n>0&&n<1);assert.equal(n,b());different||=n!==c();}assert.ok(different);});
test('No-return fixed spending: annual beginning withdrawal and terminal balance',()=>{const c=config({rate:.04});const r=evaluate(c,flat(c));near(r.terminal[3],800000);near(r.spendingPercentiles[4].values[3],40000);assert.equal(r.survival,1);});
test('Return is applied after spending, not before',()=>{const c=config({years:1});const r=evaluate(c,flat(c,1.1));near(r.terminal[3],1056000);});
test('Real assets and spending correctly deflated',()=>{const c=config({years:2});const r=evaluate(c,flat(c,1.1,1.1));near(r.terminal[3],920000);near(r.spendingPercentiles[1].values[3],40000);});
test('Insufficient funds count as exhaustion and actual spending capped',()=>{const c=config({years:30,rate:.1});const r=evaluate(c,flat(c));assert.equal(r.ruined,100);assert.equal(r.medianDepletion,10);assert.equal(r.spendingPercentiles[10].values[3],0);assert.equal(r.drops[3],1);});
test('Fixed percent does not mathematically exhaust but has spending risk',()=>{const c=config({strategy:'percent',years:50,rate:.04});const r=evaluate(c,flat(c));assert.equal(r.survival,1);assert.equal(r.lifestyle,0);near(r.spendingPercentiles[49].values[3],40000*.96**49,1e-6);assert.equal(r.drops[3],1);});
test('Fee and extra tracking drag applied once annually; ETF-NAV bypass',()=>{const c=config({rate:0,years:1,fee:.0006,drag:.001});let r=evaluate(c,prepareMarket(c));near(r.terminal[3],1e6*(1-.0006)*Math.exp(-.001),1e-6);const returns=Array(24).fill(0),data={returns,inflation:[],kind:'fund-net'};const d={...c,returnMode:'historical',sampling:'stationary'};r=evaluate(d,prepareMarket(d,data));near(r.terminal[3],1e6);});
test('Custom input is geometric log drift; costs are separate',()=>{const c=config({rate:0,cagr:.07,years:10});const m=prepareMarket(c);near(m.factors[0],1.07);near(evaluate(c,m).terminal[3],1e6*1.07**10,1e-5);});
test('Parametric empirical log mean and volatility match assumptions',()=>{const c=config({paths:100000,years:1,vol:.18,cagr:.07});const m=prepareMarket(c);const logs=Array.from(m.factors,Math.log),mean=logs.reduce((a,b)=>a+b)/logs.length;const sd=Math.sqrt(logs.reduce((a,b)=>a+(b-mean)**2,0)/(logs.length-1));near(mean,Math.log1p(.07),.002);near(sd,.18,.002);});
test('Stationary bootstrap reproducibility; paired CPI preserves identity',()=>{const returns=Array.from({length:48},(_,i)=>(i%6-2)/100);const data={returns,inflation:[...returns],kind:'index-net'};const c=config({sampling:'stationary',returnMode:'historical',inflationModel:'historical',rate:0});const a=prepareMarket(c,data),b=prepareMarket(c,data);assert.deepEqual(a.factors,b.factors);const r=evaluate(c,a);for(const v of r.terminal)near(v,1e6,1e-6);});
test('Stationary sampler follows geometric restart and circular sequence exactly',()=>{const data={returns:Array.from({length:36},(_,i)=>.001*i),inflation:[]};for(const block of [1,12,120]){const c=config({sampling:'stationary',returnMode:'historical',block,years:2}),random=rng(c.seed),m=prepareMarket(c,data);let idx=Math.floor(random()*36);for(let y=0;y<2;y++){let product=1;for(let month=0;month<12;month++){if(y||month)idx=random()<1/block?Math.floor(random()*36):(idx+1)%36;product*=1+data.returns[idx];}near(m.factors[y],product);}}});
test('GK cancels positive inflation only when proposed rate exceeds original',()=>{const c=config({strategy:'gk',years:50});near(withdrawal(c,state({wealth:1e6,price:1.02,previousReturn:-.1})),40000);near(withdrawal(c,state({wealth:1.1e6,price:1.02,previousReturn:-.1})),40800);near(withdrawal(c,state({wealth:1e6,price:.98,previousReturn:-.1})),39200);});
test('GK strict guard boundaries; capital preservation stops in final 15 years',()=>{const c=config({strategy:'gk',years:50});near(withdrawal(c,state({wealth:40000/.048})),40000);near(withdrawal(c,state({wealth:800000})),36000);near(withdrawal(c,state({wealth:800000,year:35})),40000);near(withdrawal(c,state({wealth:40000/.032})),40000);near(withdrawal(c,state({wealth:1.5e6})),44000);});
test('GK no obsolete 6% cap and only one adjustment per year',()=>{const c=config({strategy:'gk',years:50});near(withdrawal(c,state({price:1.1,wealth:1e6})),44000);near(withdrawal(c,state({wealth:100000})),36000);});
test('Dynamic ceiling/floor apply to CPI-adjusted previous spending',()=>{const c=config({strategy:'dynamic'});near(withdrawal(c,state({price:1.1,wealth:2e6})),40000*1.1*1.05);near(withdrawal(c,state({price:1.1,wealth:1e5})),40000*1.1*.975);});
test('Quantiles ordered, exact endpoints, Wilson reference values',()=>{const a=new Float64Array([1,2,3,4]);near(quantile(a,.5),2.5);near(quantile(a,0),1);const ci=wilson(9500,10000);assert.ok(ci[0]<.95&&ci[1]>.95);near(ci[0],.945552,.00001);});
test('Result summaries and complete evaluation agree; every quantile monotonic',()=>{const c=config({vol:.18,cagr:.06}),m=prepareMarket(c),r=evaluate(c,m),s=evaluate(c,m,{summaryOnly:true});for(const k of ['survival','success','lifestyle','ruined'])assert.equal(r[k],s[k]);for(const a of [...r.assetPercentiles,...r.spendingPercentiles])for(let i=1;i<7;i++)assert.ok(a.values[i]>=a.values[i-1]&&a.values[i-1]>=0);});
test('VCMM anchor and transition explicitly respect horizons',()=>{near(vcmmRate(.63),.05089);const c=config({returnMode:'vcmm',transition:10,longRun:.07});near(targetLog(c,9),Math.log1p(.05089));near(targetLog(c,10),Math.log1p(.05089)+(Math.log1p(.07)-Math.log1p(.05089))*.1);near(targetLog(c,19),Math.log1p(.07));near(targetLog(c,49),Math.log1p(.07));});
test('CSV validates dates, decimals, gaps, duplicates, CPI and costs',()=>{const lines=['date,index,cpi'];for(let i=0;i<25;i++)lines.push(`${2000+Math.floor(i/12)}-${String(i%12+1).padStart(2,'0')},${100*1.01**i},${100*1.002**i}`);const d=parseCSV(lines.join('\n'));assert.equal(d.returns.length,24);near(d.stats.cagr,1.01**12-1);near(d.inflation[0],.002);assert.throws(()=>parseCSV(lines.join('\n').replace('2000-02','2000-03')),/連續/);assert.throws(()=>parseCSV(lines.join('\n').replace('2000-02','2000-02-30')),/日數/);assert.throws(()=>parseCSV(lines.join('\n').replace('100,100','0,100')),/大於/);assert.throws(()=>parseCSV('date,return\n2000-01,-1\n2000-02,0'),/大於/);});
test('CSV handles BOM CRLF quoted numbers, rejects percent suffix and blank fields',()=>{let lines=['\uFEFFdate,return'];for(let i=0;i<24;i++)lines.push(`${2000+Math.floor(i/12)}-${String(i%12+1).padStart(2,'0')},"0.01"`);assert.equal(parseCSV(lines.join('\r\n')).returns.length,24);assert.throws(()=>parseCSV(lines.join('\n').replace('"0.01"','1%')),/有限/);assert.throws(()=>parseCSV(lines.join('\n').replace('"0.01"','')),/空白/);});
test('No data never silently falls back; invalid parameters rejected',()=>{assert.throws(()=>prepareMarket(config({returnMode:'historical',sampling:'stationary'})),/尚未載入/);assert.throws(()=>validate(config({paths:100001})),/paths/);assert.throws(()=>validate(config({years:2.5})),/整數/);assert.throws(()=>validate(config({inflationModel:'historical'})),/通膨/);});
test('Arithmetic and geometric return are distinct, lag correlation finite for constant series',()=>{const s=statistics([.1,-.1]);near(s.arithmeticAnnual,0);assert.ok(s.cagr<0);const z=statistics(Array(24).fill(0));near(z.autocorrelation,0);});

test('Annual arithmetic expectation includes the lognormal variance term',()=>{
  const c=config({paths:100000,years:1,cagr:.07,vol:.18});
  const m=prepareMarket(c),mean=m.factors.reduce((a,b)=>a+b)/c.paths;
  near(mean,Math.exp(Math.log1p(.07)+.18**2/2),.003);
});
test('IID pairs each equity month with CPI and shifts only equity log drift',()=>{
  const returns=Array.from({length:36},(_,i)=>(i-15)/1000),data={returns,inflation:[...returns],kind:'index-net'};
  const c=config({sampling:'iid',returnMode:'custom',inflationModel:'historical',years:2,cagr:.06});
  const m=prepareMarket(c,data),random=rng(c.seed),mean=returns.map(Math.log1p).reduce((a,b)=>a+b)/36;
  let idx=Math.floor(random()*36);
  for(let y=0;y<2;y++){
    let pi=1;for(let month=0;month<12;month++){if(y||month)idx=Math.floor(random()*36);pi*=1+returns[idx];}
    near(m.inflation[y],pi);near(m.factors[y]/pi,Math.exp(Math.log1p(.06)-12*mean));
  }
});
test('Stochastic inflation has the specified geometric drift and log volatility',()=>{
  const c=config({paths:100000,years:1,inflationModel:'lognormal',inflation:.025,inflationVol:.015});
  const logs=Array.from(prepareMarket(c).inflation,Math.log),mean=logs.reduce((a,b)=>a+b)/logs.length;
  near(mean,Math.log1p(.025),.0002);near(Math.sqrt(logs.reduce((s,v)=>s+(v-mean)**2,0)/(logs.length-1)),.015,.0002);
});
test('Mixed return/CPI and index/inflation input align on the calculable month',()=>{
  for(const header of ['date,return,cpi','date,index,inflation']){
    const csv=[header,...Array.from({length:25},(_,i)=>`${2000+Math.floor(i/12)}-${String(i%12+1).padStart(2,'0')},${header.includes('return')?i/1000:100*1.01**i},${header.includes('cpi')?100*1.002**i:i/1000}`)].join('\n');
    const d=parseCSV(csv);assert.equal(d.dates[0],'2000-02');assert.equal(d.returns.length,24);assert.equal(d.inflation.length,24);
    near(d.returns[0],header.includes('return')?.001:.01);near(d.inflation[0],header.includes('cpi')?.002:.001);
  }
});
test('Derived level returns reject overflow and underflow instead of accepting corrupt statistics',()=>{
  for(const [first,second] of [[1e-300,1e300],[1e300,1e-300]]){
    const lines=['date,index',...Array.from({length:25},(_,i)=>`${2000+Math.floor(i/12)}-${String(i%12+1).padStart(2,'0')},${i?second:first}`)];
    assert.throws(()=>parseCSV(lines.join('\n')),/數值範圍/);
  }
});
test('Zero withdrawal preserves spending semantics and exact final-year exhaustion counts',()=>{
  const c=config({rate:0,years:2});const r=evaluate(c,flat(c));assert.equal(r.lifestyle,0);assert.equal(evaluate({...c,minimumMonthlySpending:0},flat(c)).lifestyle,1);assert.deepEqual(r.drops,[0,0,0,0]);
  const d=config({rate:.2,years:5});assert.equal(evaluate(d,flat(d)).depletion[5],d.paths);
});
test('Multi-year overflow cannot leak NaN or Infinity into research summaries',()=>{
  const c=config({years:5,rate:0});
  assert.throws(()=>evaluate(c,flat(c,1e100)),/數值範圍/);
  assert.throws(()=>evaluate(c,flat(c,1,1e-100)),/數值範圍/);
});
