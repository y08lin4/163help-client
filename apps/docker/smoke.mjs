/**
 * 管理端真 e2e 冒烟（服务器/本地执行；用真实浏览器走完整登录流程）
 * 用法：node smoke.mjs <base_url> <password>
 * 判定：登录后出现「今日帮听」仪表 = PASS；闪循环/无仪表 = FAIL
 */
import { chromium } from 'playwright-core';

const BASE = process.argv[2] || 'http://127.0.0.1:21000';
const PASSWORD = process.argv[3] || 'test123';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
let flashCount = 0;
let sawDash = false;

page.on('load', () => { flashCount++; });
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 20000 });

const loginPage = await page.locator('#pw').count();
console.log('[1] 首屏是否登录页:', loginPage > 0 ? 'PASS' : 'FAIL');

if (loginPage > 0) {
  await page.fill('#pw', PASSWORD);
  await page.click('#btn');
  // 等待仪表出现（最多 15s；闪循环会在期间被捕获）
  try {
    await page.waitForSelector('text=今日帮听', { timeout: 15000 });
    sawDash = true;
  } catch { /* not found */ }
}

console.log('[2] 登录后仪表出现:', sawDash ? 'PASS' : 'FAIL');
console.log('[3] 页面加载次数(闪循环>4 为异常):', flashCount);
console.log('==== 结果:', sawDash && flashCount <= 4 ? 'PASS ✅' : 'FAIL ❌', '====');

await browser.close();
process.exit(sawDash && flashCount <= 4 ? 0 : 1);
