import {prepareMarket,evaluate,STRATEGIES,validate} from './engine.js';
import {resolveScenario,scenarioMetadata} from './scenarios.js';
import {EQUITY_PARAMETERS} from './equity-parameters.js';
let cache=null;
self.onmessage=({data:{id,action,config,dataset,customReturns}})=>{
  const start=performance.now();
  const progress=(value,label)=>self.postMessage({id,type:'progress',value,label});
  try{
    if(!['run','compare','assumptions'].includes(action))throw Error('未知運算要求。');
    config=resolveScenario(config,dataset);
    validate(config,dataset);
    const key=JSON.stringify(Object.fromEntries(['paths','years','seed','returnMode','sampling','cagr','vol','fee','drag','inflationModel','inflation','inflationVol','block','usWeight','transition','longRun'].map(k=>[k,config[k]])))+JSON.stringify(dataset);
    const marketCached=!!cache&&cache.key===key;
    if(!marketCached)cache={key,market:prepareMarket(config,dataset,progress)};
    let result;
    if(action==='assumptions'){
      const hasHistory=dataset?.returns?.length>=24;
      const sampling=hasHistory?(config.sampling==='parametric'?'stationary':config.sampling):'parametric';
      const modes=[...(hasHistory?['historical']:[]),...(EQUITY_PARAMETERS.status==='ready'?['msci']:[]),'custom','vcmm'];
      result=modes.map(returnMode=>{
        const c=resolveScenario({...config,...(returnMode==='custom'?customReturns:null),returnMode,sampling},dataset);
        const market=prepareMarket(c,dataset,progress);
        return{label:returnMode==='historical'?'專案歷史抽樣':returnMode==='msci'?'MSCI 歷史估計（參數）':returnMode==='custom'?`自訂 CAGR ${(c.cagr*100).toFixed(1)}%`:'VCMM 10 年 + 長期銜接',returnMode,scenario:scenarioMetadata(c,dataset),...evaluate(c,market,{summaryOnly:true})};
      });
    }
    else if(action==='compare')result=Object.keys(STRATEGIES).map(strategy=>({strategy,...evaluate({...config,strategy},cache.market,{summaryOnly:true})}));
    else result=evaluate(config,cache.market,{progress});
    self.postMessage({id,type:'result',action,result,elapsed:performance.now()-start,marketMs:marketCached?0:cache.market.elapsed,marketCached});
  }catch(e){self.postMessage({id,type:'error',message:e.message});}
};
