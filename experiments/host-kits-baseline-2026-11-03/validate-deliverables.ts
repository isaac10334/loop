/** Disposable design validation, not the proposed CLI/skill manager. Run from Loop. */
import { readFile, readdir, lstat } from 'node:fs/promises';
import { resolve, dirname, join, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const root = resolve(process.cwd());
const ts = createRequire(import.meta.url)(join(root, 'node_modules/typescript'));
const sha = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
const authored = [
  'AGENTS.md', 'ARCHITECTURE.md', 'ENGINEERING_PLAN.md', 'QUESTIONS.md',
  'docs/README.md', 'docs/development-alpha/README.md',
  'docs/development-alpha/execution-plan.md', 'docs/development-alpha/prompts.md',
  'docs/development-alpha/host-kits-evidence.md', 'docs/reference/agent-workflow.md',
  'docs/reference/runtime.md', 'specs/README.md', 'specs/host-kits.md',
  'specs/host-kits-examples.md', 'specs/foreground-development.md',
  'specs/station-adoption.md', 'specs/async-document-runtime.md',
  'skills/loop-host-kits/SKILL.md', 'skills/loop-host-kits/references/renderers.md',
];
const errors: string[] = [], summary: Record<string, unknown> = {};
const slug = (s: string) => s.toLowerCase().replace(/[`*_]/g, '').replace(/[^\p{L}\p{N}_\-\s]/gu, '').replace(/\s/g, '-');
let links = 0, snippets = 0;
for (const file of authored) {
  const text = await readFile(join(root, file), 'utf8');
  if (text.charCodeAt(0) === 0xfeff) errors.push(`${file}: unexpected BOM`);
  if (!text.endsWith('\n')) errors.push(`${file}: missing final newline`);
  if (text.split(/\r?\n/).some(line => /[ \t]+$/.test(line))) errors.push(`${file}: trailing whitespace`);
  let inFence = false, lang = '', code: string[] = [];
  const outside: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const fence = line.match(/^```(\S*)/);
    if (fence) {
      if (inFence && ['ts', 'typescript', 'json'].includes(lang)) {
        snippets++;
        if (lang === 'json') { try { JSON.parse(code.join('\n')); } catch (e) { errors.push(`${file}: JSON ${e}`); } }
        else {
          const parsed = ts.createSourceFile(`${file}-${snippets}.ts`, code.join('\n'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
          for (const d of parsed.parseDiagnostics) errors.push(`${file}: TS syntax ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`);
        }
      }
      inFence = !inFence; lang = fence[1]; code = []; continue;
    }
    if (inFence) code.push(line); else outside.push(line);
  }
  if (inFence) errors.push(`${file}: unclosed fence`);
  for (const m of outside.join('\n').matchAll(/!?\[[^\]]*\]\((?:<([^>]+)>|([^\s)]+))(?:\s+"[^"]*")?\)/g)) {
    const target = m[1] ?? m[2];
    if (/^(https?:|mailto:)/i.test(target)) continue;
    const hashAt = target.indexOf('#');
    const rawPath = hashAt < 0 ? target : target.slice(0, hashAt);
    const fragment = hashAt < 0 ? '' : decodeURIComponent(target.slice(hashAt + 1));
    const path = rawPath ? (isAbsolute(rawPath) ? rawPath : resolve(root, dirname(file), decodeURIComponent(rawPath))) : join(root, file);
    links++;
    try {
      const meta = await lstat(path);
      if (fragment && meta.isFile()) {
        const body = await readFile(path, 'utf8');
        if (/^L\d+(?:-L\d+)?$/.test(fragment)) {
          const line = Number(fragment.match(/^L(\d+)/)![1]);
          if (line > body.split('\n').length) errors.push(`${file}: line beyond file ${target}`);
        } else if (/\.md$/i.test(path)) {
          const headings = body.split(/\r?\n/).filter(x => /^#{1,6}\s/.test(x)).map(x => slug(x.replace(/^#{1,6}\s+/, '')));
          if (!headings.includes(fragment)) errors.push(`${file}: missing fragment ${target}`);
        }
      }
    } catch (e) { errors.push(`${file}: missing local link ${target}`); }
  }
}
summary.markdown = { files: authored.length, localLinks: links, syntaxSnippets: snippets, scope: 'local targets/fragments, TS parse + JSON parse only; no API typecheck or HTTP check' };
const catalog = JSON.parse(await readFile(join(root, 'skills/catalog.json'), 'utf8'));
for (const entry of catalog.entries) {
  const source = resolve(root, 'skills', entry.source.relativeRoot);
  async function files(dir: string, prefix = ''): Promise<string[]> {
    const result: string[] = [];
    for (const ent of await readdir(dir, { withFileTypes: true })) {
      const p = prefix + ent.name;
      if (ent.isSymbolicLink()) throw new Error('symlink payload');
      if (ent.isDirectory()) result.push(...await files(join(dir, ent.name), p + '/'));
      else if (ent.isFile()) result.push(p);
      else throw new Error('nonregular payload');
    }
    return result;
  }
  const actual = (await files(source)).sort();
  if (JSON.stringify(actual) !== JSON.stringify(entry.inventory.map((x: any) => x.path))) errors.push('catalog file-set/order mismatch');
  let framed = 'loop-skill-v1\n';
  for (const item of entry.inventory) {
    const bytes = await readFile(join(source, item.path));
    const hash = sha(bytes);
    if (hash !== item.sha256 || bytes.length !== item.bytes) errors.push(`catalog byte mismatch ${item.path}`);
    framed += `${item.path}\0${bytes.length}\0${hash}\n`;
  }
  if (sha(framed) !== entry.digest.value) errors.push('catalog framed digest mismatch');
  summary.catalog = { entries: catalog.entries.length, payloadDigest: sha(framed), installed: false };
}
const allowedChanges = new Set(authored);
const comparisons: Record<string, unknown> = {};
for (const [name, repo] of [['loop', root], ['station', 'C:/Users/ijhar/Desktop/station']]) {
  const baseline = JSON.parse(await readFile(join(import.meta.dir, `${name}-baseline.json`), 'utf8'));
  const changed: string[] = [], unexpected: string[] = [];
  for (const row of baseline) {
    let hash: string | null = null;
    try { hash = sha(await readFile(join(repo, row.path))); } catch (e: any) { if (e.code !== 'ENOENT') throw e; }
    if (hash !== row.sha256) {
      changed.push(row.path);
      if (name !== 'loop' || !allowedChanges.has(row.path)) unexpected.push(row.path);
    }
  }
  comparisons[name] = { checked: baseline.length, changed, unexpected };
  // Report user/live-product drift rather than attributing it to this run.
  if (unexpected.length) errors.push(`${name}: unexpected baseline drift: ${unexpected.join(', ')}`);
}
summary.preservation = comparisons;
console.log(JSON.stringify({ ...summary, errors, passed: !errors.length }, null, 2));
if (errors.length) process.exitCode = 1;
