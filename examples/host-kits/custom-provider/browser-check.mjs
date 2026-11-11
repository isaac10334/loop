// Headless CLI/browser acceptance. Requires an explicitly installed Playwright module.
// node browser-check.mjs <loop executable> <prepared consumer> <new receipt directory>
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, readdir, cp } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
const [cliArg, rootArg, outputArg] = process.argv.slice(2);
if (!cliArg || !rootArg || !outputArg || !process.env.PLAYWRIGHT_MODULE) throw Error('Pass CLI, prepared consumer, new receipt directory and PLAYWRIGHT_MODULE');
const cli = resolve(cliArg), root = resolve(rootArg), output = resolve(outputArg);
await mkdir(output); // Refuse an existing receipt directory; preserve previous artifacts.
const { chromium } = await import(pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href);
const receipt = { cliSha256: createHash('sha256').update(await readFile(cli)).digest('hex'), root, tests: [], errors: [] };
const args = ['--config', 'official.config.ts', '--target', 'counter', '--trust-local-config', '--json'];
const run = async argv => {
  const child = spawn(cli, argv, { stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  child.stdout.on('data', b => stdout += b); child.stderr.on('data', b => stderr += b);
  const code = await new Promise((res, rej) => { child.on('exit', res); child.on('error', rej); });
  if (code !== 0) throw Error(`CLI exit ${code}: ${stderr}\n${stdout}`);
  return JSON.parse(stdout);
};
let context, launch, server;
const instance = `counter-check-${Date.now().toString(36)}`;
try {
  receipt.inspect = await run(['inspect', root, '--json']);
  receipt.evaluation = await run(['inspect', root, '--evaluate-config', ...args]);
  receipt.build = await run(['build', root, ...args]);
  const relocated = join(output, 'static'); await cp(join(root, 'dist/counter'), relocated, { recursive: true });
  server = createServer(async (req, res) => {
    const name = new URL(req.url, 'http://localhost').pathname === '/' ? 'index.html' : req.url.slice(1);
    if (!['index.html', 'app.js'].includes(name)) { res.writeHead(404); res.end(); return; }
    try { res.setHeader('content-type', name.endsWith('.js') ? 'application/javascript' : 'text/html'); res.end(await readFile(join(relocated, name))); }
    catch { res.writeHead(404); res.end(); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  context = await chromium.launchPersistentContext(join(output, 'profile'), { headless: true, ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}), args: ['--no-first-run', '--disable-background-networking'] });
  receipt.browser = context.browser()?.version();
  async function pageAt(url) {
    const page = await context.newPage();
    page.on('pageerror', error => receipt.errors.push(String(error)));
    page.on('console', message => { if (message.type() === 'error') receipt.errors.push(message.text()); });
    await page.goto(url); await page.getByRole('button', { name: 'Increment counter', exact: true }).waitFor(); return page;
  }
  async function count(page, value) { await page.waitForFunction(value => document.querySelector('[data-loop-key="count"]')?.textContent === `Count: ${value}`, value); }
  const staticPage = await pageAt(`http://127.0.0.1:${server.address().port}`);
  await staticPage.getByRole('button', { name: 'Increment counter', exact: true }).click(); await count(staticPage, 1);
  receipt.tests.push('relocated static build uses installed public packages'); await staticPage.close();
  let launchError = '';
  launch = spawn(cli, ['dev', root, ...args, '--instance', instance], { stdio: ['ignore', 'pipe', 'pipe'] });
  launch.stdout.on('data', () => {}); launch.stderr.on('data', b => launchError += b);
  const completion = new Promise((res, rej) => { launch.on('exit', res); launch.on('error', rej); });
  const until = Date.now() + 30000; let record;
  while (Date.now() < until && !record) {
    try { for (const epoch of await readdir(join(root, '.loop/instances/counter', instance))) {
      const candidate = JSON.parse(await readFile(join(root, '.loop/instances/counter', instance, epoch, 'launch.json'), 'utf8'));
      if (['awaiting-browser', 'active'].includes(candidate.state)) record = candidate;
    } } catch {}
    if (launch.exitCode !== null) throw Error(`Launch exited: ${launchError}`);
    if (!record) await new Promise(r => setTimeout(r, 50));
  }
  if (!record) throw Error('No endpoint before deadline');
  receipt.endpoint = record.endpoint;
  const page = await pageAt(record.endpoint), button = () => page.getByRole('button', { name: 'Increment counter', exact: true });
  await count(page, 0); await button().click(); await count(page, 1);
  const input = page.getByRole('textbox', { name: 'Increment amount (1 to 100)', exact: true });
  await input.fill('5'); await input.press('Tab');
  await page.waitForFunction(() => document.querySelector('[data-loop-key="step"]')?.value === '5');
  await button().focus(); await page.keyboard.press('Enter'); await count(page, 6);
  await page.keyboard.press('Space'); await count(page, 11);
  await input.fill('0'); await input.press('Tab');
  await page.waitForFunction(() => document.querySelector('[data-loop-key="increment"]')?.disabled === true);
  await count(page, 11);
  await input.fill('2'); await input.press('Tab');
  await page.waitForFunction(() => document.querySelector('[data-loop-key="increment"]')?.disabled === false);
  await button().click(); await count(page, 13);
  receipt.tests.push('pointer + Enter + Space invoke provider; input 5 changes step; 0 denied; 2 recovers');
  await page.screenshot({ path: join(output, 'counter.png') });
  await page.evaluate(() => { globalThis.oldCounterButton = document.querySelector('[data-loop-key="increment"]'); });
  receipt.stop = await run(['stop', instance, '--root', root, '--json']);
  if (await completion !== 0) throw Error(`Launch did not exit cleanly: ${launchError}`);
  if (await page.locator('#app').textContent() !== '') throw Error('DOM not emptied before stop');
  await page.evaluate(() => globalThis.oldCounterButton.click());
  if (await page.locator('#app').textContent() !== '') throw Error('Detached button changed disposed surface');
  receipt.tests.push('stop joins event task, empties DOM; detached button inert');
  if (receipt.errors.length) throw Error('Browser reported errors');
  receipt.passed = true;
} catch (error) { receipt.failure = String(error); process.exitCode = 1; }
finally {
  if (launch?.exitCode === null) { try { await run(['stop', instance, '--root', root, '--json']); } catch { launch.kill(); } }
  if (context) await context.close(); if (server) await new Promise(r => server.close(r));
  await writeFile(join(output, 'receipt.json'), JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify({ passed: receipt.passed ?? false, output, tests: receipt.tests, failure: receipt.failure }, null, 2));
}
