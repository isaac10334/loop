// Alternative compiler probe only. No production SDK or ambient host authority.
import * as services from 'loopkit:script-probe/services@0.1.0';
import * as surfaces from 'loopkit:script-probe/surfaces@0.1.0';

const bindings = {
  invoke: async (name, input) => JSON.parse(await services.invoke(name, JSON.stringify(input))),
  openSurface: () => surfaces.open(),
};
let session;

export async function evaluate(source, input) {
  const execute = new Function('input', 'bindings', `return (async () => {${source}\n})();`);
  return JSON.stringify(await execute(JSON.parse(input), bindings));
}

export async function start(source, input) {
  stop();
  const execute = new Function('input', 'bindings', `return (async () => {${source}\n})();`);
  session = await execute(JSON.parse(input), bindings);
  return JSON.stringify({ started: true });
}

export async function dispatch(input) {
  if (!session) throw new Error('Session is stopped');
  return JSON.stringify(await session.update(JSON.parse(input)));
}

export function stop() {
  if (session?.dispose) session.dispose();
  session = undefined;
}
