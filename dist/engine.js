import { vcmmRate } from './data.js';
import {resolveScenario} from './scenarios.js';
export const STRATEGIES={fixed:'固定實質金額',percent:'固定資產比例',gk:'Guyton–Klinger 護欄',dynamic:'動態支出上下限'};
export const DEFAULTS={currency:'USD',initial:1000000,years:50,rate:0.04,strategy:'fixed',paths:10000,seed:741,
  returnMode:'custom',sampling:'parametric',cagr:0.07,vol:0.18,fee:0.0006,drag:0,
  inflationModel:'constant',inflation:0.025,inflationVol:0.015,block:24,
  usWeight:0.63,transition:10,longRun:0.07,guard:0.2,adjust:0.1,ceiling:0.05,floor:0.025,
  minimumMonthlySpending:2666.67};
export function validate(config,data){
  const c=resolveScenario(config,data);
  if(!['USD','TWD'].includes(c.currency))throw Error('未知幣種。');
  const bounds={initial:[1,1e12],years:[1,60],rate:[0,0.2],paths:[100,100000],seed:[0,4294967295],cagr:[-0.2,0.3],vol:[0,0.8],fee:[0,0.05],drag:[-0.05,0.05],inflation:[-0.05,0.2],inflationVol:[0,0.2],block:[1,120],usWeight:[0,1],transition:[1,30],longRun:[-0.2,0.3],guard:[0.01,0.8],adjust:[0.01,0.5],ceiling:[0,0.5],floor:[0,0.5],minimumMonthlySpending:[0,1e12]};
  for(const [k,[lo,hi]] of Object.entries(bounds))if(!Number.isFinite(c[k])||c[k]<lo||c[k]>hi)throw Error(`${k} 必須介於 ${lo} 與 ${hi}。`);
  for(const k of ['years','paths','seed','block','transition'])if(!Number.isInteger(c[k]))throw Error(`${k} 必須為整數。`);
  if(!STRATEGIES[c.strategy])throw Error('未知提領策略。');
  if(!['historical','custom','vcmm','msci'].includes(c.returnMode)||!['parametric','stationary','iid'].includes(c.sampling)||!['constant','preset','lognormal','historical','cpi'].includes(c.inflationModel))throw Error('未知市場模型。');
  if(c.returnMode==='historical'&&c.sampling==='parametric')throw Error('歷史模式請使用 Block Bootstrap 或 IID。');
  if((c.returnMode==='historical'||c.sampling!=='parametric')&&(!data||data.returns.length<24))throw Error('尚未載入專案歷史股票月資料。請選自訂／VCMM 參數模型。');
  if(c.inflationModel==='historical'&&(!data?.inflation?.length||c.sampling==='parametric'))throw Error('同步歷史通膨需與股票月份對齊，搭配歷史抽樣。');
  if(c.inflationModel==='cpi'){
    const series=data?.cpi;
    if(!series||series.currency!==c.currency||series.inflation.length<24||series.dates.length!==series.inflation.length||series.inflation.some(v=>!Number.isFinite(v)||v<=-1))throw Error('內建 CPI 資料無效或幣種不符。');
  }
  if(c.sampling!=='parametric'&&data){
    if(data.returns.some(v=>!Number.isFinite(v)||v<=-1))throw Error('歷史月報酬無效。');
    if(c.inflationModel==='historical'&&(data.inflation.length!==data.returns.length||data.inflation.some(v=>!Number.isFinite(v)||v<=-1)))throw Error('CPI／通膨必須與股票月資料完整對齊。');
  }
}
// SplitMix-style integer mixing, deterministic uniform on (0,1).
export function rng(seed){let s=seed>>>0;return ()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296+0.5/4294967296;};}
function normal(random){return Math.sqrt(-2*Math.log(random()))*Math.cos(2*Math.PI*random());}
export function targetLog(c,year){
  if(c.returnMode!=='vcmm')return Math.log1p(c.cagr);
  const near=Math.log1p(vcmmRate(c.usWeight)),far=Math.log1p(c.longRun);
  if(year<10)return near;
  return near+(far-near)*Math.min(1,(year-9)/c.transition);
}
export function prepareMarket(config,data,progress=()=>{}){
  const c=resolveScenario(config,data);
  validate(c,data);const t=performance.now(),random=rng(c.seed),n=c.paths,T=c.years;
  const factors=new Float64Array(n*T),inflation=new Float64Array(n*T);
  const logs=data?.returns.map(Math.log1p),plogs=data?.inflation?.map(Math.log1p);
  // CPI-only resampling uses a separate stream: no claimed stock/CPI correlation.
  const cpiLogs=c.inflationModel==='cpi'?data.cpi.inflation.map(Math.log1p):null;
  const serial=month=>Number(month.slice(0,4))*12+Number(month.slice(5))-1;
  const cpiNext=cpiLogs?data.cpi.dates.map((date,i)=>i+1<cpiLogs.length&&serial(data.cpi.dates[i+1])-serial(date)===1?i+1:null):null;
  const cpiRandom=rng((c.seed^0xA5A5A5A5)>>>0);
  const inflationRandom=rng((c.seed^0x9E3779B9)>>>0);
  const cpiStarts=cpiLogs?data.cpi.dates.flatMap((_,i)=>i===0||cpiNext[i-1]===null?[i]:[]):null;
  // Forced boundary restarts remove incoming continuation at segment starts.
  // Give those starts L times the restart weight of internal months: with
  // continuation 1-1/L, every month then retains marginal probability 1/n.
  const restartCpi=()=>{
    const u=cpiRandom(),n=cpiLogs.length;
    if(cpiStarts.length===n)return Math.floor(u*n);
    const mass=u*(n+cpiStarts.length*(c.block-1));
    return mass<n?Math.floor(mass):cpiStarts[Math.floor((mass-n)/(c.block-1))];
  };
  const histMean=logs?.reduce((a,b)=>a+b,0)/logs?.length;
  const costs=(data?.kind==='fund-net'&&c.sampling!=='parametric')?1:(1-c.fee)*Math.exp(-c.drag);
  const sig=c.vol/Math.sqrt(12),inflMu=Math.log1p(c.inflation)/12,inflSig=c.inflationVol/Math.sqrt(12);
  const targets=Array.from({length:T},(_,y)=>targetLog(c,y)/12);
  for(let p=0;p<n;p++){
    let idx=logs?.length?Math.floor(random()*logs.length):0;
    let cpiIdx=cpiLogs?Math.floor(cpiRandom()*cpiLogs.length):0;
    for(let y=0;y<T;y++){
      let total=0,pi=0;
      for(let m=0;m<12;m++){
        if(c.sampling==='parametric')total+=targets[y]+sig*normal(random);
        else {
          if(m!==0||y!==0){idx=(c.sampling==='iid'||random()<1/c.block)?Math.floor(random()*logs.length):(idx+1)%logs.length;}
          total+=logs[idx]+(c.returnMode==='historical'?0:targets[y]-histMean);
        }
        if(cpiLogs){
          if(m||y)cpiIdx=cpiNext[cpiIdx]===null||cpiRandom()<1/c.block?restartCpi():cpiNext[cpiIdx];
          pi+=cpiLogs[cpiIdx];
        }else pi+=c.inflationModel==='historical'?plogs[idx]:inflMu+(c.inflationModel==='lognormal'?inflSig*normal(inflationRandom):0);
      }
      factors[p*T+y]=Math.exp(total)*costs;inflation[p*T+y]=Math.exp(pi);
      if(!Number.isFinite(factors[p*T+y])||!Number.isFinite(inflation[p*T+y])||factors[p*T+y]<=0||inflation[p*T+y]<=0)throw Error('報酬或通膨造成數值溢位；請檢查輸入單位與資料。');
    }
    if(p%1000===0)progress(p/n*0.5,'產生市場路徑');
  }
  return {factors,inflation,paths:n,years:T,elapsed:performance.now()-t};
}
// Spending decided at the start of each year; the remaining portfolio earns the full year's total return.
export function withdrawal(c,{year,wealth,price,previous,previousPrice,previousReturn}){
  if(year===0)return c.initial*c.rate;
  const base=c.initial*c.rate;
  if(c.strategy==='fixed')return base*price;
  if(c.strategy==='percent')return wealth*c.rate;
  const inflated=previous*price/previousPrice;
  if(c.strategy==='dynamic')return Math.min(inflated*(1+c.ceiling),Math.max(inflated*(1-c.floor),wealth*c.rate));
  let spend=inflated;
  if(previousReturn<0&&spend/wealth>c.rate&&price>previousPrice)spend=previous;
  if(spend/wealth>c.rate*(1+c.guard)&&c.years-year>15)spend*=1-c.adjust;
  else if(spend/wealth<c.rate*(1-c.guard))spend*=1+c.adjust;
  return spend;
}
export function wilson(successes,n){const z=1.95996398454,phat=successes/n,den=1+z*z/n,mid=(phat+z*z/(2*n))/den,half=z*Math.sqrt(phat*(1-phat)/n+z*z/(4*n*n))/den;return [Math.max(0,mid-half),Math.min(1,mid+half)];}
export function quantile(sorted,q){const pos=(sorted.length-1)*q,lo=Math.floor(pos);return sorted[lo]+(sorted[Math.min(lo+1,sorted.length-1)]-sorted[lo])*(pos-lo);}
export function evaluate(c,market,{summaryOnly=false,progress=()=>{}}={}){
  const t=performance.now(),N=market.paths,T=market.years,base=c.initial*c.rate,annualMinimum=c.minimumMonthlySpending*12;
  const assets=summaryOnly?null:Array.from({length:T+1},()=>new Float64Array(N));
  const spends=summaryOnly?null:Array.from({length:T},()=>new Float64Array(N));
  const terminal=new Float64Array(N),depletion=new Uint32Array(T+1),drops=[0,0,0,0];
  let ruined=0,lifestyle=0,minRatioSum=0,worstId=0,bestId=0;
  for(let p=0;p<N;p++){
    let wealth=c.initial,price=1,previous=base,previousPrice=1,previousReturn=0,minRatio=1,minRealSpending=Infinity,ruinYear=0;
    if(assets)assets[0][p]=wealth;
    for(let y=0;y<T;y++){
      const desired=wealth>0?withdrawal(c,{year:y,wealth,price,previous,previousPrice,previousReturn}):0;
      if(!Number.isFinite(desired))throw Error('支出超出數值範圍；請檢查資料與假設。');
      const actual=Math.min(wealth,Math.max(0,desired)),real=actual/price;
      if(spends)spends[y][p]=real;
      minRealSpending=Math.min(minRealSpending,real);
      if(base>0)minRatio=Math.min(minRatio,real/base);
      if(!ruinYear&&((wealth-actual)<=c.initial*1e-12||actual+1e-8<desired)){ruinYear=y+1;}
      const k=p*T+y;wealth=Math.max(0,(wealth-actual)*market.factors[k]);
      previousReturn=market.factors[k]-1;previous=actual;previousPrice=price;price*=market.inflation[k];
      if(!Number.isFinite(wealth/price)||!Number.isFinite(price)||price<=0)throw Error('累積資產或物價超出數值範圍；請檢查資料與假設。');
      if(assets)assets[y+1][p]=wealth/price;
    }
    terminal[p]=wealth/price;minRatioSum+=minRatio;
    if(terminal[p]<terminal[worstId]||p===0)worstId=p;
    if(terminal[p]>terminal[bestId])bestId=p;
    if(ruinYear){ruined++;depletion[ruinYear]++;}
    // Compare actual annual spending in today's purchasing power, independently of the initial withdrawal.
    const goodSpending=minRealSpending+16*Number.EPSILON*Math.max(1,annualMinimum)>=annualMinimum;
    if(!ruinYear&&goodSpending)lifestyle++;
    [0.1,0.2,0.3,0.5].forEach((d,i)=>{if(minRatio<1-d-1e-10)drops[i]++;});
    if(!summaryOnly&&p%5000===0)progress(0.5+p/N*0.25,'套用提領策略');
  }
  const survival=1-ruined/N,success=lifestyle/N;
  const out={survival,success,lifestyle:success,ruined,paths:N,drops:drops.map(v=>v/N),depletion:Array.from(depletion),survivalCI:wilson(N-ruined,N),successCI:wilson(lifestyle,N),meanMinSpendingRatio:minRatioSum/N,elapsed:performance.now()-t};
  if(summaryOnly)return out;
  const qs=[.01,.05,.25,.5,.75,.95,.99];
  const percentiles=series=>series.map((v,i)=>{const sorted=v.slice().sort();return {year:i,values:qs.map(q=>quantile(sorted,q))};});
  out.assetPercentiles=percentiles(assets);progress(.85,'計算資產百分位數');
  out.spendingPercentiles=percentiles(spends).map(x=>({...x,year:x.year+1}));
  out.samples={worst:{id:worstId,assets:assets.map(v=>v[worstId]),spending:spends.map(v=>v[worstId])},best:{id:bestId,assets:assets.map(v=>v[bestId]),spending:spends.map(v=>v[bestId])}};
  const sorted=terminal.slice().sort();out.terminal=qs.map(q=>quantile(sorted,q));out.terminalMean=terminal.reduce((a,b)=>a+b/N,0);
  // Histogram uses log1p on real terminal wealth, retaining zero outcomes in first bin.
  const max=Math.log1p(sorted[N-1]/c.initial),bins=Array.from({length:32},(_,i)=>({low:c.initial*Math.expm1(max*i/32),high:c.initial*Math.expm1(max*(i+1)/32),count:0}));
  for(const v of terminal){const i=max?Math.min(31,Math.floor(Math.log1p(v/c.initial)/max*32)):0;bins[i].count++;}out.histogram=bins;
  const deaths=[];for(let y=1;y<=T;y++)for(let k=0;k<depletion[y];k++)deaths.push(y);out.medianDepletion=deaths.length?quantile(deaths,.5):null;
  out.elapsed=performance.now()-t;return out;
}
