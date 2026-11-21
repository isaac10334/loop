// Local HTTP fault injection only: no provider credentials, quota consumption or external endpoint.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
const base = dirname(fileURLToPath(import.meta.url));
const out = resolve(base, 'local-results');
mkdirSync(out, { recursive: true });
const exe = resolve(process.env.LOCALAPPDATA!, 'Programs/DeepSeek Harness/DeepSeek Harness.exe');
const cli = resolve(dirname(exe), 'resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-desktop-host/lib/cli.js');
for (const code of ['insufficient_quota', 'rate_limit_exceeded']) {
  let requests = 0;
  const server = createServer((req, res) => {
    requests++;
    req.resume();
    res.writeHead(429, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: { message: code === 'insufficient_quota' ? 'Insufficient quota' : 'Rate limit exceeded', code, type: code } }));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address() as { port: number };
  const patch = resolve(out, `mock-${code}.patch.json`);
  writeFileSync(patch, JSON.stringify([
    { id: 'session-title-llm', disabled: true },
    { id: 'session-persistence-jsonl', config: { root: resolve(out, 'mock-sessions'), compression: 'none' } },
    { id: 'agent-default-model', config: { provider: 'lk-test', model: 'lk-test' } },
    { id: 'llm-pi-ai', config: { providers: { 'lk-test': {
      apiKeyEnv: 'LK_AUTO_03_FAKE_KEY', api: 'openai-completions', baseURL: `http://127.0.0.1:${address.port}/v1`,
      models: [{ id: 'lk-test', name: 'Local fault injection', contextWindow: 128000, maxTokens: 512, reasoningEfforts: false }],
      retryPolicy: { mode: 'normal', maxRetries: 1, backoff: { initialDelayMs: 20, maxDelayMs: 20, jitterRatio: 0 } },
    } } } },
  ], null, 2));
  const child = spawn(exe, ['--expose-internals', cli, '--profile', 'headless', '--patch', patch, '--json', '--approval-policy', 'never', 'Reply only ACK. Do not use tools.'], {
    cwd: base, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', LK_AUTO_03_FAKE_KEY: 'local-dummy-not-a-secret', DSH_SESSION_ID: '', DSH_PROFILE: '', DSH_PROFILE_DIR: '', DSH_WEB_URL: '' }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  let stdout = '', stderr = '';
  child.stdout.on('data', x => { stdout += x; }); child.stderr.on('data', x => { stderr += x; });
  const timeout = setTimeout(() => child.kill('SIGKILL'), 45_000);
  const [exitCode] = await once(child, 'close'); clearTimeout(timeout);
  server.closeAllConnections(); await new Promise<void>(r => server.close(() => r()));
  writeFileSync(resolve(out, `mock-${code}.jsonl`), stdout);
  writeFileSync(resolve(out, `mock-${code}.stderr.txt`), stderr);
  const events = stdout.trim().split('\n').filter(Boolean).map(x => JSON.parse(x));
  const final = events.findLast(x => x.type === 'final');
  const expected = code === 'insufficient_quota' ? 'QUOTA' : 'RATE_LIMIT';
  console.log(JSON.stringify({ fault: code, exitCode, requests, final }));
  if (exitCode !== 1 || final?.reason?.error?.code !== expected || requests !== (expected === 'QUOTA' ? 1 : 2)) process.exitCode = 1;
}
