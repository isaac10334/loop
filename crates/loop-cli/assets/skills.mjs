// @bun
// skills/catalog.json
var catalog_default = {
  schemaVersion: 1,
  entries: [
    {
      id: "loop-host-kits",
      version: "0.1.0",
      description: "Design or implement Loop typed host configuration, kits/plugins, renderer adapters and portable/trust boundaries.",
      status: "proposed",
      discoveryStatus: "not-yet-verified",
      compatibility: {
        managerSchema: 1,
        catalogSchema: 1,
        loopApi: {
          "@loop-kit/host": "0.1.x",
          "@loop-kit/ui": "0.1.x",
          "@loop-kit/scripting": "0.1.x",
          "@loop-kit/workspace": "0.1.x"
        },
        adapters: {
          "codex-v1": 1
        }
      },
      source: {
        kind: "bundled",
        relativeRoot: "loop-host-kits"
      },
      digest: {
        algorithm: "sha256",
        value: "05f7f1be23d33b4e19f3521bf724627c44e1116d5f002a12d7e7f8c59ee485a7"
      },
      inventory: [
        {
          path: "SKILL.md",
          bytes: 4808,
          sha256: "bd3e22b5dc5a962cea6061c28fa525c04351c27aa7a171dc01ea02f1e032b38f"
        },
        {
          path: "references/renderers.md",
          bytes: 2142,
          sha256: "f56c0167a68722225408c20ee2f3ad46ca61c19c2afe128bc332437ab286ff07"
        }
      ],
      destinations: [
        "codex-v1"
      ]
    }
  ]
};

// skills/loop-host-kits/SKILL.md
var SKILL_default = `---
name: loop-host-kits
description: Design or implement Loop loop.config.ts composition, host kits/plugins, renderer adapters, and package or trust boundaries. Use for these Loop-specific changes, not generic React UI or unrelated host configuration.
---

# Loop host kits

Support the requested implementation or design slice. HK1 is the full contract;
source builds implement parts of it. Check current CLI help, public exports and
owner receipts rather than assuming all release gates passed. Skill use does not
permit migration, dependency installation, skill installation, publication or
replacement of a consumer's runtime.

## Locate the owners

Separate this skill's installed directory from the project and Loop source roots.
For an installed consumer, read the selected package's shipped README and public
root exports/declarations. Resolve those from that consumer's installed package;
use public imports, not private source subpaths.

For proposed behavior or source changes, locate the user's selected Loop checkout
and confirm it contains \`ARCHITECTURE.md\` and \`specs/host-kits.md\`. Resolve the
owner paths below from that checkout, **not from this skill's directory**. Read
its \`AGENTS.md\` and instructions for the owned paths. If no checkout is available,
ask for its location before relying on HK1 details; continue supported public-API
work from installed documentation where possible. Do not fetch or install a copy.

Read the matching routes before editing; combine routes when the change spans them:

| Change | Required owner material in the selected Loop checkout |
| --- | --- |
| \`loop.config.ts\`, target selection, config evaluation or CLI compatibility | \`specs/host-kits.md\` sections 2, 3 and 5; select acceptance from section 9. Read \`specs/host-kits-examples.md\` for proposed project/help examples. |
| Host kit/plugin factories, registration, bootstrap or stop/restart | \`specs/host-kits.md\` sections 3, 4 and 6; \`packages/host/README.md\` and \`packages/host/LIFECYCLE.md\` for implemented ownership APIs. |
| Renderer adapter, semantic elements, events or UI bindings | Read [renderer guidance](references/renderers.md); \`packages/ui/README.md\` and its public exports. For guest bindings also read \`packages/scripting/README.md\`. |
| Package/layer, cross-realm or trust boundary | \`ARCHITECTURE.md\` (Enforced package ownership); \`specs/host-kits.md\` sections 5 and 6. Read \`packages/AGENTS.md\` and the target package README for package edits. |
| Station adoption, placement, saved state or grants | Locate the selected Station checkout and read its instructions; read Loop's \`specs/station-adoption.md\`. Keep consumer policy and persistence there. |
| Skill catalog or optional management | \`specs/host-kits.md\` section 8; \`docs/reference/skills.md\` for source-built \`loop skills\` commands, explicit write intent and recovery limits. Release/client-discovery gates remain separate; skill use grants no installation authority. |

## Keep the portable seam

- Reuse existing host resources/leases, UI descriptors/controllers and workspace
  build/source contracts through public roots. Inspect the current API before
  proposing a new shared abstraction.
- Keep identity/version matching, lifetime and authorization separate. Scopes,
  registration keys, renderer metadata and \`requiredAuthority\` do not issue grants.
  Concrete trusted hosts authorize operations; guest bindings expose narrow ports.
- Keep portable contracts free of platform imports/globals. Composition injects
  providers and presentation adapters. React is optional; ordinary TypeScript
  consumers need neither a renderer nor a Component engine.
- Give each launch fresh mutable ownership. Register cleanup during acquisition,
  await disposal and test partial-start failure. Cooperative cancellation cannot
  roll back a committed effect or guarantee termination of same-process code.
- Treat executable config and host plugins as trusted same-user code. Static
  inspection must not import config. Require explicit local trust before evaluation;
  installed packages or worker/transport boundaries do not establish isolation.

## Deliver a bounded slice

Name the observable result, owned files and unresolved boundary first. Distinguish
implemented public APIs from proposed HK1 signatures/commands in code examples and
reports. Preserve legacy formats and behavior unless the user authorizes a change.

Choose checks from the owning contract for the actual change. In a Loop checkout,
use \`bun run repo context <package>\`, \`bun run repo check\` and focused
\`bun run repo verify <package>\` as applicable; source checks do not prove browser,
Component, native, installed-client discovery or release execution. Report changed
paths, contract effects, checks run, evidence gaps and the next bounded test.
`;

