// Control: compile an interpreter once, then evaluate independently supplied JS.
export async function evaluate(source, input) {
  const execute = new Function("input", `return (async () => {${source}\n})();`);
  return JSON.stringify(await execute(JSON.parse(input)));
}
