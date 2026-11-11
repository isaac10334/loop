import services from "loopkit:script-probe/services@0.1.0";
import surfaces from "loopkit:script-probe/surfaces@0.1.0";

// This is an experiment, not a public SDK or an authorization boundary. The
// embedding host supplies only the imports under test. One instance is one principal.
const bindings = Object.freeze({
  invoke: (name, input) => services.invoke(name, JSON.stringify(input)),
  openSurface: () => surfaces.open(),
});
let session;

export async function evaluate(source, input) {
  const execute = new Function("input", "bindings", `return (async () => {${source}\n})();`);
  return JSON.stringify(await execute(JSON.parse(input), bindings));
}

export async function start(source, input) {
  if (session) throw new Error("Already started");
  const execute = new Function("input", "bindings", `return (async () => {${source}\n})();`);
  session = await execute(JSON.parse(input), bindings);
  return JSON.stringify({ started: true });
}

export async function dispatch(input) {
  if (!session) throw new Error("Not started");
  return JSON.stringify(await session.update(JSON.parse(input)));
}

export function stop() {
  session?.dispose?.();
  session = undefined;
}
