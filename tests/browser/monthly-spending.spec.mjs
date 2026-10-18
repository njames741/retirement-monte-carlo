import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

async function parameters(page){
  if(await page.locator('#mobileParams').isVisible()&&!await page.locator('#run').isVisible())await page.locator('#mobileParams').click();
}
async function run(page){
  await parameters(page);await page.locator('#run').click();
  await expect(page.locator('#statusText')).toContainText('計算完成');
  await expect(page.locator('#error')).toBeHidden();
}
async function download(page,id){
  const pending=page.waitForEvent('download');await page.locator(id).click();
  return readFile(await(await pending).path(),'utf8');
}
async function deterministic(page){
  await page.locator('#returnMode').selectOption('custom');
  await page.locator('#inflationModel').selectOption('constant');
  await page.locator('#years').fill('2');await page.locator('#paths').selectOption('1000');
  await page.locator('#costSettings').evaluate(e=>e.open=true);
  for(const id of ['cagr','vol','fee','inflation'])await page.locator('#'+id).fill('0');
}

test.beforeEach(async({page})=>{await page.goto('./');await parameters(page);});

test('the monetary floor belongs to the retirement plan and stays fixed when assets or rates change',async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await expect(page.locator('.tabs button')).toHaveCount(3);
  await expect(page.getByRole('button',{name:'提領率探索',exact:true})).toHaveCount(0);
  await expect(page.locator('#minimumMonthlySpending')).toHaveValue('80,000');
  await expect(page.locator('#minimumSpendingHint')).toContainText('每年 NT$960,000');
  await page.locator('#initial').fill('60000000');await page.locator('#rate').fill('2');
  await expect(page.locator('#minimumMonthlySpending')).toHaveValue('80,000');
  await page.locator('#rate').fill('1');
  await expect(page.locator('#minimumSpendingWarning')).toBeVisible();
  await page.locator('#currency').selectOption('USD');
  await expect(page.locator('#minimumMonthlySpending')).toHaveValue('2,666.67');
  await expect(page.locator('#minimumSpendingCurrency')).toHaveText('USD');
  await page.locator('#minimumMonthlySpending').fill('1234.56');
  await page.locator('#reset').click();
  await expect(page.locator('#minimumMonthlySpending')).toHaveValue('2,666.67');
  await page.locator('#currency').selectOption('TWD');
  await expect(page.locator('#minimumMonthlySpending')).toHaveValue('80,000');
  await expect(page.locator('#minimumSpendingWarning')).toBeHidden();
  await page.locator('#minimumMonthlySpending').scrollIntoViewIfNeeded();
  await page.screenshot({path:info.outputPath('minimum-spending-input.png')});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('legacy floors migrate once; grouped decimal amounts persist and invalid drafts never overwrite them',async({page})=>{
  await page.evaluate(()=>localStorage.setItem('retirement-config-v2',JSON.stringify({currency:'TWD',initial:30000000,rate:.04,spendingFloor:.6,successTarget:.95,successMetric:'survival'})));
  await page.reload();await parameters(page);
  const input=page.locator('#minimumMonthlySpending');
  await expect(input).toHaveValue('60,000');
  await input.fill('50000.25');await expect(input).toHaveValue('50,000.25');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('retirement-config-v2')));
  expect(saved.minimumMonthlySpending).toBe(50000.25);
  expect(saved).not.toHaveProperty('spendingFloor');expect(saved).not.toHaveProperty('successMetric');
  for(const text of ['', '-1', '1,2,3', '12.345', '1e5', '1000000000001']){
    await input.fill(text);await expect(input).toHaveAttribute('aria-invalid','true');
    await expect(page.locator('#minimumSpendingError')).toBeVisible();
    expect(await page.locator('#parameters').evaluate(e=>e.checkValidity())).toBe(false);
    expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('retirement-config-v2')).minimumMonthlySpending)).toBe(50000.25);
  }
  await page.locator('#run').click();await expect(page.locator('#statusText')).not.toContainText('計算完成');
  await page.reload();await parameters(page);await expect(input).toHaveValue('50,000.25');
  await input.fill('0');await expect(input).toHaveAttribute('aria-invalid','false');
  await page.reload();await parameters(page);await expect(input).toHaveValue('0');
});

test('success uses the chosen amount, exports its basis, and keeps completed results coherent while editing',async({page},info)=>{
  await deterministic(page);await page.locator('#minimumMonthlySpending').fill('100000');
  await run(page);
  await expect(page.locator('#lifestyleMetric')).toHaveText('100.0%');
  await expect(page.locator('#lifestyleNote')).toContainText('NT$100,000（今天購買力）');
  const first=JSON.parse(await download(page,'#exportJSON'));
  const csv=await download(page,'#exportCSV'),lines=csv.trim().split('\n'),headers=lines[0].split(',');
  for(const line of lines.slice(1)){
    const row=Object.fromEntries(headers.map((key,i)=>[key,line.split(',')[i]]));
    expect(row.minimum_monthly_spending).toBe('100000');expect(row.minimum_annual_spending).toBe('1200000');expect(row.spending_floor_basis).toBe('today-purchasing-power');
  }
  await parameters(page);await page.locator('#minimumMonthlySpending').fill('100000.01');
  await expect(page.locator('#minimumSpendingWarning')).toBeVisible();
  await expect(page.locator('#lifestyleMetric')).toHaveText('100.0%');
  await expect(page.locator('#lifestyleNote')).toContainText('NT$100,000（今天購買力）');
  await expect(page.locator('#statusText')).toContainText('參數已更動');
  await run(page);
  await expect(page.locator('#lifestyleMetric')).toHaveText('0.0%');
  await expect(page.locator('#ruinMetric')).toHaveText('0.0%');
  await expect(page.locator('#lifestyleNote')).toContainText('NT$100,000.01');
  const second=JSON.parse(await download(page,'#exportJSON'));
  expect(second.version).toBe('1.4.0');expect(second.config.minimumMonthlySpending).toBe(100000.01);
  expect(second.config).not.toHaveProperty('spendingFloor');expect(second).not.toHaveProperty('swr');
  expect(second.result.spendingPercentiles).toEqual(first.result.spendingPercentiles);
  expect(second.result.assetPercentiles).toEqual(first.result.assetPercentiles);
  expect(second.timing.marketCached).toBe(true);
  await page.screenshot({path:info.outputPath('minimum-spending-dashboard.png'),fullPage:true});
});

test('both comparison tools use the same floor and retain the conditions of completed results',async({page})=>{
  await deterministic(page);await page.locator('#minimumMonthlySpending').fill('100000.01');
  if(await page.locator('#mobileParams').isVisible())await page.locator('#closeParams').click();
  await page.getByRole('button',{name:'策略與情境',exact:true}).click();
  for(const [button,table,meta,count]of [['compareRun','compareTable','compareMeta',4],['assumptionRun','assumptionTable','assumptionMeta',3]]){
    await page.locator('#'+button).click();await expect(page.locator('#statusText')).toContainText('計算完成');
    const rows=page.locator('#'+table+' tr');await expect(rows).toHaveCount(count);
    for(let i=0;i<count;i++)await expect(rows.nth(i).locator('td').nth(2)).toHaveText('0.0%');
    await expect(page.locator('#'+meta)).toContainText('NT$100,000.01');
  }
  await parameters(page);await page.locator('#minimumMonthlySpending').fill('50000');
  await expect(page.locator('#statusText')).toContainText('參數已更動');
  await expect(page.locator('#compareMeta')).toContainText('NT$100,000.01');
  await expect(page.locator('#assumptionMeta')).toContainText('NT$100,000.01');
});
