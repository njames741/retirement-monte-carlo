import {DEFAULTS} from './engine.js';
import {INFLATION_PRESETS} from './scenarios.js';
import {EQUITY_PARAMETERS} from './equity-parameters.js';

// Planning presets, not a live FX quote or a conversion of the user's assets.
export const CURRENCIES=Object.freeze({
  TWD:Object.freeze({label:'台幣',initial:30000000,minimumMonthlySpending:80000,...INFLATION_PRESETS.TWD}),
  USD:Object.freeze({label:'美元',initial:1000000,minimumMonthlySpending:2666.67,...INFLATION_PRESETS.USD}),
});
export function currencyDefaults(currency='TWD'){
  if(!CURRENCIES[currency])throw Error('未知幣種。');
  const {initial,minimumMonthlySpending,inflation,inflationVol}=CURRENCIES[currency];
  return {...DEFAULTS,currency,initial,minimumMonthlySpending,inflation,inflationVol,inflationModel:'preset',returnMode:EQUITY_PARAMETERS.status==='ready'?'msci':'custom'};
}

// Convert the old relative floor once; later asset/rate edits keep the monetary floor fixed.
export function restoreConfig(saved){
  const {spendingFloor,successTarget,successMetric,...settings}=saved;
  const c={...currencyDefaults(settings.currency||'TWD'),...settings};
  if(!Object.hasOwn(settings,'minimumMonthlySpending')){
    const ratio=Number.isFinite(spendingFloor)&&spendingFloor>=0&&spendingFloor<=1?spendingFloor:.8;
    c.minimumMonthlySpending=Math.round(c.initial*c.rate*ratio/12*100)/100;
  }
  return c;
}