// skills/loop-host-kits/references/renderers.md
var renderers_default = `# Renderer adapter route

Use this branch for semantic UI or renderer changes. Resolve repository owner paths
from the selected Loop checkout as described in the skill entrypoint.

## Portable semantics

Read \`packages/ui/README.md\` and public declarations for existing element
registries, property/action descriptors, controllers, \`Surface\`, frames and events.
Extend that seam only when the requested behavior cannot use it. Keep semantic
identity/version, revision/sequence/key validation and lifetime rules portable;
layout, focus, platform measurement and event translation belong to the renderer.

Before accepting an event, validate its current surface/frame identity and event
ordering, reject stale/duplicate/disabled actions and authorize the invoked command
at the trusted host port. A descriptor or enabled button grants no authority.
Guest callbacks remain guest-local; exchange bounded semantic data across realms.
Dispose subscriptions, pending event reads and callback registrations with their
surface/session owner. Test events after disposal as well as the successful path.

## Web and optional React

For DOM output, use trusted element mappings, safe property/resource handling,
accessible labels, keyboard/focus behavior and explicit listener cleanup. Treat
untrusted HTML, CSS, URLs or remote callbacks as separate reviewed boundaries.
A DOM protocol does not establish guest isolation.

Use React only if the selected host already chooses it. Adapt existing controller
snapshots/subscriptions and keep effects/listeners under component or surface
ownership; do not move hooks, DOM globals or React types into portable contracts.
A React component is a renderer implementation, not a semantic element registration
or a Station widget definition. Station owns its product rendering and placement.

For a proposed standalone kit/DOM adapter, read \`specs/host-kits.md\` sections 3, 6
and 7 before choosing package names or claiming runtime support. Verify a real
rendered interaction, denial/stale-event behavior and teardown on the selected
platform. \`RecordingSurface\` proves semantic behavior, not DOM/native acceptance.
`;

