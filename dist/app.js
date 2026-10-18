import{currencyDefaults,CURRENCIES,restoreConfig}from './currency.js';
import{DEFAULTS,STRATEGIES,validate}from './engine.js';
import{vcmmRate,VCMM,statistics}from './data.js';
import{datasetForCurrency}from './datasets.js';
import{CPI}from './cpi-data.js';
import{fanChart,barChart,money,pct}from './charts.js';
import{amountInput}from './amount-input.js';
import{fieldHelp}from './field-help.js';
import{resolveScenario,scenarioMetadata,isCustomReturn,isCustomInflation}from './scenarios.js';
import{EQUITY_PARAMETERS}from './equity-parameters.js';
const $=id=>document.getElementById(id);
const initialAmount=amountInput($('initial'),$('initialError'));
const minimumAmount=amountInput($('minimumMonthlySpending'),$('minimumSpendingError'),{label:'最低每月生活費',fractionDigits:2});
fieldHelp($('parameters'));
function setDrawer(open){document.querySelector('.sidebar').classList.toggle('open',open);$('mobileParams').setAttribute('aria-expanded',String(open));}
const fractionFields=new Set(['rate','cagr','vol','fee','drag','inflation','inflationVol','usWeight','longRun','guard','adjust','ceiling','floor']);
const stringFields=new Set(['currency','strategy','returnMode','sampling','inflationModel']);
let selectedStrategy=null;
let selectedReturnMode=null,selectedInflationMode=null;
let customReturns={cagr:DEFAULTS.cagr,vol:DEFAULTS.vol};
let customInflation=inflationDrafts('TWD');
let dataset=null,last=null,busy=false,worker=null,job=0,activeJob=null,comparisons=null,assumptions=null;
const descriptions={fixed:'每年維持初始生活費的購買力，支出穩定但可能耗盡資產。',percent:'按當年資產提領固定比例，支出跟著市場變化，生活費可能大幅縮水。',gk:'依護欄加減支出；全股票改編，最後 15 年停用減碼護欄。',dynamic:'以資產比例決定目標支出，限制每年實質調幅，仍可能耗盡資產。'};
function readFields(){const c={};for(const k of Object.keys(DEFAULTS)){const e=$(k);c[k]=k==='initial'?initialAmount.read():k==='minimumMonthlySpending'?minimumAmount.read():stringFields.has(k)?e.value:Number(e.value)/(fractionFields.has(k)?100:1);}return c;}
function config(){return resolveScenario(readFields(),dataset);}
function inflationDrafts(currency){const p=CURRENCIES[currency];return{constant:{inflation:p.inflation,inflationVol:0},lognormal:{inflation:p.inflation,inflationVol:p.inflationVol}};}
function rememberCustom(c){
  if(isCustomReturn(c.returnMode)&&Number.isFinite(c.cagr)&&Number.isFinite(c.vol))customReturns={cagr:c.cagr,vol:c.vol};
  if(isCustomInflation(c.inflationModel)&&Number.isFinite(c.inflation)&&Number.isFinite(c.inflationVol))customInflation[c.inflationModel]={inflation:c.inflation,inflationVol:c.inflationModel==='constant'?0:c.inflationVol};
}
function writeNumbers(c,keys){for(const k of keys)$(k).value=fractionFields.has(k)?Number((c[k]*100).toPrecision(12)):c[k];}
function fill(c){for(const[k,v]of Object.entries(c))if($(k)){if(k==='initial')initialAmount.write(v);else if(k==='minimumMonthlySpending')minimumAmount.write(v);else $(k).value=fractionFields.has(k)?Number((v*100).toPrecision(12)):v;}selectedReturnMode=c.returnMode;selectedInflationMode=c.inflationModel;rememberCustom(c);sync();}
function minimumLabel(c){return `每月至少 ${money(c.minimumMonthlySpending,false,c.currency,2)}（今天購買力）`;}
function sync(){let c=readFields();
  rememberCustom({...c,returnMode:selectedReturnMode,inflationModel:selectedInflationMode});
  if(selectedReturnMode!==null&&c.returnMode!==selectedReturnMode&&isCustomReturn(c.returnMode))Object.assign(c,customReturns);
  if(selectedInflationMode!==null&&c.inflationModel!==selectedInflationMode&&isCustomInflation(c.inflationModel))Object.assign(c,customInflation[c.inflationModel]);
  const label=CURRENCIES[c.currency].label;
  $('initialCurrency').textContent=c.currency;
  $('minimumSpendingCurrency').textContent=c.currency;
  const annualMinimum=c.minimumMonthlySpending*12,initialSpending=c.initial*c.rate;
  $('minimumSpendingHint').textContent=Number.isFinite(annualMinimum)?`以今天的購買力計，每年 ${money(annualMinimum,false,c.currency,2)}。`+(initialSpending>0?`相當於目前初始生活費的 ${pct(annualMinimum/initialSpending)}。`:''):'請輸入有效的最低每月生活費。';
  $('minimumSpendingWarning').hidden=!(annualMinimum>initialSpending+16*Number.EPSILON*Math.max(1,annualMinimum));
  if(!last)$('lifestyleNote').textContent=Number.isFinite(c.minimumMonthlySpending)?`錢未用完，且${minimumLabel(c)}`:'請設定最低每月生活費。';
  $('planCurrency').textContent=c.currency;
  $('purchasingPowerLabel').textContent=label+'通膨';
  $('currencyHint').textContent=c.currency==='TWD'?'台幣模式假設美元兌台幣匯率不變。':'切換幣種會套用對應的資產與通膨預設。';
  $('inflationModel').querySelector('[value="cpi"]').textContent=label+'歷史通膨（CPI）';
  if(dataset?.cpi?.currency!==c.currency){dataset=datasetForCurrency(c.currency);dataSummary();}
  c=resolveScenario(c,dataset);
  writeNumbers(c,['usWeight','longRun','transition']);
  if(isCustomReturn(c.returnMode)&&selectedReturnMode!==c.returnMode)writeNumbers(c,['cagr','vol']);
  if(isCustomInflation(c.inflationModel)&&selectedInflationMode!==c.inflationModel)writeNumbers(c,['inflation','inflationVol']);
  if(!isCustomReturn(c.returnMode))for(const id of ['cagr','vol'])$(id).value=(c[id]*100).toFixed(id==='cagr'&&c.returnMode==='vcmm'?3:2);
  if(!isCustomInflation(c.inflationModel))for(const id of ['inflation','inflationVol'])$(id).value=(c[id]*100).toFixed(2);
  selectedReturnMode=c.returnMode;selectedInflationMode=c.inflationModel;
  for(const id of ['cagr','vol'])$(id).readOnly=!isCustomReturn(c.returnMode);
  $('vcmmFields').hidden=c.returnMode!=='vcmm';
  $('cagrLabel').textContent=c.returnMode==='vcmm'?'前 10 年報酬（幾何）':'長期年報酬（幾何）';
  $('returnPresetNote').textContent=c.returnMode==='vcmm'?'內建研究假設；需調整請選自訂。':c.returnMode==='msci'?`歷史估計 · ${EQUITY_PARAMETERS.sample?.from} — ${EQUITY_PARAMETERS.sample?.to}`:'依你的報酬與波動假設模擬。';
  const inflationCustom=isCustomInflation(c.inflationModel),inflationVariable=['lognormal','cpi'].includes(c.inflationModel);
  $('inflation').readOnly=!inflationCustom;
  $('inflation').disabled=false;
  $('inflationVol').readOnly=!inflationCustom;
  $('inflationVol').disabled=!inflationVariable;
  $('inflationVol').hidden=!inflationVariable;
  $('inflationVolNA').hidden=inflationVariable;
  $('inflationLabel').textContent=c.inflationModel==='cpi'?'歷史平均（幾何）':'年通膨';
  $('inflationPresetNote').textContent=c.inflationModel==='cpi'?'歷史樣本統計；實際逐月抽樣，並非固定通膨率。':c.inflationModel==='preset'?'規劃假設；需調整請選自訂。':'依你的通膨假設模擬。';
  $('inflationModelState').textContent='通膨與股票分開模擬。';
  $('inflationModelState').hidden=!inflationVariable;
  $('blockField').hidden=c.inflationModel!=='cpi';
  const hasDetails=['gk','dynamic'].includes(c.strategy);
  $('strategyDetails').hidden=!hasDetails;
  if(selectedStrategy!==c.strategy)$('strategyDetails').open=hasDetails;
  selectedStrategy=c.strategy;
  for(const [strategy,group,fields] of [['gk','gkFields',['guard','adjust']],['dynamic','dynamicFields',['ceiling','floor']]]){
    $(group).hidden=c.strategy!==strategy;
    for(const id of fields){
      if(c.strategy!==strategy&&(!Number.isFinite(c[id])||c[id]<Number($(id).min)/100||c[id]>Number($(id).max)/100)){$(id).value=DEFAULTS[id]*100;c[id]=DEFAULTS[id];}
      $(id).disabled=c.strategy!==strategy;
    }
  }
$('strategyHint').textContent=descriptions[c.strategy];$('vcmmAnchor').textContent=pct(vcmmRate(c.usWeight),3);if(!last){$('terminalNote').textContent='以今天的'+label+'購買力計';$('spendingMetric').textContent=Number.isFinite(c.initial)?money(c.initial*c.rate,false,c.currency):'—';$('spendingNote').textContent=Number.isFinite(c.initial)?`每月約 ${money(c.initial*c.rate/12,false,c.currency)} · 稅前`:'請輸入有效的初始資產。';$('horizon').textContent=`${c.years} 年`;}$('parameters').classList.toggle('dirty',!!(last||comparisons||assumptions));if(last||comparisons||assumptions)$('statusText').textContent='參數已更動；圖表保留上次執行結果，請重新模擬。';if(Object.values(c).every(v=>typeof v==='string'||Number.isFinite(v)))try{localStorage.setItem('retirement-config-v2',JSON.stringify({...c,customAssumptions:{returns:customReturns,inflation:customInflation}}));}catch{}}
function showTab(name){document.querySelectorAll('.tab-panel').forEach(el=>el.hidden=el.id!==name);document.querySelectorAll('[data-tab]').forEach(el=>{el.classList.toggle('active',el.dataset.tab===name);el.setAttribute('aria-selected',el.dataset.tab===name?'true':'false');});if(name==='dashboard')draw();}
function err(message){$('error').textContent=message;$('error').hidden=false;}
function setBusy(value){busy=value;$('fields').disabled=value;for(const id of ['compareRun','assumptionRun'])$(id).disabled=value;$('cancel').hidden=!value;$('progress').hidden=!value;$('status').classList.toggle('busy',value);}
function newWorker(){worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});worker.onmessage=({data:m})=>{if(m.id!==activeJob?.id)return;if(m.type==='progress'){$('progress').value=m.value;$('statusText').textContent=`${m.label} · ${pct(m.value,0)}`;return;}if(m.type==='error'){err(m.message);setBusy(false);$('statusText').textContent='運算未完成，請檢查資料與參數。';activeJob=null;return;}const c=activeJob.config;setBusy(false);$('statusText').textContent=`計算完成 · ${(m.elapsed/1000).toFixed(2)} 秒 · ${c.paths.toLocaleString()} 條路徑 · 種子 ${c.seed}`;if(m.action==='run'){last={result:m.result,config:c,elapsed:m.elapsed,timing:{marketMs:m.marketMs,marketCached:m.marketCached},at:new Date().toISOString(),data:{equityHistory:null,vcmm:{published:VCMM.published,asOf:VCMM.asOf},cpi:{used:c.inflationModel==='cpi',name:dataset.cpi.name,currency:c.currency,from:dataset.cpi.dates[0],to:dataset.cpi.dates.at(-1),version:dataset.cpi.version,retrieved:dataset.cpi.retrieved},fxAssumption:'constant'}};$('parameters').classList.remove('dirty');render();}if(m.action==='compare')renderComparison(m.result,c,m.elapsed);if(m.action==='assumptions')renderAssumptions(m.result,c,m.elapsed);activeJob=null;};worker.onerror=e=>{err('Worker 執行失敗：'+e.message);setBusy(false);worker.terminate();worker=null;activeJob=null;};}
function start(action){if(busy)return;$('error').hidden=true;const c=config();for(const [id,value]of [['initial',c.initial],['minimumMonthlySpending',c.minimumMonthlySpending]])if(!Number.isFinite(value)){setDrawer(true);$(id).reportValidity();return;}try{validate(c,dataset);}catch(e){err(e.message);if(!dataset&&c.returnMode==='historical')showTab('data');return;}if(!worker)newWorker();activeJob={id:++job,config:c};setBusy(true);$('progress').value=0;$('statusText').textContent='準備瀏覽器運算…';if(action==='run'){showTab('dashboard');setDrawer(false);}worker.postMessage({id:job,action,config:c,dataset,customReturns});}
function render(){const{result:r,config:c,elapsed}=last;$('ruinMetric').textContent=pct(1-r.survival);$('ruinNote').textContent=`${c.paths.toLocaleString()} 次模擬中，${r.ruined.toLocaleString()} 次用完`;$('ruinInterval').textContent=`耗盡機率的 95% 抽樣區間：${pct(1-r.survivalCI[1])}–${pct(1-r.survivalCI[0])}`;$('lifestyleMetric').textContent=pct(r.lifestyle);$('lifestyleNote').textContent=`錢未用完，且${minimumLabel(c)}`;$('terminalMetric').textContent=money(r.terminal[3],true,c.currency);$('terminalNote').textContent=`以今天的 ${c.currency} 購買力計`;$('spendingMetric').textContent=money(c.initial*c.rate,false,c.currency);$('spendingNote').textContent=`每月約 ${money(c.initial*c.rate/12,false,c.currency)} · 本次模擬`;$('horizon').textContent=`${c.years} 年`;
  $('riskBars').replaceChildren();[10,20,30,50].forEach((d,i)=>{const row=document.createElement('div');row.className='risk-row';const title=document.createElement('span');title.textContent=`下降 >${d}%`;const track=document.createElement('div');track.className='risk-track';const bar=document.createElement('div');bar.className='risk-fill';bar.style.width=`${r.drops[i]*100}%`;track.append(bar);const value=document.createElement('b');value.textContent=pct(r.drops[i]);row.append(title,track,value);$('riskBars').append(row);});
  $('viewYears').max=c.years;$('viewYears').value=c.years;$('yearInspect').max=c.years;$('yearInspect').value=Math.min(25,c.years);$('yearOutput').textContent=`第 ${$('yearInspect').value} 年`;
  $('depletionSubtitle').textContent=r.medianDepletion?`耗盡路徑的首次耗盡年度中位數：第 ${r.medianDepletion} 年`:'這批路徑未發生耗盡；不代表未來不會發生。';
  $('runMeta').textContent=`${c.currency} · ${STRATEGIES[c.strategy]} · ${c.years} 年 × ${c.paths.toLocaleString()} 路徑 · ${(elapsed/1000).toFixed(2)} 秒 · ${c.returnMode==='msci'?'MSCI 歷史估計':c.returnMode==='vcmm'?'VCMM 參考情境':'自訂假設'} · 股票：參數模型（對數常態） · 通膨：${c.inflationModel==='cpi'?'CPI 獨立區塊抽樣':c.inflationModel==='lognormal'?'自訂隨機':c.inflationModel==='preset'?'內建固定':'自訂固定'} · 種子 ${c.seed}`;
  $('exportCSV').disabled=false;$('exportJSON').disabled=false;draw();}
