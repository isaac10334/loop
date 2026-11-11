// UNShippable local receipt: absolute paths target the installed package's PUBLIC export targets.
import { Translator } from "C:/Users/ijhar/Desktop/station/node_modules/@polyengine/runtime/esm/shim/mod.js";
import { requiredImports } from "C:/Users/ijhar/Desktop/station/node_modules/@polyengine/runtime/esm/embedder/mod.js";
const bytes = new Uint8Array(await Bun.file(Bun.argv[2] ?? "guest/target/wasm32-wasip2/release/async_document_guest.wasm").arrayBuffer());
const translator = await Translator.create(new Uint8Array(await Bun.file("C:/Users/ijhar/Desktop/station/node_modules/@polyengine/translator/esm/translator_shim.wasm").arrayBuffer()));
const translated = translator.translate(bytes);
await Bun.write(Bun.argv[3] ?? "profile.json", JSON.stringify({ componentSha256: translated.plan.component.sha256, worldDigest: translated.plan.worldDigest, imports: requiredImports(translated.plan), exports: translated.plan.exports, types: translated.plan.types }, null, 2));
console.log(JSON.stringify({ component: translated.plan.component, worldDigest: translated.plan.worldDigest, imports: requiredImports(translated.plan), exports: translated.plan.exports }, null, 2));
