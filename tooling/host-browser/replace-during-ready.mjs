/** Headless real-CLI probe: dev replacement while an old ready hook is held. */
import { spawn } from 'node:child_process';
import { mkdir, readdir, readFile, writeFile, appendFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const [cliArg, rootArg] = process.argv.slice(2);
if (!cliArg || !rootArg) throw Error('Usage: node replace-during-ready.mjs <cli> <fixture-root>');
const cli = resolve(cliArg), root = resolve(rootArg), output = resolve('target/host-browser-replace-ready', randomUUID());
await mkdir(output, { recursive: true });
const browserModule = process.env.PLAYWRIGHT_MODULE ?? 'C:/Users/ijhar/Desktop/deepseek-harness/node_modules/.pnpm/playwright@1.61.1/node_modules/playwright/index.mjs';
const { chromium } = await import(pathToFileURL(browserModule).href);
const context = await chromium.launchPersistentContext(join(output, 'profile'), { executablePath: process.env.CHROME_EXECUTABLE ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-first-run', '--no-default-browser-check', '--disable-background-networking'] });
const child = spawn(cli, ['dev', root, '--config', 'loop.config.ts', '--target', 'web', '--instance', 'replace-ready', '--trust-local-config', '--json'], { stdio: ['ignore', 'pipe', 'pipe'] });
let stdout = '', stderr = ''; child.stdout.on('data', data => stdout += data); child.stderr.on('data', data => stderr += data);
const exited = new Promise((resolveExit, reject) => { child.on('exit', resolveExit); child.on('error', reject); });
const runStop = () => new Promise((resolveStop, reject) => { const p = spawn(cli, ['stop', 'replace-ready', '--root', root, '--json'], { stdio: ['ignore', 'pipe', 'pipe'] }); let out = '', err = ''; p.stdout.on('data', data => out += data); p.stderr.on('data', data => err += data); p.on('error', reject); p.on('exit', code => resolveStop({ code, stdout: out, stderr: err })); });
const pause = ms => new Promise(r => setTimeout(r, ms));
async function until(action, label, timeout = 12000) { const deadline = Date.now() + timeout; while (Date.now() < deadline) { const value = await action(); if (value) return value; await pause(20); } throw Error(`Timed out waiting for ${label}`); }
async function exists(path) { try { await readFile(path); return true; } catch { return false; } }
const errors = [], requests = [], readyReplies = []; let stopPromise, failure, record, newPlan, heldPlan, aborted;
try {
 const base = join(root, '.loop/instances/web/replace-ready');
 record = await until(async () => { try { for (const epoch of await readdir(base)) { const file = join(base, epoch, 'launch.json'); try { const value = JSON.parse(await readFile(file, 'utf8')); if (value.state === 'awaiting-browser') return { ...value, file }; } catch {} } } catch {} return null; }, 'launch record');
 const page = await context.newPage(); page.on('pageerror', error => errors.push(String(error))); page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); }); page.on('requestfailed', request => requests.push({ url: request.url(), error: request.failure()?.errorText })); page.on('response', response => { if (new URL(response.url()).pathname === '/__loop/ready' && response.request().method() === 'POST') readyReplies.push(response.status()); });
 await page.goto(record.endpoint, { waitUntil: 'commit' }); await until(() => exists(join(root, 'ready-entered')), 'held ready hook');
 await appendFile(join(root, 'src/app.ts'), '\n// controlled ready replacement\n');
 aborted = await until(() => exists(join(root, 'ready-aborted')), 'old ready abort');
 await until(async () => (await (await fetch(record.endpoint + '/__loop/state')).json()).state === 'replacing', 'replacement state');
 heldPlan = JSON.parse(await readFile(record.file, 'utf8')).planId;
 if (heldPlan !== record.planId) throw Error('Replacement promoted while the old ready hook was held');
 await writeFile(join(root, 'release-ready'), '1');
 newPlan = await until(async () => { const snapshot = JSON.parse(await readFile(record.file, 'utf8')); return snapshot.state === 'active' && snapshot.planId !== record.planId ? snapshot.planId : null; }, 'replacement readiness', 20000);
 await page.getByRole('button', { name: 'Next greeting', exact: true }).waitFor();
 stopPromise = runStop(); const stopped = await stopPromise, ownerCode = await exited;
 if (stopped.code !== 0 || ownerCode !== 0 || errors.length || readyReplies.some(status => status !== 200)) throw Error(`stop=${stopped.code} owner=${ownerCode} ready=${readyReplies} errors=${JSON.stringify(errors)} stderr=${stopped.stderr}`);
} catch (error) { failure = { message: String(error), stack: error.stack }; process.exitCode = 1; }
finally {
 await writeFile(join(root, 'release-ready'), '1');
 if (!stopPromise && child.exitCode === null) stopPromise = runStop();
 if (stopPromise) await stopPromise.catch(() => {});
 if (child.exitCode === null) { child.kill(); await exited.catch(() => {}); }
 await context.close();
 const receipt = { cliSha256: createHash('sha256').update(await readFile(cli)).digest('hex'), root, oldPlan: record?.planId, heldPlan, newPlan, aborted, readyReplies, errors, requests, stdout, stderr, failure, passed: !failure, limits: ['Trusted held ready hook; headless Chrome, not native UI or Component guest', 'One controlled replacement schedule; noncooperative hooks can prevent promotion'] };
 await writeFile(join(output, 'receipt.json'), JSON.stringify(receipt, null, 2)); console.log(JSON.stringify({ output, ...receipt }, null, 2));
}