function draw(inspect=null){if(!last||$('dashboard').hidden)return;const{result:r,config:c}=last,years=Math.max(1,Math.min(c.years,Number($('viewYears').value)||c.years));document.querySelector('.primary-chart h2').textContent=`${c.years} 年後的你，可能站在哪裡？`;const sampleView=$('pathView').value==='samples';document.querySelector('.legend').innerHTML=sampleView?'<span class="key sample-best">期末最好樣本</span><span class="key sample-worst">期末最差樣本</span><span class="key median">中位數</span>':'<span class="key pale">中間 90%</span><span class="key mid">中間 50%</span><span class="key median">中位數</span>';$('yearInspect').max=years;$('yearOutput').textContent=`第 ${$('yearInspect').value} 年`;fanChart($('assetChart'),r.assetPercentiles,{currency:c.currency,tails:$('tails').checked,log:$('logScale').checked,initial:c.initial,years,samples:sampleView?r.samples:null,inspect,onYear:y=>{$('yearInspect').value=y;$('yearOutput').textContent=`第 ${y} 年`;}});fanChart($('spendingChart'),r.spendingPercentiles,{currency:c.currency,initial:c.initial*c.rate,years,spending:true,inspect:inspect===null?null:Math.max(1,inspect)});barChart($('histogram'),r.histogram,{N:c.paths,formatX:v=>money(v,true,c.currency),xlabel:'期末實質資產直方圖'});barChart($('depletionChart'),r.depletion.slice(1).map((count,i)=>({low:i+1,count})),{N:c.paths,formatX:v=>`${v}年`,xlabel:'首次耗盡年度'});}
function addRow(tbody,values){const tr=document.createElement('tr');values.forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.append(td);});tbody.append(tr);}
function renderComparison(rows,c,elapsed){comparisons={rows,config:c};$('compareTable').replaceChildren();for(const r of rows)addRow($('compareTable'),[STRATEGIES[r.strategy],pct(1-r.survival),pct(r.lifestyle),pct(r.drops[1]),pct(r.drops[3])]);$('compareMeta').textContent=`本次：初始 ${money(c.initial,false,c.currency)} · ${pct(c.rate)} · ${c.years} 年 · ${c.paths.toLocaleString()} 路徑 · ${minimumLabel(c)} · ${c.returnMode} / ${c.sampling} · ${(elapsed/1000).toFixed(2)} 秒。`}
function renderAssumptions(rows,c,elapsed){assumptions={rows,config:c};$('assumptionTable').replaceChildren();for(const r of rows)addRow($('assumptionTable'),[r.label,pct(1-r.survival),pct(r.lifestyle),pct(r.drops[1])]);$('assumptionMeta').textContent=`${c.currency} · ${STRATEGIES[c.strategy]} · ${pct(c.rate)} · ${c.years} 年 · ${c.paths.toLocaleString()} 路徑 · ${minimumLabel(c)} · 種子 ${c.seed} · ${(elapsed/1000).toFixed(2)} 秒。使用相同標準常態衝擊，比較各情境的報酬與波動假設。${c.inflationModel==='cpi'?'通膨使用內建 CPI 獨立區塊抽樣。':''}`;}
function download(name,body,type){const url=URL.createObjectURL(new Blob([body],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
function dataSummary(){
  const series=dataset.cpi,stats=statistics(series.inflation);
  $('datasetSummary').textContent=series.name+' · '+series.dates[0]+' — '+series.dates.at(-1)+' · '+series.inflation.length+' 個月通膨 · 年化幾何變動 '+pct(stats.cagr,2)+'。區塊抽樣保留局部物價變化，與股票報酬獨立。'+(series.gaps.length?' 缺月區間：'+series.gaps.join('、')+'；已排除跨月變動並在缺口重啟抽樣。':'');
  $('sourceTable').replaceChildren();
  for(const currency of ['TWD','USD']){const source=CPI[currency];addRow($('sourceTable'),[currency+' CPI',source.dates[0]+' — '+source.dates.at(-1),source.dates.length+' 筆月指數','已隨專案內建']);}
  addRow($('sourceTable'),['VCMM 參考參數',VCMM.asOf+' 基準／'+VCMM.published+' 發布','美股 4.2–6.2%；除美 3.9–5.9%','已隨專案內建']);
  addRow($('sourceTable'),['MSCI ACWI IMI 歷史估計參數',EQUITY_PARAMETERS.status==='ready'?EQUITY_PARAMETERS.sample.from+' — '+EQUITY_PARAMETERS.sample.to:'來源與定義查核中',EQUITY_PARAMETERS.status==='ready'?'只內建彙總參數，不含原始月序列':'不以 7%／18% 自訂預設代替','參數模式與歷史重抽分別追蹤']);
  if(EQUITY_PARAMETERS.status==='ready'){
    $('equityDataStatus').textContent=`MSCI 官方月資料已在本地核對：${EQUITY_PARAMETERS.sample.from} — ${EQUITY_PARAMETERS.sample.to}，${EQUITY_PARAMETERS.sample.months} 個月報酬；本頁只內建彙總參數。原始月序列不隨網站提供，歷史股票抽樣仍列後續。來源及使用條件查核紀錄隨參數版本保留；不代表 MSCI 認可本工具。`;
  }
  $('dataVersion').textContent='CPI 資料擷取：'+CPI.retrieved+'；頁面開啟時不向外部服務下載或要求匯入。';
}

document.querySelectorAll('[data-tab]').forEach(e=>e.onclick=()=>showTab(e.dataset.tab));$('methodsNav').onclick=()=>showTab('data');$('mobileParams').onclick=()=>setDrawer(!document.querySelector('.sidebar').classList.contains('open'));$('closeParams').onclick=()=>setDrawer(false);document.addEventListener('click',e=>{if(!e.target.closest('.sidebar')&&!e.target.closest('#mobileParams'))setDrawer(false);});
$('parameters').onsubmit=e=>{e.preventDefault();start('run');};$('parameters').addEventListener('input',sync);
$('samplingMethodsLink').onclick=e=>{e.preventDefault();showTab('data');setDrawer(false);$('samplingMethods').open=true;$('samplingMethods').scrollIntoView({block:'start'});};
$('currency').addEventListener('change',()=>{const preset=currencyDefaults($('currency').value);customInflation=inflationDrafts(preset.currency);fill({...config(),initial:preset.initial,minimumMonthlySpending:preset.minimumMonthlySpending,inflation:preset.inflation,inflationVol:preset.inflationVol,inflationModel:'preset'});});
$('reset').onclick=()=>{const c=currencyDefaults($('currency').value);customReturns={cagr:c.cagr,vol:c.vol};customInflation=inflationDrafts(c.currency);fill(c);};$('cancel').onclick=()=>{worker?.terminate();worker=null;activeJob=null;setBusy(false);$('statusText').textContent='已停止運算；保留上次完成的結果。';};$('compareRun').onclick=()=>start('compare');$('assumptionRun').onclick=()=>start('assumptions');
for(const id of ['tails','logScale','pathView'])$(id).addEventListener('change',()=>draw());$('viewYears').oninput=()=>draw();$('yearInspect').oninput=()=>{$('yearOutput').textContent=`第 ${$('yearInspect').value} 年`;draw(+$('yearInspect').value);};
$('exportJSON').onclick=()=>{if(!last)return;download('retirement-research-snapshot.json',JSON.stringify({version:'1.4.0',environment:{userAgent:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency,viewport:{width:innerWidth,height:innerHeight}},...last,scenarios:scenarioMetadata(last.config,datasetForCurrency(last.config.currency)),comparisons,assumptions,notice:'No raw historical observations included. Model-conditional simulations, not forecasts or guarantees.'},null,2),'application/json');};
$('exportCSV').onclick=()=>{if(!last)return;const r=last.result,c=last.config,currency=c.currency,meta=scenarioMetadata(c,datasetForCurrency(currency)),fields=[c.returnMode,c.sampling,c.inflationModel,meta.version,meta.equity.version||'',meta.inflation.version||'',c.cagr,c.vol,c.inflation,c.inflationVol,c.inflationModel==='cpi'?'sample-statistic':'model-parameter',c.returnMode==='vcmm'?c.usWeight:'',c.returnMode==='vcmm'?c.longRun:'',c.returnMode==='vcmm'?c.transition:'',c.minimumMonthlySpending,c.minimumMonthlySpending*12,'today-purchasing-power'],lines=['year,currency,asset_p1,asset_p5,asset_p25,asset_p50,asset_p75,asset_p95,asset_p99,spend_p1,spend_p5,spend_p25,spend_p50,spend_p75,spend_p95,spend_p99,return_scenario,equity_sampling,inflation_scenario,scenario_version,equity_data_version,cpi_data_version,cagr,log_vol,inflation_rate,inflation_log_vol,inflation_rate_kind,vcmm_us_weight,vcmm_long_run,vcmm_transition,minimum_monthly_spending,minimum_annual_spending,spending_floor_basis'];r.assetPercentiles.forEach((a,i)=>{const sp=i===0?Array(7).fill(''):r.spendingPercentiles[i-1].values;lines.push([i,currency,...a.values,...sp,...fields].join(','));});download('retirement-real-'+currency.toLowerCase()+'-percentiles.csv',lines.join('\n'),'text/csv;charset=utf-8');};
let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{draw();},120);});
try{
  const current=localStorage.getItem('retirement-config-v2');
  const legacy=current?null:JSON.parse(localStorage.getItem('retirement-config-v1'));
  const saved=current?JSON.parse(current):legacy?{...legacy,currency:'USD'}:null;
  const restored=saved?restoreConfig(saved):currencyDefaults();
  customInflation=inflationDrafts(restored.currency);
  const returnDraft=saved?.customAssumptions?.returns;
  if(Number.isFinite(returnDraft?.cagr)&&Number.isFinite(returnDraft?.vol))customReturns={cagr:returnDraft.cagr,vol:returnDraft.vol};
  for(const mode of ['constant','lognormal']){const draft=saved?.customAssumptions?.inflation?.[mode];if(Number.isFinite(draft?.inflation)&&Number.isFinite(draft?.inflationVol))customInflation[mode]={inflation:draft.inflation,inflationVol:draft.inflationVol};}
  if(restored.returnMode==='historical')restored.returnMode='custom';
  if(restored.returnMode==='msci'&&EQUITY_PARAMETERS.status!=='ready')restored.returnMode='custom';
  restored.sampling='parametric';
  if(restored.inflationModel==='historical')restored.inflationModel='cpi';
  fill(restored);
}catch{fill(currencyDefaults());}
const msciOption=$('returnMode').querySelector('[value="msci"]');msciOption.disabled=EQUITY_PARAMETERS.status!=='ready';if(!msciOption.disabled)msciOption.textContent='MSCI 歷史估計';
dataSummary();sync();
