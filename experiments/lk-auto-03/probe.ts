// Bounded executable wire probe, not a reusable orchestration library.
// Run with Node 24 (native TypeScript stripping) or Bun. No dependencies.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { once } from 'node:events';
import { mkdirSync, writeFileSync, readFileSync, appendFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const mode = process.argv[2] ?? 'create'; // create | resume | crash | recover | auth | missing
const base = dirname(fileURLToPath(import.meta.url));
const artifacts = resolve(base, 'local-results');
mkdirSync(artifacts, { recursive: true });
const stateFile = resolve(artifacts, ['prepare-crash', 'crash', 'recover'].includes(mode) ? 'crash-session.json' : ['create', 'resume'].includes(mode) ? 'session.json' : `${mode}-session.json`);
const saved = ['resume', 'crash', 'recover'].includes(mode) ? JSON.parse(readFileSync(stateFile, 'utf8')) : undefined;
const cwd = saved?.cwd ?? base;
const home = saved?.home ?? resolve(process.env.USERPROFILE ?? process.env.HOME!, '.dsh');
const provider = process.env.PROBE_PROVIDER ?? saved?.provider ?? 'openai-codex';
const model = process.env.PROBE_MODEL ?? saved?.model ?? (provider === 'openai-codex' ? 'gpt-6-luna' : 'deepseek-flash');
const sessionId = saved?.sessionId ?? `session-lk-auto-03-${randomUUID()}`;
const patch = resolve(base, 'codex.patch.yml');
const extraPatch = process.env.PROBE_EXTRA_PATCH ? ['--patch', resolve(base, process.env.PROBE_EXTRA_PATCH)] : [];
const exe = process.env.DSH_ELECTRON ?? resolve(process.env.LOCALAPPDATA!, 'Programs/DeepSeek Harness/DeepSeek Harness.exe');
const cli = resolve(dirname(exe), 'resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-desktop-host/lib/cli.js');
// Direct installed launcher entry avoids Windows .cmd quoting/shell ownership.
const child = spawn(exe, ['--expose-internals', cli, '--profile', 'sdk', ...(process.env.PROBE_STOCK ? [] : ['--patch', patch]), ...extraPatch], {
  cwd, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', DSH_HOME: home, DSH_SESSION_ID: '', DSH_PROFILE: '', DSH_PROFILE_DIR: '', DSH_WEB_URL: '' },
  stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
});
const exited = once(child, 'exit');
const log = resolve(artifacts, `${mode}-${Date.now()}.jsonl`);
let tail = '', seq = 0, stopped = false, killScheduled = false;
const pending = new Map<number, { resolve: (x: any) => void; reject: (x: Error) => void; timer: ReturnType<typeof setTimeout> }>();
let lastReason: any, answer = '', approvalRequests = 0;
const send = (frame: unknown) => child.stdin.write(JSON.stringify(frame) + '\n');
function request(method: string, params?: unknown, timeout = 30_000): Promise<any> {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`RPC timeout: ${method}; work may still be running`)); }, timeout);
    pending.set(id, { resolve, reject, timer });
    send({ jsonrpc: '2.0', id, method, params });
  });
}
child.stdin.on('error', () => { /* Exit/error listeners own transport failure. */ });
child.stderr.on('data', b => { tail = (tail + b.toString()).slice(-6000); });
child.on('error', error => { for (const p of pending.values()) { clearTimeout(p.timer); p.reject(error); } pending.clear(); });
child.on('exit', (code, signal) => {
  stopped = true;
  for (const p of pending.values()) { clearTimeout(p.timer); p.reject(new Error(`Transport closed: ${code}/${signal}; ${tail}`)); }
  pending.clear();
});
createInterface({ input: child.stdout }).on('line', line => {
  appendFileSync(log, line + '\n');
  let f: any; try { f = JSON.parse(line); } catch { return; }
  if (f.method && f.id !== undefined) {
    // Fail closed; approval and user-question policy are separate.
    if (f.method === 'approval/request') approvalRequests++;
    if (!['approval/request', 'user-question/ask'].includes(f.method)) {
      send({ jsonrpc: '2.0', id: f.id, error: { code: -32601, message: 'Unsupported host request' } });
    } else {
      const result = f.method === 'approval/request' ? { outcome: 'rejected' } : { cancelled: true };
      console.log('HOST_REQUEST', f.method, 'rejected/cancelled');
      send({ jsonrpc: '2.0', id: f.id, result });
    }
  } else if (f.id !== undefined) {
    const p = pending.get(f.id); if (!p) return;
    clearTimeout(p.timer); pending.delete(f.id);
    f.error ? p.reject(Object.assign(new Error(f.error.message), { code: f.error.code, data: f.error.data })) : p.resolve(f.result);
  } else if (f.method === 'session.event' && f.params.sessionId === sessionId) {
    const event = f.params.event;
    if (event.type === 'turn/end') lastReason = event.data.reason;
    if (event.type === 'assistant/message') answer = event.data.message.content.filter((x: any) => x.type === 'text').map((x: any) => x.text).join('');
    // Crash only our child after a turn-start notification. This is NOT an fsync barrier.
    if (mode === 'crash' && event.type === 'turn/start' && !killScheduled) {
      killScheduled = true;
      console.log('CRASH_AFTER_TURN_START', sessionId);
      setTimeout(() => child.kill('SIGKILL'), 250);
    }
  }
});
const deadline = setTimeout(() => { console.error('OVERALL_DEADLINE'); child.kill('SIGKILL'); }, 90_000);
try {
  console.log('INITIALIZED', await request('initialize', { cwd, provider, model, ...(provider === 'openai-codex' ? { reasoningEffort: 'low' } : {}), maxTokens: 512, approvalRequests: true }));
  if (mode === 'missing') {
    await request('session/resume', { sessionId: 'session-lk-auto-03-does-not-exist' });
    throw new Error('Missing-session resume unexpectedly succeeded');
  }
  if (saved) await request('session/resume', { sessionId });
  else {
    await request('session/working-directory/get', { sessionId });
    writeFileSync(stateFile, JSON.stringify({ sessionId, home, cwd, provider, model }, null, 2) + '\n');
  }
  // No external effects, tools or delegates. The second process must recall history.
  const text = mode === 'approval'
    ? 'Call plugin_manager with action list_plugins exactly once. Do not install or change anything, do not call other tools, and do not retry a denial. Then briefly report the result.'
    : saved
    ? 'What is the marker from my earlier message? Reply with only that marker. Do not use tools.'
    : 'Remember this marker for our next turn: LK-AUTO-03-PERSIST-7Q9. Reply with only ACK. Do not use tools, delegates, goals or scheduling.';
  console.log('PROMPT_RECEIPT', await request('session/prompt', { sessionId, contentBlocks: [{ type: 'text', text }] }));
  await request('session/wait', { sessionId }, 75_000);
  console.log('RESULT', JSON.stringify({ sessionId, answer, reason: lastReason, log }));
  if (lastReason?.kind !== 'completed') throw new Error(`Run failed: ${JSON.stringify(lastReason)}`);
  if (saved && answer.trim() !== 'LK-AUTO-03-PERSIST-7Q9') throw new Error('History recall did not match');
  if (mode === 'approval' && approvalRequests !== 1) throw new Error(`Expected one approval request, observed ${approvalRequests}`);
} catch (error) {
  console.error('PROBE_ERROR', error);
  if (mode !== 'crash' || !killScheduled) process.exitCode = 1;
} finally {
  if (!stopped) {
    try { await request('shutdown', undefined, 5000); } catch { /* bounded fallback below */ }
    child.stdin.end();
    const force = setTimeout(() => child.kill('SIGKILL'), 5000);
    await exited;
    clearTimeout(force);
  } else await exited;
  clearTimeout(deadline);
  const [code, signal] = await exited;
  if (mode !== 'crash' && code !== 0) process.exitCode = 1;
  if (mode === 'crash' && (!killScheduled || signal !== 'SIGKILL')) process.exitCode = 1;
  console.log('CLIENT_STOPPED', sessionId, 'exit:', [code, signal], 'log:', log);
}
