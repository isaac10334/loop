import { acquire } from 'loopkit:app/notes@0.1.0';
import type { Action, View, Node } from './bindings/interfaces/loopkit-app-ui.js';
let count = 0;
let note: ReturnType<typeof acquire> | undefined;

export async function dispatch(input: Action): Promise<View> {
  note ??= acquire();
  let status = 'Ready when you are.';
  if (input === 'delayed-increment') {
    // JS timer works inside a synchronous component export; this is NOT P3.
    await new Promise(resolve => setTimeout(resolve, 800));
  }
  if (input === 'increment' || input === 'delayed-increment') {
    count++;
    status = input === 'increment' ? 'One small step.' : 'JS timer completed (synchronous component ABI).';
  }
  try {
    if (input === 'read-note') status = note.read();
    if (input === 'write-note') { note.write(`Saved count: ${count}`); status = 'Note saved.'; }
  } catch (error) { status = `${input}: ${String(error)}`; }
  const node = (parent: number | undefined, kind: Node['kind'], text = '', action?: Action, gap = 0): Node =>
    ({ parent, kind, text, action, gap, align: 'start' });
  return { count, status, nodes: [
    node(undefined, 'column', '', undefined, 20),
    node(0, 'text', 'Make a little progress.'), node(0, 'text', String(count)),
    node(0, 'row', '', undefined, 12), node(3, 'button', 'Add one', 'increment'),
    node(3, 'button', 'Add after a moment', 'delayed-increment'),
    node(0, 'row', '', undefined, 12), node(6, 'button', 'Read note', 'read-note'),
    node(6, 'button', 'Save count', 'write-note'),
  ] };
}
