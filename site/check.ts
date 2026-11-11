/** Validate generated local page/resource links and heading fragments before Pages publication. */
import { resolve, sep } from "node:path";
export async function checkSite(root: string, paths: readonly string[]): Promise<void> {
  const rootPath = resolve(root);
  const documents = new Map<string, { ids: Set<string>; links: string[] }>();
  for (const path of paths) {
    const ids = new Set<string>(), links: string[] = [];
    const handler = new HTMLRewriter().on("[id]", { element(element) { const id = element.getAttribute("id"); if (id) ids.add(id); } })
      .on("a[href],link[href],script[src],iframe[src]", { element(element) { const href = element.getAttribute("href") ?? element.getAttribute("src"); if (href) links.push(href); } });
    await handler.transform(new Response(Bun.file(resolve(rootPath, path)))).text();
    documents.set(path, { ids, links });
  }
  const failures: string[] = [];
  for (const [path, document] of documents) for (const href of document.links) {
    if (/^(?:https?:|mailto:)/i.test(href)) continue;
    const url = new URL(href, `https://docs.invalid/${path}`);
    const target = decodeURIComponent(url.pathname).slice(1) + (url.pathname.endsWith("/") ? "index.html" : "");
    const file = resolve(rootPath, target);
    if (!file.startsWith(rootPath + sep) || !await Bun.file(file).exists()) { failures.push(`${path}: missing local target ${href}`); continue; }
    if (url.hash && documents.has(target) && !documents.get(target)!.ids.has(decodeURIComponent(url.hash.slice(1)))) failures.push(`${path}: missing heading ${href}`);
  }
  if (failures.length) throw new Error("Documentation links failed:\n" + failures.join("\n"));
  console.log(`Checked local links and anchors across ${paths.length} pages`);
}
