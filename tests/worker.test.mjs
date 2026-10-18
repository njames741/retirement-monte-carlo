import test from'node:test';
import assert from'node:assert/strict';
import{Worker}from'node:worker_threads';
import{DEFAULTS}from'../dist/engine.js';
test('Production Worker protocol: run, cached strategies, assumptions, fixed monetary floor, invalid data',async()=>{
  const w=new Worker(new URL('./worker-host.mjs',import.meta.url));
  try{
    await new Promise((resolve,reject)=>{w.once('message',resolve);w.once('error',reject);});
    let id=0;
    const run=(action,extra={})=>new Promise((resolve,reject)=>{const request=++id;const onMessage=m=>{if(m.id!==request||m.type==='progress')return;w.off('message',onMessage);resolve(m);};w.on('message',onMessage);w.once('error',reject);w.postMessage({id:request,action,config:{...DEFAULTS,paths:1000,years:50,...extra},dataset:null});});
    const first=await run('run');assert.equal(first.type,'result');assert.equal(first.result.paths,1000);assert.equal(first.result.assetPercentiles.length,51);
    const compare=await run('compare');assert.equal(compare.result.length,4);assert.equal(compare.result[0].survival,first.result.survival);assert.equal(compare.result[1].survival,1);assert.equal(first.marketCached,false);assert.equal(compare.marketCached,true);assert.equal(compare.marketMs,0);
    const cachedError=await run('run',{strategy:'invalid'});assert.equal(cachedError.type,'error');assert.match(cachedError.message,/未知提領策略/);
    const assumptions=await run('assumptions');assert.equal(assumptions.result.length,3);assert.deepEqual(assumptions.result.map(r=>r.returnMode),['msci','custom','vcmm']);assert.notEqual(assumptions.result[0].survival,assumptions.result[1].survival);
    const higherFloor=await run('run',{minimumMonthlySpending:100000});assert.equal(higherFloor.result.lifestyle,0);assert.equal(higherFloor.marketCached,true);assert.equal(higherFloor.result.survival,first.result.survival);assert.deepEqual(higherFloor.result.spendingPercentiles,first.result.spendingPercentiles);assert.deepEqual(higherFloor.result.assetPercentiles,first.result.assetPercentiles);
    const removedAction=await run('swr');assert.equal(removedAction.type,'error');assert.match(removedAction.message,/未知運算/);
    const error=await run('run',{sampling:'stationary',returnMode:'historical'});assert.equal(error.type,'error');assert.match(error.message,/尚未載入/);
  }finally{await w.terminate();}
});
