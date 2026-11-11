/** Public-root build/relocation and actual Chrome acceptance. No installs or Station paths. */
import { defaultTranslator } from "@polyengine/translator";
import { translationSha256 } from "@loop-kit/component-polyengine";
import { mkdir, cp } from "node:fs/promises";
import { resolve, join } from "node:path";
const output = resolve("target/host-browser", String(Date.now()));
await mkdir(output, { recursive: true });
const translated = await defaultTranslator();
const names = { document: "loop_document_guest", changed: "loop_document_guest_v2", semantic: "loop_document_semantic_guest", runaway: "loop_document_runaway_guest", lifecycle: "loop_document_lifecycle_guest", budget: "loop_document_budget_guest" };
const components: Record<string, unknown> = {};
const translationReceipts: Record<string, unknown> = {};
for (const [key, name] of Object.entries(names)) {
  const bytes = new Uint8Array(await Bun.file(`target/document-tool/${name}.wasm`).arrayBuffer());
  const translation = translated.translate(bytes);
  const sha256 = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
  const preparedSha256 = await translationSha256(translation);
  translationReceipts[key] = { componentSha256: sha256, translationSha256: preparedSha256, worldDigest: translation.plan.worldDigest, planSha256: new Bun.CryptoHasher("sha256").update(JSON.stringify(translation.plan)).digest("hex"), envelopeSha256: new Bun.CryptoHasher("sha256").update(translation.envelopeJson).digest("hex"), adapters: [...translation.adapters].map(([path, bytes]) => ({ path, bytes: bytes.byteLength, sha256: new Bun.CryptoHasher("sha256").update(bytes).digest("hex") })) };
  components[key] = { artifact: { sha256, translationSha256: preparedSha256, worldDigest: translation.plan.worldDigest, profile: key === "semantic" ? "semantic" : "document" }, bytes: Buffer.from(bytes).toString("base64"), translation: { plan: translation.plan, adapters: [...translation.adapters].map(([key, bytes]) => [key, Array.from(bytes)]) } };
}
await Bun.write(join(output, "components.json"), JSON.stringify(components));
for (const [entry, outfile] of [["fixture.ts", "app.js"], ["worker.ts", "worker.js"], ["conformance-worker.ts", "conformance-worker.js"]]) {
  const build = await Bun.build({ entrypoints: [`tooling/host-browser/${entry}`], target: "browser", format: "esm", minify: false });
  if (!build.success) throw new AggregateError(build.logs, "Browser build failed");
  if (build.outputs.length !== 1) throw new Error("Unexpected browser output graph");
  await Bun.write(join(output, outfile!), build.outputs[0]!);
}
await Bun.write(join(output, "index.html"), '<!doctype html><html lang="en"><meta charset="utf-8"><title>Loop browser acceptance</title><link rel="icon" href="data:,"><main id="app"></main><section id="dom-checks"></section><section id="semantic"></section><script type="module" src="./app.js"></script></html>');
const inventory = await Promise.all(["app.js", "worker.js", "conformance-worker.js", "components.json", "index.html"].map(async path => { const bytes = await Bun.file(join(output,path)).arrayBuffer(); return { path, bytes: bytes.byteLength, sha256: new Bun.CryptoHasher("sha256").update(bytes).digest("hex") }; }));
await Bun.write(join(output, "build-receipt.json"), JSON.stringify({ translator: { package: "@polyengine/translator", version: "0.6.7", buildHash: translated.buildHash }, translations: translationReceipts, inventory }, null, 2));
const relocated = output + "-relocated"; await cp(output, relocated, { recursive: true });
function serve(root: string) {
  return Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(request) {
    const path = decodeURIComponent(new URL(request.url).pathname);
    if (path !== "/" && !["/app.js", "/worker.js", "/conformance-worker.js", "/components.json", "/index.html"].includes(path)) return new Response("Not found", { status: 404 });
    const file = Bun.file(join(root, path === "/" ? "index.html" : path.slice(1)));
    return new Response(file, { headers: { "cache-control": "no-store" } });
  } });
}
const a = serve(output), b = serve(relocated);
try {
  console.log(JSON.stringify({ output, relocated, a: a.url.href, b: b.url.href, translatorBuildHash: translated.buildHash }));
  const child = Bun.spawn(["node", "tooling/host-browser/chrome.mjs", a.url.href, b.url.href, output], { stdout: "inherit", stderr: "inherit", stdin: "ignore", env: { ...process.env, LOOP_BROWSER_OUTPUT: output } });
  const result = await child.exited;
  if (result !== 0) throw new Error(`Chrome acceptance exit ${result}`);
} finally { await a.stop(true); await b.stop(true); }
