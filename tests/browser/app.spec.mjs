import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';


async function parameters(page){
  if(await page.locator('#mobileParams').isVisible()&&!await page.locator('#run').isVisible())await page.locator('#mobileParams').click();
}
async function run(page){
  await parameters(page);await page.locator('#run').click();
  // This is a completion assertion, not a 5-second performance budget.
  // A full 100k run on shared CI hosts can exceed the default assertion timeout.
  await expect(page.locator('#statusText')).toContainText('計算完成',{timeout:45000});
  await expect(page.locator('#error')).toBeHidden();
}
// Keep the original USD numerical regression; fresh TWD defaults are covered in revisions.spec.
test.beforeEach(async({page})=>{await page.goto('./');await expect(page.locator('#statusText')).toBeVisible();await parameters(page);await page.locator('#currency').selectOption('USD');await page.locator('#returnMode').selectOption('custom');if(await page.locator('#mobileParams').isVisible())await page.locator('#closeParams').click();});

test('default form submits; Pages subpath loads modules and Worker; charts respond',async({page},info)=>{
  const requests=[];page.on('request',r=>requests.push(r.url()));
  await page.reload();
  await parameters(page);
  expect(await page.locator('#parameters').evaluate(e=>e.checkValidity())).toBe(true);
  await expect(page.locator('#dataNotice')).toContainText('今天的購買力');
  await expect(page.locator('#fee')).toBeHidden();
  await run(page);
  await expect(page.locator('#ruinMetric')).toHaveText('43.0%');
  await expect(page.locator('#lifestyleMetric')).toHaveText('57.0%');
  expect(requests.some(url=>url.endsWith('/retirement-monte-carlo/worker.js'))).toBe(true);
  for(const file of ['app.js','engine.js','data.js','charts.js','style.css'])expect(requests.some(url=>url.endsWith('/retirement-monte-carlo/'+file))).toBe(true);
  for(const url of requests.filter(x=>x.startsWith('http://127.0.0.1:4175')))expect(new URL(url).pathname.startsWith('/retirement-monte-carlo/')).toBe(true);
  await page.locator('#tails').check();await page.locator('#logScale').check();
  await page.locator('#yearInspect').fill('30');
  await expect(page.locator('#yearOutput')).toHaveText('第 30 年');
  await expect(page.locator('#assetChart .chart-tooltip')).toContainText('P99');
  await page.locator('#assetChart').press('ArrowRight');
  await expect(page.locator('#yearOutput')).toHaveText('第 31 年');
  await page.locator('#assetChart').press('Escape');
  await expect(page.locator('#assetChart .chart-tooltip')).toBeHidden();
  await page.locator('#pathView').selectOption('samples');
  await expect(page.locator('.legend')).toContainText('期末最好樣本');
  if(!info.project.name.startsWith('mobile')){await page.locator('#viewYears').fill('20');await expect(page.locator('#yearInspect')).toHaveAttribute('max','20');await expect(page.locator('#yearOutput')).toHaveText('第 20 年');}
  expect(await page.locator('#assetChart svg').getAttribute('viewBox')).toBeTruthy();
  expect(await page.locator('#assetChart').innerHTML()).not.toMatch(/NaN|Infinity/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('dashboard.png'),fullPage:true});
});

test('four strategies share paths and assumptions use the same spending floor',async({page})=>{
  await page.getByRole('button',{name:'策略與情境',exact:true}).click();
  await page.locator('#compareRun').click();await expect(page.locator('#statusText')).toContainText('計算完成');
  await expect(page.locator('#compareTable tr')).toHaveCount(4);
  await expect(page.locator('#compareTable tr').nth(1)).toContainText('0.0%');
  await page.locator('#assumptionRun').click();await expect(page.locator('#statusText')).toContainText('計算完成');
  await expect(page.locator('#assumptionTable tr')).toHaveCount(3);
  await expect(page.locator('#compareMeta')).toContainText('每月至少 $2,666.67');
  await expect(page.locator('#assumptionMeta')).toContainText('每月至少 $2,666.67');
});

test('built-in CPI and VCMM work with no file import and persist across reloads',async({page})=>{
  await page.getByRole('button',{name:'資料與方法',exact:true}).click();
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await expect(page.locator('#sourceTable tr')).toHaveCount(4);
  await expect(page.locator('#datasetSummary')).toContainText('BLS');
  await expect(page.locator('#dataVersion')).toContainText('2026-10-17');
  await parameters(page);await page.locator('#inflationModel').selectOption('cpi');
  await expect(page.locator('#inflation')).toHaveAttribute('readonly','');await run(page);
  await parameters(page);await page.locator('#returnMode').selectOption('vcmm');await run(page);
  await page.getByRole('button',{name:'策略與情境',exact:true}).click();
  await page.locator('#assumptionRun').click();await expect(page.locator('#statusText')).toContainText('計算完成');
  await expect(page.locator('#assumptionTable tr')).toHaveCount(3);
  await parameters(page);await page.locator('#currency').selectOption('TWD');
  await page.locator('#inflationModel').selectOption('cpi');await run(page);
  await page.reload();await parameters(page);
  await expect(page.locator('#currency')).toHaveValue('TWD');await expect(page.locator('#inflationModel')).toHaveValue('cpi');
  if(await page.locator('#mobileParams').isVisible())await page.locator('#closeParams').click();
  await page.getByRole('button',{name:'資料與方法',exact:true}).click();
  await expect(page.locator('#datasetSummary')).toContainText('主計總處');
});

test('downloads contain real results and snapshot omits raw monthly series; stale labels stay coherent',async({page})=>{
  await run(page);
  let download=page.waitForEvent('download');await page.locator('#exportCSV').click();
  const csv=await readFile(await (await download).path(),'utf8');expect(csv.trim().split('\n')).toHaveLength(52);expect(csv).toContain('asset_p99');
  download=page.waitForEvent('download');await page.locator('#exportJSON').click();
  const json=JSON.parse(await readFile(await (await download).path(),'utf8'));
  expect(json.result.ruined).toBe(4304);expect(json.config.seed).toBe(741);expect(json.timing.marketCached).toBe(false);expect(JSON.stringify(json)).not.toContain('"returns":');
  await parameters(page);await page.locator('#initial').fill('2000000');await page.locator('#years').fill('40');
  await expect(page.locator('#spendingMetric')).toHaveText('$40,000');await expect(page.locator('#horizon')).toHaveText('50 年');
  await page.locator('#minimumMonthlySpending').fill('2500');
  await expect(page.locator('#lifestyleNote')).toContainText('$2,666.67');
  await page.reload();await parameters(page);await expect(page.locator('#minimumMonthlySpending')).toHaveValue('2,500');
});

test('100k simulation can be cancelled and rerun',async({page},info)=>{
  test.skip(info.project.name.startsWith('mobile'),'100k is measured on desktop; emulation does not validate phone memory.');
  await page.locator('#paths').selectOption('100000');await page.locator('#run').click();
  await page.locator('#cancel').click();await expect(page.locator('#statusText')).toContainText('已停止');
  await run(page);await expect(page.locator('#statusText')).toContainText('100,000');await expect(page.locator('#exportJSON')).toBeEnabled();
});
