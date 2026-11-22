import { describe, test, expect } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { root, python, env, markdownFiles, checkIndexes } from "./knowledge";

function execute(command: string[], environment = env) {
  const result = Bun.spawnSync(command, { cwd: root, env: environment });
  return { code: result.exitCode, out: result.stdout.toString(), err: result.stderr.toString() };
}
function cli(args: string[], environment = env) {
  return execute([python, "-c", "from kb.cli import app; app()", ...args], environment);
}
function fixture() {
  mkdirSync(join(root, "target/knowledge-tests"), { recursive: true });
  const dir = mkdtempSync(join(root, "target/knowledge-tests/case-"));
  mkdirSync(join(dir, "vault/reference"), { recursive: true });
  return { dir, vault: join(dir, "vault"), environment: { ...env, KB_VAULT: join(dir, "vault"), KB_CONFIG_DIR: join(dir, "config") } };
}
function article(title: string, related: string[], path = "../owner.md") {
  return `---\ntitle: ${title}\ntype: reference\nstatus: stable\ncreated: 2026-11-19\nlast_updated: 2026-11-19\nsummary: Lease and resource ownership reference\nrepos: [loop]\nrelated: ${JSON.stringify(related)}\npath: ${path}\n---\n\n# ${title}\n`;
}

// Ordinary SDK checks do not install Python tools. The dedicated knowledge CI job
// explicitly sets up the environment and runs these tests without skipping.
describe.skipIf(!existsSync(python))("knowledge-wiki integration", () => {
  test("search finds an existing owner before a duplicate is created", () => {
    const result = cli(["search", "lease", "--json"]);
    expect(result.code).toBe(0);
    const matches = JSON.parse(result.out).matches;
    expect(matches.some((m: { slug: string }) => m.slug === "reference/host")).toBe(true);
    const pointer = readFileSync(join(root, "knowledge/reference/host.md"), "utf8");
    expect(pointer).toContain("path: ../packages/host/LIFECYCLE.md");
    expect(existsSync(join(root, "packages/host/LIFECYCLE.md"))).toBe(true);
  });

  test("relative pointers, update-in-place, reciprocal backlinks, deterministic index and GitHub links", () => {
    const { dir, vault, environment } = fixture();
    const owner = join(dir, "owner.md");
    writeFileSync(owner, "# Owner\n\nOriginal lease behavior.\n");
    writeFileSync(join(vault, "reference/a.md"), article("Lease owner", []));
    writeFileSync(join(vault, "reference/b.md"), article("Contract owner", []));
    expect(cli(["article", "link", "reference/a", "reference/b", "--no-dry-run", "--json"], environment).code).toBe(0);
    // This is an isolated fixture, not a claimed real issue or an external write.
    const issue = "https://github.com/example/repository/issues/123";
    expect(cli(["article", "tag", "reference/a", "--ticket", issue, "--no-dry-run", "--json"], environment).code).toBe(0);
    writeFileSync(owner, `# Owner\n\nUpdated behavior. Engineering record: ${issue}\n`);
    expect(cli(["article", "touch", "reference/a", "--no-dry-run", "--json"], environment).code).toBe(0);
    expect(cli(["index", "--json"], environment).code).toBe(0);
    const before = readFileSync(join(vault, "_index.md"), "utf8");
    expect(cli(["index", "--json"], environment).code).toBe(0);
    expect(readFileSync(join(vault, "_index.md"), "utf8")).toBe(before);
    expect(JSON.parse(readFileSync(join(vault, "_backlinks.json"), "utf8"))).toEqual({ "reference/a": ["reference/b"], "reference/b": ["reference/a"] });
    const lint = cli(["lint", "--json"], environment);
    expect(lint.code).toBe(0);
    expect(JSON.parse(lint.out).errors).toBe(0);
    expect(JSON.parse(cli(["search", issue, "--json"], environment).out).matches.some((m: { slug: string }) => m.slug === "reference/a")).toBe(true);
    // Wrapper isolation wins over inherited personal-vault settings.
    expect(environment.KB_CONFIG_DIR).toStartWith(dir);
    expect(readFileSync(owner, "utf8")).toContain("Updated behavior");
  }, 30_000);

  test("index drift rejects without rewriting authored or generated files", async () => {
    const { dir, vault, environment } = fixture();
    writeFileSync(join(dir, "owner.md"), "# Owner\n");
    writeFileSync(join(vault, "reference/a.md"), article("Owner", []));
    expect(cli(["index", "--json"], environment).code).toBe(0);
    await checkIndexes(vault);
    const index = join(vault, "_index.md");
    const drifted = readFileSync(index, "utf8") + "\nManual drift\n";
    writeFileSync(index, drifted);
    await expect(checkIndexes(vault)).rejects.toThrow("indexes drifted");
    expect(readFileSync(index, "utf8")).toBe(drifted);
  });

  test("broken wikilinks, dead pointers, duplicate titles, malformed dates, orphans and staleness are detected", () => {
    const { dir, vault, environment } = fixture();
    writeFileSync(join(dir, "owner.md"), "# Owner\n");
    writeFileSync(join(vault, "reference/a.md"), article("Duplicate", ["[[reference/missing|Missing]]"], "../absent.md"));
    writeFileSync(join(vault, "reference/b.md"), article("Duplicate", []).replaceAll("2026-11-19", "2000-01-01"));
    writeFileSync(join(vault, "reference/c.md"), article("Bad date", []).replace("created: 2026-11-19", "created: invalid"));
    const result = cli(["lint", "--json"], environment);
    expect(result.code).toBe(1);
    const rules = JSON.parse(result.out).findings.map((f: { rule: string }) => f.rule);
    for (const rule of ["link-broken", "reference-dead-path", "duplicate-title", "frontmatter-invalid-date", "orphan", "stale"]) expect(rules).toContain(rule);
  });

  test("upstream knowledge gaps can be logged, searched and closed with evidence", () => {
    const { environment } = fixture();
    const added = cli(["gap", "add", "Where is lease disposal documented?", "--area", "host", "--note", "isolated acceptance fixture", "--no-dry-run", "--json"], environment);
    expect(added.code).toBe(0);
    const id = JSON.parse(added.out).gap.id;
    expect(JSON.parse(cli(["gap", "list", "--state", "open", "--json"], environment).out).count).toBe(1);
    expect(cli(["gap", "close", id, "--note", "Answered by owning lifecycle contract (fixture)", "--no-dry-run", "--json"], environment).code).toBe(0);
    expect(JSON.parse(cli(["gap", "list", "--state", "open", "--json"], environment).out).count).toBe(0);
  });
});

