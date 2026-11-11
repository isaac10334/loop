// Actual Chrome driver. Optional PLAYWRIGHT_MODULE selects an already-installed public Playwright entry.
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
const [originA, originB, output] = process.argv.slice(2);
const modulePath = process.env.PLAYWRIGHT_MODULE ?? 'C:/Users/ijhar/Desktop/deepseek-harness/node_modules/.pnpm/playwright@1.61.1/node_modules/playwright/index.mjs';
const { chromium } = await import(pathToFileURL(modulePath).href);
const temporary = join(output, 'chrome-temp'); await mkdir(temporary, { recursive: true });
process.env.TEMP = temporary; process.env.TMP = temporary;
const context = await chromium.launchPersistentContext(join(output, 'chrome-profile'), { executablePath: process.env.CHROME_EXECUTABLE ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: process.env.LOOP_HEADED !== '1', downloadsPath: temporary, args: ['--no-first-run', '--no-default-browser-check', '--disable-background-networking'] });
const errors = [], logs = [];
const watch = page => { page.on('pageerror', e => errors.push(String(e))); page.on('console', m => logs.push(m.type()+': '+m.text())); };
const receipt = { browser: context.browser()?.version(), origins: [originA, originB], output, build: JSON.parse(await readFile(join(output,'build-receipt.json'),'utf8')), tests: [], errors, logs };
try {
  const a = await context.newPage(), b = await context.newPage(); watch(a); watch(b);
  for (const [page, origin] of [[a, originA], [b, originB]]) { await page.goto(origin); await page.waitForFunction(() => !!globalThis.acceptance); await page.evaluate(() => globalThis.acceptance.boot()); }
  await a.getByRole('button', { name: 'Increment', exact: true }).click();
  await a.waitForFunction(() => globalThis.acceptance.count() === 1);
  await b.getByRole('button', { name: 'Increment', exact: true }).focus();
  await b.keyboard.press('Enter'); await b.waitForFunction(() => globalThis.acceptance.count() === 1);
  const cleanupA = await a.evaluate(() => globalThis.acceptance.stop());
  await b.getByRole('button', { name: 'Increment', exact: true }).click(); await b.waitForFunction(() => globalThis.acceptance.count() === 2);
  if (await a.locator('#app').textContent() !== '') throw Error('A surface retained after stop');
  receipt.tests.push({ name: 'two-launches-stopA-leavesB-relocated-static', pointerA: 1, keyboardB: 1, afterStopB: 2, cleanupA });
  receipt.tests.push({ name: 'safe-semantic-dom', ...await b.evaluate(() => globalThis.acceptance.domChecks()) });
  receipt.tests.push({ name: 'dedicated-component-worker', ...await b.evaluate(() => globalThis.acceptance.componentChecks()) });
  const semantic = await b.evaluate(() => globalThis.acceptance.semanticStart());
  await b.getByRole('button', { name: 'Replace document', exact: true }).click();
  await b.waitForFunction(() => document.querySelector('#semantic')?.textContent === 'semantic world');
  await b.screenshot({ path: join(output, 'semantic.png') });
  receipt.tests.push({ name: 'real-pointer-component-document-next-frame', ...semantic, ...await b.evaluate(() => globalThis.acceptance.semanticFinish()) });
  const conformance = await b.evaluate(() => globalThis.acceptance.engineConformance());
  receipt.tests.push({ name: 'test-only-actual-engine-borrow-own-and-canonical-budgets', ...conformance });
  receipt.fullComponentConformance = !!conformance.retainedBorrow.rejectedBeforeHostRead && !!conformance.ownedDrop.passed && !!conformance.canonicalBudget.predecodeEnforced;
  receipt.cleanupB = await b.evaluate(() => globalThis.acceptance.stop());
  if (logs.some(line => line.startsWith('error:'))) throw Error('Unexpected console errors: '+logs.join('; '));
  if (errors.length) throw Error('Page errors: '+errors.join('; '));
  receipt.runtimeAcceptancePassed = true; // fullComponentConformance is a separate, stricter gate above.
} catch (error) { receipt.failure = { message: String(error), stack: error.stack }; process.exitCode = 1; }
finally { await context.close(); receipt.cleanup = { chromeContextClosed: true }; await writeFile(join(output, 'receipt.json'), JSON.stringify(receipt, null, 2)); console.log(JSON.stringify(receipt, null, 2)); }
