import {resolve} from 'node:path';
const root=process.cwd();
const ignored=(p:string)=>p.includes('/target/')||p.startsWith('browser-profile/')||p.startsWith('semantic-browser-profile/')||p.startsWith('desktop-webview-profile')||p.startsWith('browser-tmp/')||p.startsWith('js-guest/tmp/');
const hash=async(path:string)=>{const f=Bun.file(path);return {bytes:f.size,sha256:new Bun.CryptoHasher('sha256').update(await f.arrayBuffer()).digest('hex')}};
const commands:Record<string,string>={
 'guest-build-1.log':'CARGO_TARGET_DIR=guest/target cargo build --offline --release --target wasm32-wasip2 --manifest-path guest/Cargo.toml',
 'guest-build-2.log':'CARGO_TARGET_DIR=guest/target WIT_BINDGEN_DEBUG=1 cargo build --offline --locked --release --target wasm32-wasip2 --manifest-path guest/Cargo.toml',
 'guest-build-3.log':'same command as guest-build-2; corrected generated Rust binding source',
 'guest-build-4.log':'same command as guest-build-2; removed duplicate generated alias imports',
 'guest-v2-build.log':'CARGO_TARGET_DIR=guest/target cargo build --offline --release --target wasm32-wasip2 --manifest-path guest-v2/Cargo.toml',
 'semantic-build-1.log':'CARGO_TARGET_DIR=semantic-guest/target cargo build --offline --release --target wasm32-wasip2 --manifest-path semantic-guest/Cargo.toml',
 'semantic-build-2.log':'CARGO_TARGET_DIR=semantic-guest/target cargo build --offline --locked --release --target wasm32-wasip2 --manifest-path semantic-guest/Cargo.toml',
 'native-build-1.log':'CARGO_TARGET_DIR=native/target cargo build --offline --manifest-path native/Cargo.toml',
 'browser-build-1.log':'bun build browser.ts --target browser --outfile browser.bundle.js',
 'browser-build-2.log':'bun build browser.ts --target browser --outfile browser.bundle.js',
 'browser-public-build.log':'bun build-browser.ts',
 'browser-run-1.log':'node run-browser.mjs (classic ESM load failure)',
 'browser-run-2.log':'node run-browser.mjs (module-script fix)',
 'browser-v2-run.log':"node run-browser.mjs guest/target/wasm32-wasip2/release/async_document_guest_v2.wasm -v2 'fresh-v2;'",
 'browser-public-v1-run.log':'node run-browser.mjs artifacts/document-v1.wasm',
 'browser-public-v2-run.log':"node run-browser.mjs artifacts/document-v2.wasm -v2 'fresh-v2;'",
 'semantic-browser-build.log':'bun build semantic-browser.ts --target browser --outfile semantic-browser.bundle.js',
 'semantic-browser-run-1.log':'node run-semantic-browser.mjs',
 'semantic-browser-public-run.log':'node run-semantic-browser.mjs (public-specifier rebuild)',
 'inspect.log':'bun inspect.ts',
 'inspect-v2.log':'bun inspect.ts guest/target/wasm32-wasip2/release/async_document_guest_v2.wasm profile-v2.json',
 'semantic-inspect.log':'bun inspect.ts semantic-guest/target/wasm32-wasip2/release/semantic_document_guest.wasm semantic-profile.json',
 'desktop-electrobun-attempt-1.log':'DASH_RELEASE_OFFLINE=1 bun desktop-electrobun-probe.ts (absolute package directory)',
 'desktop-electrobun-attempt-2.log':'DASH_RELEASE_OFFLINE=1 bun desktop-electrobun-probe.ts (declared public export target)',
 'desktop-build-1.log':'CARGO_TARGET_DIR=native/target cargo build --offline --features desktop --manifest-path native/Cargo.toml',
 'desktop-build-2.log':'CARGO_TARGET_DIR=native/target cargo build --offline --locked --features desktop --manifest-path native/Cargo.toml',
 'desktop-build-3.log':'CARGO_TARGET_DIR=native/target cargo build --offline --locked --features desktop --manifest-path native/Cargo.toml',
 'desktop-run-1.log':'node run-desktop.mjs (initial existing-page readiness blocker)',
 'desktop-run-2.log':'node run-desktop.mjs (stale debug-port profile blocker)',
 'desktop-run-3.log':'node run-desktop.mjs (fresh owned profile + existing-page readiness)',
 'js-guest-build.log':'bun build js-guest/guest.ts --target browser --outfile js-guest/guest.js',
 'js-guest-componentize.log':'bun js-guest/componentize.mjs (initial resolver selected0.23)',
 'js-guest-componentize-pinned.log':'bun js-guest/componentize.mjs (explicit installed0.22 public export)',
};
for(const n of [2,3,4,5])commands[`native-build-${n}.log`]='CARGO_TARGET_DIR=native/target cargo build --offline --locked --manifest-path native/Cargo.toml';
for(const n of [1,2,3])commands[`native-run-${n}.log`]='native/target/debug/async-document-native-probe.exe (default v1 path)';
commands['native-v2-run.log']="PROBE_EXPECTED_PREFIX='fresh-v2;' native/target/debug/async-document-native-probe.exe guest/target/wasm32-wasip2/release/async_document_guest_v2.wasm";
commands['native-semantic-build-1.log']='CARGO_TARGET_DIR=native/target cargo build --offline --locked --manifest-path native/Cargo.toml';
commands['native-semantic-run-1.log']='native/target/debug/async-document-native-probe.exe semantic-guest/target/wasm32-wasip2/release/semantic_document_guest.wasm --semantic';
commands['native-final-v1.log']='native/target/debug/async-document-native-probe.exe artifacts/document-v1.wasm';
commands['native-final-v2.log']="PROBE_EXPECTED_PREFIX='fresh-v2;' native/target/debug/async-document-native-probe.exe artifacts/document-v2.wasm";
commands['native-final-semantic.log']='native/target/debug/async-document-native-probe.exe artifacts/document-semantic.wasm --semantic';
const ledger=[];
for(const [log,command]of Object.entries(commands)){if(await Bun.file(log).exists()){const text=await Bun.file(log).text();ledger.push({command,log,exitCodes:[...text.matchAll(/EXIT_CODE=(\d+)/g)].map(m=>Number(m[1]))});}}
await Bun.write('commands.json',JSON.stringify({cwd:root,logWrapper:'PowerShell: command *>&1 | Tee-Object log; append EXIT_CODE=$LASTEXITCODE; propagate exit',commands:ledger},null,2));
const files=[];
for await(const p of new Bun.Glob('**/*').scan({cwd:root,onlyFiles:true,dot:true})){const path=p.replaceAll('\\','/');if(ignored(path)||path==='inventory.json')continue;files.push({path,...await hash(resolve(root,path))});}
files.sort((a,b)=>a.path.localeCompare(b.path));
await Bun.write('inventory.json',JSON.stringify({scope:'All retained source/evidence/artifacts except build caches, browser profiles, temp and this self-hashed output',files},null,2));
console.log('Retained file inventory entries='+files.length);