test("remark CLI checks cross-document anchors, images and reference definitions", () => {
  const { dir } = fixture();
  const a = join(dir, "a.md"), b = join(dir, "b.md");
  writeFileSync(a, "# A\n\n[valid](b.md#target)\n");
  writeFileSync(b, "# Target\n");
  const check = () => execute([process.execPath, "node_modules/remark-cli/cli.js", "--no-stdout", "--frail", "--quiet", a, b]);
  expect(check().code).toBe(0);
  writeFileSync(a, "# A\n\n[invalid](b.md#missing)\n\n![image](missing.png)\n\n[ref][gone]\n\n[gone]: absent.md\n");
  const bad = check();
  expect(bad.code).toBe(1);
  expect(bad.err).toContain("missing-heading-in-file");
  expect(bad.err).toContain("missing-file");
});

test("Markdown enumeration excludes ignored output and worktrees", () => {
  const files = markdownFiles();
  expect(files).toContain("AGENTS.md");
  expect(files.some(f => /^(target|node_modules|\.agents\/worktrees)\//.test(f))).toBe(false);
});

test("retained upstream skills match reviewed payload hashes", () => {
  const hashes: Record<string, string> = {
    capture: "d845bfc6e6e40901f3aaec2b0fad557c9f5fab7dd76ee3cbebaf1fb4a5329c13", gap: "829f146f4a8cc4f0c2dc7de3b2f196be1c1b2481873d273ea9f81dab1e6a5d30", "gaps-review": "58d1f79f8501681d791ad65dfe14aa486de170e8e74611c966c8f5afad404681",
  };
  for (const [name, digest] of Object.entries(hashes)) {
    // Git checkouts may normalize CRLF; prose must remain identical.
    const content = readFileSync(join(root, `skills/knowledge-wiki/${name}/SKILL.md`), "utf8").replaceAll("\r\n", "\n");
    expect(createHash("sha256").update(content).digest("hex")).toBe(digest);
  }
});
