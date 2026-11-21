// Simplest supported automation: one child per turn, NDJSON + saved session ID.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const base = dirname(fileURLToPath(import.meta.url));
const statePath = resolve(base, 'local-results/headless-session.json');
mkdirSync(dirname(statePath), { recursive: true });
const exe = resolve(process.env.LOCALAPPDATA!, 'Programs/DeepSeek Harness/DeepSeek Harness.exe');
const cli = resolve(dirname(exe), 'resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-desktop-host/lib/cli.js');
const home = resolve(process.env.USERPROFILE!, '.dsh');
const resume = process.argv[2] === 'resume';
const state = resume ? JSON.parse(readFileSync(statePath, 'utf8')) : undefined;
const child = spawn(exe, ['--expose-internals', cli, '--profile', 'headless', '--patch', resolve(base, 'codex.patch.yml'), '--patch', resolve(base, 'stored-auth.patch.yml'), '--json', '--permission-mode', 'read-only', '--approval-policy', 'never', ...(state ? ['--session-id', state.sessionId] : []), '-'], {
  cwd: state?.cwd ?? base,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', DSH_HOME: state?.home ?? home, DSH_SESSION_ID: '', DSH_PROFILE: '', DSH_PROFILE_DIR: '', DSH_WEB_URL: '' },
  stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
});
let final: any, diagnostic = '', parseError = false;
const timeout = setTimeout(() => child.kill('SIGKILL'), 90_000);
child.stderr.on('data', data => { diagnostic = (diagnostic + data.toString()).slice(-6000); });
createInterface({ input: child.stdout }).on('line', line => {
  let event: any;
  try { event = JSON.parse(line); } catch { parseError = true; return; }
  if (event.type === 'session') {
    // Persist immediately; this identity is not proof the server has fsynced it yet.
    writeFileSync(statePath, JSON.stringify({ sessionId: event.sessionId, cwd: base, home, profile: 'headless' }, null, 2) + '\n');
  }
  if (event.type === 'final') final = event;
  console.log(line);
});
child.on('error', error => { clearTimeout(timeout); console.error(error); process.exitCode = 1; });
child.on('close', code => {
  clearTimeout(timeout);
  // A valid JSON stream or successful tool call alone does not mean task success.
  if (code !== 0 || final?.reason?.kind !== 'completed' || parseError || (resume && final?.text.trim() !== 'LK-AUTO-03-HEADLESS-4R2')) {
    console.error({ code, final, diagnostic, parseError }); process.exitCode = 1;
  }
});
child.stdin.end(resume ? 'What marker did I ask you to remember? Reply only with it. Do not use tools.' : 'Remember marker LK-AUTO-03-HEADLESS-4R2 for the next turn. Reply only ACK. Do not use tools or delegates.');