// crates/loop-cli/host-tools/skills/bundle.ts
var bundle = { ...catalog_default, files: { "loop-host-kits/SKILL.md": new TextEncoder().encode(SKILL_default), "loop-host-kits/references/renderers.md": new TextEncoder().encode(renderers_default) } };

// crates/loop-cli/host-tools/skills/manager.ts
import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";
var hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
function fail(message) {
  throw new Error(message);
}
function portable(value) {
  if (!value || value.includes("\\") || value.startsWith("/") || value.includes(":") || value.includes("\x00"))
    fail("E_SKILL_PATH");
  for (const part of value.split("/"))
    if (!part || part === "." || part === ".." || /[. ]$/.test(part) || /[<>"|?*\x00-\x1f]/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))
      fail("E_SKILL_PATH");
  return value;
}
var digest = (inventory) => hash(`loop-skill-v1
` + inventory.map((f) => `${f.path}\x00${f.bytes}\x00${f.sha256}
`).join(""));
function noLinks(target) {
  const absolute = path.resolve(target), parsed = path.parse(absolute);
  let current = parsed.root;
  for (const part of absolute.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    portable(part);
    if (fs.existsSync(current)) {
      const siblings = fs.readdirSync(current);
      const aliases = siblings.filter((n) => n.toLowerCase() === part.toLowerCase());
      if (aliases.some((n) => n !== part))
        fail("E_SKILL_CASE_ALIAS");
    }
    current = path.join(current, part);
    try {
      const s = fs.lstatSync(current);
      if (s.isSymbolicLink())
        fail("E_SKILL_LINK");
    } catch (e) {
      if (e.code === "ENOENT")
        break;
      throw e;
    }
  }
}
function readJson(file) {
  noLinks(file);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
function tree(root, allowedEmpty) {
  noLinks(root);
  if (!fs.existsSync(root))
    return [];
  if (!fs.lstatSync(root).isDirectory())
    fail("E_SKILL_TYPE");
  const result = [];
  const folded = new Set;
  function visit(dir, prefix) {
    for (const name of fs.readdirSync(dir).sort()) {
      const rel = portable(prefix + name);
      if (folded.has(rel.toLowerCase()))
        fail("E_SKILL_CASE_ALIAS");
      folded.add(rel.toLowerCase());
      const file = path.join(dir, name);
      noLinks(file);
      const s = fs.lstatSync(file);
      if (s.isDirectory()) {
        const children = fs.readdirSync(file);
        if (!children.length && !allowedEmpty?.has(rel))
          fail("E_SKILL_UNKNOWN_DIRECTORY");
        visit(file, rel + "/");
      } else if (s.isFile()) {
        const bytes = fs.readFileSync(file);
        result.push({ path: rel, bytes: bytes.length, sha256: hash(bytes) });
      } else
        fail("E_SKILL_TYPE");
    }
  }
  visit(root, "");
  return result.sort((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path)));
}
var equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function validateBundle(bundle2) {
  if (bundle2.schemaVersion !== 1 || !Array.isArray(bundle2.entries))
    fail("E_SKILL_CATALOG");
  const ids = new Set;
  for (const e of bundle2.entries) {
    portable(e.id);
    if (e.id.includes("/") || ids.has(e.id.toLowerCase()))
      fail("E_SKILL_ID");
    ids.add(e.id.toLowerCase());
    portable(e.source.relativeRoot);
    if (e.source.kind !== "bundled" || e.compatibility.managerSchema !== 1 || e.compatibility.catalogSchema !== 1 || e.digest.algorithm !== "sha256")
      fail("E_SKILL_COMPATIBILITY");
    const names = new Set;
    let previous = "";
    for (const f of e.inventory) {
      portable(f.path);
      if (names.has(f.path.toLowerCase()) || previous && Buffer.compare(Buffer.from(previous), Buffer.from(f.path)) >= 0)
        fail("E_SKILL_INVENTORY");
      names.add(f.path.toLowerCase());
      previous = f.path;
      const bytes = bundle2.files[e.source.relativeRoot + "/" + f.path];
      if (!bytes || bytes.length !== f.bytes || hash(bytes) !== f.sha256)
        fail("E_SKILL_PAYLOAD");
    }
    if (digest(e.inventory) !== e.digest.value)
      fail("E_SKILL_DIGEST");
    const keys = Object.keys(bundle2.files).filter((k) => k.startsWith(e.source.relativeRoot + "/")).map((k) => k.slice(e.source.relativeRoot.length + 1)).sort();
    if (!equal(keys, e.inventory.map((f) => f.path).sort()))
      fail("E_SKILL_INVENTORY");
  }
}
function manage(bundle2, request, hooks = {}) {
  const result = { schemaVersion: 1, operation: request.operation, request, status: "error", applied: false, actions: [], conflicts: [], recovery: null };
  try {
    let valid = function(r) {
      if (!r || r.owner !== "loop-skills-v1" || r.id !== entry.id || r.root !== root || r.adapter !== request.adapter || !Array.isArray(r.inventory) || !Array.isArray(r.createdDirectories) || digest(r.inventory) !== r.digest)
        fail("E_SKILL_RECEIPT");
      r.createdDirectories.forEach((d) => portable(d));
      const seen = new Set;
      r.inventory.forEach((f) => {
        portable(f.path);
        if (seen.has(f.path.toLowerCase()) || !Number.isSafeInteger(f.bytes) || f.bytes < 0 || !/^[a-f0-9]{64}$/.test(f.sha256))
          fail("E_SKILL_RECEIPT");
        seen.add(f.path.toLowerCase());
      });
    }, acquire = function() {
      const gate = lock + ".recovery";
      let gateFd;
      try {
        if (deadLock) {
          noLinks(gate);
          gateFd = fs.openSync(gate, "wx");
          noLinks(lock);
          if (!equal(readJson(lock), deadOwner))
            fail("E_SKILL_STALE_PLAN");
          fs.unlinkSync(lock);
        }
        const fd = fs.openSync(lock, "wx");
        try {
          fs.writeFileSync(fd, JSON.stringify({ owner: "loop-skills-v1", root, id: entry.id, pid: process.pid }));
          fs.fsyncSync(fd);
        } finally {
          fs.closeSync(fd);
        }
      } finally {
        if (gateFd !== undefined) {
          fs.closeSync(gateFd);
          fs.unlinkSync(gate);
        }
      }
    };
    validateBundle(bundle2);
    if (request.write && request.dryRun)
      fail("E_SKILL_FLAGS");
    if (request.operation === "list") {
      if (request.write)
        fail("E_SKILL_FLAGS");
      return { ...result, status: "ok", entries: bundle2.entries.map(({ id, version, description, digest: digest2 }) => ({ id, version, description, digest: digest2 })) };
    }
    const entry = bundle2.entries.find((e) => e.id === request.id);
    if (!entry)
      fail("E_SKILL_ID");
    if (request.version && request.version !== entry.version)
      fail("E_SKILL_VERSION");
    if (request.adapter !== "codex-v1" || !entry.destinations.includes(request.adapter) || entry.compatibility.adapters[request.adapter] !== 1)
      fail("E_SKILL_ADAPTER");
    if (!request.root || !["project", "user"].includes(request.scope))
      fail("E_SKILL_ROOT");
    const selectedRoot = path.resolve(request.root);
    noLinks(selectedRoot);
    if (!fs.existsSync(selectedRoot) || !fs.statSync(selectedRoot).isDirectory())
      fail("E_SKILL_ROOT");
    const root = fs.realpathSync(selectedRoot);
    noLinks(root);
    const parent = path.join(root, request.scope === "project" ? ".agents/skills" : "skills");
    const state = path.join(parent, ".loop-skill-state");
    const destination = path.join(parent, entry.id);
    const receiptPath = path.join(state, entry.id + ".json"), journalPath = path.join(state, entry.id + ".journal.json");
    const stage = path.join(state, entry.id + ".stage"), backup = path.join(state, entry.id + ".backup"), lock = path.join(state, entry.id + ".lock");
    const next = receiptPath + ".next";
    [parent, state, destination, receiptPath, journalPath, stage, backup, lock, next].forEach(noLinks);
    Object.assign(result, { destination, stateRoot: state, catalogDigest: hash(JSON.stringify(bundle2.entries)), payloadDigest: entry.digest.value, backend: "trusted-local; file fsync, no directory fsync guarantee" });
    const receipt = fs.existsSync(receiptPath) ? readJson(receiptPath) : null;
    if (receipt)
      valid(receipt);
    if (fs.existsSync(journalPath) && request.operation !== "recover")
      return { ...result, status: "recovery-needed", recovery: "explicit recover --write required", conflicts: ["E_SKILL_RECOVERY"] };
    let deadLock = false;
    let deadOwner;
    if (fs.existsSync(lock)) {
      const owner = readJson(lock);
      if (owner.owner !== "loop-skills-v1" || owner.root !== root || owner.id !== entry.id || !Number.isSafeInteger(owner.pid) || owner.pid <= 0)
        fail("E_SKILL_LOCK");
      try {
        process.kill(owner.pid, 0);
        fail("E_SKILL_BUSY");
      } catch (e) {
        if (e.code !== "ESRCH")
          throw e;
      }
      if (request.operation !== "recover")
        fail("E_SKILL_RECOVERY");
      deadLock = true;
      deadOwner = owner;
    }
    const current = tree(destination);
    const exists = fs.existsSync(destination);
    if (request.operation !== "recover") {
      if (exists && !receipt)
        fail("E_SKILL_UNMANAGED");
      if (receipt && (!exists || !equal(current, receipt.inventory)))
        fail("E_SKILL_LOCAL_EDITS");
      if (fs.existsSync(stage) || fs.existsSync(backup) || fs.existsSync(next))
        fail("E_SKILL_RECOVERY");
    }
    if (request.operation === "inspect")
      return { ...result, status: receipt ? "installed" : "absent", installed: receipt };
    if (request.operation === "recover") {
      if (!fs.existsSync(journalPath))
        return { ...result, status: "absent" };
      const j = readJson(journalPath);
      if (j.owner !== "loop-skills-v1" || j.id !== entry.id || j.root !== root)
        fail("E_SKILL_JOURNAL");
      if (j.before)
        valid(j.before);
      if (j.after)
        valid(j.after);
      if (fs.existsSync(next) && !equal(readJson(next), j.after))
        fail("E_SKILL_RECOVERY_CONTENT");
      const committed = equal(receipt, j.after);
      const target = committed ? j.after : j.before;
      const stageDirs = new Set((j.after?.inventory ?? []).flatMap((f) => f.path.split("/").slice(0, -1).map((_, i) => f.path.split("/").slice(0, i + 1).join("/"))));
      const backupDirs = new Set((j.before?.inventory ?? []).flatMap((f) => f.path.split("/").slice(0, -1).map((_, i) => f.path.split("/").slice(0, i + 1).join("/"))));
      if (fs.existsSync(backup) && (!j.before || (committed ? tree(backup, backupDirs).some((f) => !j.before.inventory.some((expected) => equal(f, expected))) : !equal(tree(backup), j.before.inventory))))
        fail("E_SKILL_RECOVERY_CONTENT");
      if (fs.existsSync(stage) && (!j.after || tree(stage, stageDirs).some((f) => !j.after.inventory.some((expected) => equal(f, expected)))))
        fail("E_SKILL_RECOVERY_CONTENT");
      if (exists && ![j.before, j.after].some((r) => r && equal(current, r.inventory)))
        fail("E_SKILL_RECOVERY_CONTENT");
      if (target && !exists && !fs.existsSync(backup) && !fs.existsSync(stage))
        fail("E_SKILL_RECOVERY_CONTENT");
      result.status = "planned";
      result.recovery = committed ? "cleanup" : "rollback";
      result.actions = [{ kind: result.recovery }];
      if (!request.write)
        return result;
      const recoverySnapshot = JSON.stringify({ destination: tree(destination), backup: tree(backup, committed ? backupDirs : undefined), stage: tree(stage, stageDirs), receipt: fs.existsSync(receiptPath) ? readJson(receiptPath) : null, journal: readJson(journalPath) });
      acquire();
      try {
        [destination, backup, stage, receiptPath, journalPath, next].forEach(noLinks);
        if (recoverySnapshot !== JSON.stringify({ destination: tree(destination), backup: tree(backup, committed ? backupDirs : undefined), stage: tree(stage, stageDirs), receipt: fs.existsSync(receiptPath) ? readJson(receiptPath) : null, journal: readJson(journalPath) }))
          fail("E_SKILL_STALE_PLAN");
        if (!committed) {
          if (exists && (!j.before || !equal(current, j.before.inventory)))
            fs.rmSync(destination, { recursive: true });
          if (j.before && !fs.existsSync(destination))
            fs.renameSync(backup, destination);
        }
        if (committed && j.after && !fs.existsSync(destination))
          fail("E_SKILL_RECOVERY_CONTENT");
        for (const dir of [stage, backup])
          if (fs.existsSync(dir))
            fs.rmSync(dir, { recursive: true });
        if (fs.existsSync(next))
          fs.unlinkSync(next);
        fs.unlinkSync(journalPath);
        return { ...result, status: "recovered", applied: true, recovery: null };
      } finally {
        fs.unlinkSync(lock);
      }
    }
    const removing = request.operation === "remove";
    if (!["install", "update", "remove"].includes(request.operation))
      fail("E_SKILL_OPERATION");
    if (request.operation === "update" && !receipt)
      fail("E_SKILL_NOT_INSTALLED");
    const destinationRelative = path.relative(root, destination).split(path.sep).join("/");
    const createdDirectories = [...new Set([...receipt?.createdDirectories ?? [], ...[path.dirname(parent), parent, state].filter((dir) => dir !== root && !fs.existsSync(dir)).map((dir) => path.relative(root, dir).split(path.sep).join("/")), destinationRelative, ...entry.inventory.flatMap((f) => f.path.split("/").slice(0, -1).map((_, i) => destinationRelative + "/" + f.path.split("/").slice(0, i + 1).join("/")))])].sort();
    const after = removing ? null : { owner: "loop-skills-v1", id: entry.id, version: entry.version, adapter: request.adapter, root, digest: entry.digest.value, inventory: entry.inventory, createdDirectories };
    const files = new Set([...current.map((f) => f.path), ...(after?.inventory ?? []).map((f) => f.path)]);
    result.actions = [...files].sort().map((file) => ({ path: file, before: current.find((f) => f.path === file)?.sha256 ?? null, after: after?.inventory.find((f) => f.path === file)?.sha256 ?? null }));
    const planDigest = hash(JSON.stringify({ root, destination, before: receipt, after, current }));
    Object.assign(result, { planDigest });
    result.status = "planned";
    if (request.planDigest && request.planDigest !== planDigest)
      fail("E_SKILL_STALE_PLAN");
    if (removing && !receipt)
      return { ...result, status: "absent", actions: [] };
    if (!removing && receipt && receipt.digest === entry.digest.value && receipt.version === entry.version)
      return { ...result, status: "unchanged", actions: [] };
    if (!request.write)
      return result;
    fs.mkdirSync(state, { recursive: true });
    noLinks(state);
    acquire();
    const durable = (file, data) => {
      const fd = fs.openSync(file, "wx");
      try {
        fs.writeFileSync(fd, JSON.stringify(data));
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
    };
    try {
      [destination, state, stage, backup].forEach(noLinks);
      if (!equal(tree(destination), current) || fs.existsSync(destination) !== exists || !equal(fs.existsSync(receiptPath) ? readJson(receiptPath) : null, receipt))
        fail("E_SKILL_STALE_PLAN");
      durable(journalPath, { owner: "loop-skills-v1", id: entry.id, root, before: receipt, after });
      hooks.fault?.("journal");
      if (after) {
        fs.mkdirSync(stage);
        for (const f of entry.inventory) {
          const file = path.join(stage, f.path);
          fs.mkdirSync(path.dirname(file), { recursive: true });
          const fd = fs.openSync(file, "wx");
          try {
            fs.writeFileSync(fd, bundle2.files[entry.source.relativeRoot + "/" + f.path]);
            fs.fsyncSync(fd);
          } finally {
            fs.closeSync(fd);
          }
        }
        if (!equal(tree(stage), after.inventory))
          fail("E_SKILL_PAYLOAD");
        hooks.fault?.("staged");
      }
      if (exists) {
        hooks.fault?.("before-backup");
        fs.renameSync(destination, backup);
        hooks.fault?.("after-backup");
      }
      if (after) {
        hooks.fault?.("before-promote");
        fs.renameSync(stage, destination);
        hooks.fault?.("after-promote");
      }
      hooks.fault?.("before-receipt");
      if (after) {
        const temp = receiptPath + ".next";
        durable(temp, after);
        hooks.fault?.("before-receipt-rename");
        fs.renameSync(temp, receiptPath);
      } else if (receipt)
        fs.unlinkSync(receiptPath);
      hooks.fault?.("after-receipt");
      if (fs.existsSync(backup))
        fs.rmSync(backup, { recursive: true });
      fs.unlinkSync(journalPath);
      return { ...result, status: removing ? "removed" : "installed", applied: true };
    } finally {
      fs.unlinkSync(lock);
    }
  } catch (e) {
    result.status = "conflict";
    result.conflicts = [e.message];
    return result;
  }
}

// crates/loop-cli/host-tools/skills/cli.ts
function parse2(args) {
  const operation = args.shift();
  if (!["list", "inspect", "install", "update", "remove", "recover"].includes(operation))
    throw Error("E_SKILL_OPERATION");
  const request = { operation };
  if (operation !== "list") {
    request.id = args.shift();
    if (!request.id || request.id.startsWith("-"))
      throw Error("E_SKILL_ID");
  }
  const seen = new Set;
  while (args.length) {
    const flag = args.shift();
    if (seen.has(flag))
      throw Error("E_SKILL_FLAGS");
    seen.add(flag);
    if (["--json", "--dry-run", "--write"].includes(flag)) {
      if (flag === "--write")
        request.write = true;
      if (flag === "--dry-run")
        request.dryRun = true;
      continue;
    }
    const key = { "--scope": "scope", "--root": "root", "--adapter": "adapter", "--version": "version", "--plan-digest": "planDigest" }[flag];
    if (!key)
      throw Error("E_SKILL_FLAGS");
    const value = args.shift();
    if (!value || value.startsWith("--"))
      throw Error("E_SKILL_FLAGS");
    request[key] = value;
  }
  if (request.operation === "list" && Object.keys(request).some((k) => k !== "operation"))
    throw Error("E_SKILL_FLAGS");
  return request;
}
if (import.meta.main) {
  try {
    const request = parse2(Bun.argv.slice(2));
    const result = manage(bundle, request);
    console.log(JSON.stringify(result));
    process.exitCode = result.conflicts.length ? result.conflicts.some((c) => /FLAGS|OPERATION|ADAPTER|VERSION|ROOT|ID|CATALOG|PAYLOAD|DIGEST|COMPATIBILITY/.test(c)) ? 2 : 5 : 0;
  } catch (e) {
    console.log(JSON.stringify({ schemaVersion: 1, operation: "skills", status: "error", applied: false, actions: [], conflicts: [e.message], recovery: null }));
    process.exitCode = 2;
  }
}
export {
  parse2 as parse
};
