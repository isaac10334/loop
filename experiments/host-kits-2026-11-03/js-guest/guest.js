// js-guest/guest.ts
async function replaceText(document, from, to) {
  const before = await document.read();
  const after = await document.write(before.revision, before.source.replaceAll(from, to));
  return `revision=${after.revision};source=${after.source}`;
}
export {
  replaceText
};
