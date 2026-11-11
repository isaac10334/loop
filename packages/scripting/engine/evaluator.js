// Reusable Wasm evaluator; authored source is never evaluated by the JavaScript host.
import * as services from 'loopkit:scripting/services@0.1.0';
import * as surfaces from 'loopkit:ui/surfaces@0.1.0';
const bindings = Object.freeze({
  invoke: async (name, input) => { const reply = JSON.parse(await services.invoke(name, JSON.stringify(input ?? null))); if (!reply.ok) throw new Error(reply.error); return reply.value; },
  subscribe: (name, input) => services.subscribe(name, JSON.stringify(input ?? null)),
  openSurface: async () => {
    const resource = await surfaces.open();
    return { render: document => resource.render(document), nextEvent: () => resource.nextEvent(), dispose: () => resource[Symbol.dispose]() };
  },
});
let session;
const encode = value => {
  const result = JSON.stringify(value ?? null);
  if (new TextEncoder().encode(result).byteLength > 16384) throw new Error('Script output limit exceeded');
  return result;
};
const execute = (source, input) => new Function('input', 'bindings', `"use strict"; return (async () => {${source}\n})();`)(JSON.parse(input), bindings);
export async function evaluate(source, input) { return encode(await execute(source, input)); }
export async function start(source, input) { stop(); session = await execute(source, input); return encode({ started: true }); }
export async function dispatch(input) {
  if (!session) throw new Error('Session is stopped');
  const value = JSON.parse(input);
  if (session.methods) {
    const method = Object.hasOwn(session.methods, value.method) ? session.methods[value.method] : undefined;
    if (typeof method !== 'function') throw new Error('Unknown service method');
    return encode(await method(value.input));
  }
  return encode(await session.update(value));
}
export function stop() { const current = session; session = undefined; current?.dispose?.(); }
