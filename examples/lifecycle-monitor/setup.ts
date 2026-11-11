/** Build and consume real public tarballs in this independent example. No local source aliases or links. */
import { mkdir, readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../", import.meta.url));
const directory = fileURLToPath(new URL("./", import.meta.url));
const output = fileURLToPath(new URL("./.packages", import.meta.url));
async function run(argv: string[], cwd: string) {
  const process = Bun.spawn(argv, { cwd, stdout: "inherit", stderr: "inherit" });
  if (await process.exited) throw new Error(`Failed: ${argv.join(" ")}`);
}
await run(["bun", "run", "build"], root);
await mkdir(output, { recursive: true });
const manifestFile = Bun.file(new URL("./package.json", import.meta.url));
const manifest = await manifestFile.json();
const dependencies: Record<string, string> = {};
const names = ["capabilities", "host", "ui"];
for (const name of names) {
  await run(["bun", "pm", "pack", "--destination", output], fileURLToPath(new URL(`../../packages/${name}/`, import.meta.url)));
  const archive = Bun.file(join(output, `loop-kit-${name}-0.1.0.tgz`));
  const bytes = await archive.arrayBuffer();
  const hash = createHash("sha256").update(new Uint8Array(bytes)).digest("hex");
  const filename = `loop-kit-${name}-${hash}.tgz`;
  await Bun.write(join(output, filename), bytes);
  dependencies[`@loop-kit/${name}`] = `file:./.packages/${filename}`;
}
// File dependencies with a stable filename can reuse cached older bytes even with --force.
manifest.dependencies = dependencies; manifest.overrides = dependencies;
await Bun.write(manifestFile, JSON.stringify(manifest, null, 2) + "\n");
await run(["bun", "install", "--force"], directory);
async function verify(source: string, installed: string): Promise<void> {
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const from = join(source, entry.name), to = join(installed, entry.name);
    if (entry.isDirectory()) await verify(from, to);
    else if (!(await readFile(from)).equals(await readFile(to))) throw new Error(`Stale installed artifact: ${to}`);
  }
}
for (const name of names) await verify(join(root, "packages", name, "dist"), join(directory, "node_modules/@loop-kit", name, "dist"));
console.log("Installed packed dist bytes match the current builds.");
