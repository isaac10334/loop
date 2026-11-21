import { existsSync, readFileSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

export const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
export const python = join(root, "target/knowledge-venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
export const env = { ...process.env, PYTHONUTF8: "1", KB_VAULT: join(root, "knowledge"), KB_CONFIG_DIR: join(root, "target/knowledge-config"), KB_REPO_ROOT: resolve(root, "..") };

export async function run(command: string[], options: { capture?: boolean; environment?: Record<string, string | undefined> } = {}) {
  const child = Bun.spawn(command, { cwd: root, env: options.environment ?? env,
    stdout: options.capture ? "pipe" : "inherit", stderr: "inherit" });
  const output = options.capture ? await new Response(child.stdout).text() : "";
  const code = await child.exited;
  if (code !== 0) throw new Error(`${command[0]} exited ${code}`);
  return output;
}

export async function kb(args: string[], capture = false) {
  if (!existsSync(python)) throw new Error("Knowledge tools missing. Run bun run knowledge setup (Python 3.13+ required). No automatic installs during checks.");
  // Upstream exposes a console entrypoint, not python -m kb.
  return run([python, "-c", "from kb.cli import app; app()", ...args], { capture });
}

export function markdownFiles() {
  const result = Bun.spawnSync(["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z", "--", "*.md"], { cwd: root });
  if (result.exitCode !== 0) throw new Error("Cannot enumerate repository Markdown");
  return [...new Set(result.stdout.toString().split("\0").filter(p => p && !p.startsWith(".agents/worktrees/")))].sort();
}

async function links() {
  // The CLI's shared transform sees all documents, including cross-file headings.
  await run([process.execPath, "node_modules/remark-cli/cli.js", "--no-stdout", "--frail", "--quiet", ...markdownFiles()]);
}

export async function checkIndexes(vault = join(root, "knowledge")) {
  const files = ["_index.md", "_backlinks.json"];
  const before = files.map(f => readFileSync(join(vault, f), "utf8").replaceAll("\r\n", "\n"));
  // Compare upstream's pure renderer without rewriting tracked output during validation.
  const actual = await run([python, "-c", "import json,os; from pathlib import Path; from kb import schema; from kb.commands.index import render_index,render_backlinks; a,e=schema.load_vault(Path(os.environ['KB_VAULT'])); assert not e,e; a.sort(key=lambda x:x.slug); print(json.dumps([render_index(a),render_backlinks(a)]))"], { capture: true, environment: { ...env, KB_VAULT: vault } });
  if (JSON.stringify(before) !== JSON.stringify(JSON.parse(actual))) throw new Error("Knowledge indexes drifted: run bun run knowledge index");
}

async function check() {
  await kb(["lint", "--json"]);
  await checkIndexes();
  await links();
  await run([process.execPath, "node_modules/markdownlint-cli2/markdownlint-cli2.mjs"]);
}

export async function main(args: string[]) {
  const [command = "help", ...rest] = args;
  if (command === "setup") {
    mkdirSync(join(root, "target"), { recursive: true });
    if (!existsSync(python)) await run([process.env.PYTHON ?? "python", "-m", "venv", "target/knowledge-venv"]);
    await run([python, "-m", "pip", "install", "-r", "tooling/knowledge-requirements.txt"]);
  } else if (command === "check") await check();
  else if (command === "links") await links();
  else if (command === "maintain") {
    await kb(["index"]);
    await check();
    console.log("Mechanical maintenance passed. For scoped semantic review, invoke loop-knowledge-audit or read .agents/skills/loop-knowledge-audit/SKILL.md.");
  } else if (command === "backlinks") {
    if (!rest[0]) throw new Error("Usage: bun run knowledge backlinks <vault-slug>");
    const backlinks = JSON.parse(readFileSync(join(root, "knowledge/_backlinks.json"), "utf8"));
    console.log(JSON.stringify(backlinks[rest[0]] ?? [], null, 2));
  } else if (["search", "index", "lint", "schema", "article", "gap", "adopt"].includes(command)) await kb([command, ...rest]);
  else console.log("knowledge setup | search <terms> --json | index | lint --json | backlinks <slug> | links | check | maintain | schema | article ... | gap ... | adopt ...");
}

if (import.meta.main) main(Bun.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
