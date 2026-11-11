// Trusted reusable evaluator. Guest code still crosses host checks for every effect.
import * as services from 'loopkit:scripting-proof/services@0.1.0';
import * as surfaces from 'loopkit:scripting-proof/surfaces@0.1.0';

const bindings = Object.freeze({
  invoke: async (name, input) => JSON.parse(await services.invoke(name, JSON.stringify(input))),
  subscribe: name => services.subscribe(name),
  openSurface: () => surfaces.open(),
});
let session;
const encode = value => {
  const json = JSON.stringify(value ?? null);
  if (new TextEncoder().encode(json).byteLength > 4096) throw new Error('Script output limit exceeded');
  return json;
};
const execute = (source, input) => new Function('input', 'bindings', `"use strict"; return (async () => {${source}\n})();`)(JSON.parse(input), bindings);

export async function evaluate(source, input) {
  return encode(await execute(source, input));
}
export async function start(source, input) {
  stop();
  session = await execute(source, input);
  return encode({ started: true });
}
export async function dispatch(input) {
  if (!session) throw new Error('Session is stopped');
  return encode(await session.update(JSON.parse(input)));
}
export function stop() {
  const previous = session;
  session = undefined;
  previous?.dispose?.();
}
