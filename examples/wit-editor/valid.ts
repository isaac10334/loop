// This import resolves the authoritative WIT directly through the content mapper.
// In a trusted TypeScript 7.1 editor, complete `document.` to inspect read/write.
import type { Document } from '../../tooling/fixtures/wit/editor.wit';

export function retainSource(document: Document) {
  const snapshot = document.read();
  const source: string = snapshot.source;
  return document.write(snapshot.revision, source);
}
