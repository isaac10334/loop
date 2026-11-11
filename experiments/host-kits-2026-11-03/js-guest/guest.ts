interface Snapshot { revision: string; source: string }
interface Document { read(): Promise<Snapshot>; write(expectedRevision: string, source: string): Promise<Snapshot> }
export async function replaceText(document: Document, from: string, to: string): Promise<string> {
  const before = await document.read();
  const after = await document.write(before.revision, before.source.replaceAll(from, to));
  return `revision=${after.revision};source=${after.source}`;
}
