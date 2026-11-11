// Disposable local resolver ONLY. No install/link/production manifest changes.
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
const station="file:///C:/Users/ijhar/Desktop/station/package.json";
const mappings:Record<string,string>={};
for(const spec of ["@polyengine/runtime/shim","@polyengine/runtime/embedder","@polyengine/protocol"])mappings[spec]=fileURLToPath(import.meta.resolve(spec,station));
const uiRoot="C:/src/ilt/loop/packages/ui",ui=await Bun.file(uiRoot+"/package.json").json();
// No installed public UI root resolves in this disposable project. Read its explicitly PUBLIC export target.
mappings["@loop-kit/ui"]=resolve(uiRoot,ui.exports["."].import);
const resolution=Object.fromEntries(await Promise.all(Object.entries(mappings).map(async([s,p])=>[s,{path:p,sha256:new Bun.CryptoHasher("sha256").update(await Bun.file(p).arrayBuffer()).digest("hex")}])));
await Bun.write("public-resolution.json",JSON.stringify({note:"LOCAL UNSHIPPABLE resolution; UI checkout public export, NOT packed-consumer proof",mappings:resolution},null,2));
for(const [entry,outfile] of [["browser.ts","browser.bundle.js"],["semantic-browser.ts","semantic-browser.bundle.js"]]){
 const result=await Bun.build({entrypoints:[entry],target:"browser",format:"esm",plugins:[{name:"local-public-export-resolver",setup(build){build.onResolve({filter:/^(@polyengine\/(runtime\/(shim|embedder)|protocol)|@loop-kit\/ui)$/},args=>({path:mappings[args.path]}));}}]});
 if(!result.success){console.error(result.logs);process.exit(1)}await Bun.write(outfile,result.outputs[0]);console.log(`built ${outfile} from public source specifiers`);
}
