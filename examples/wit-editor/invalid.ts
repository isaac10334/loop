// Deliberate negative fixture: WIT requires a string revision, never a number.
import type { Document } from '../../tooling/fixtures/wit/editor.wit';

export function invalidRevision(document: Document) {
  return document.write(42, '<svg/>');
}
