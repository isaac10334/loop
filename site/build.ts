/** Dependency-free static docs compiler. Markdown imports are bundled by Bun, never fetched by clients. */
import { mkdir, readdir, writeFile, realpath, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pages } from "./content";
import { renderMarkdown, escapeHtml as e, pageHref } from "./render";
import { documentShell } from "./shell";
import { checkSite } from "./check";
import { llmsText, markdownExport, siteBase, sourceName } from './exports';
import { support } from './support';
import { buildDemo } from './demo-build';
import { verifyPublication } from './publication';
const base = siteBase(process.env.DOCS_BASE_URL);

const root = resolve(import.meta.dir, "..");
const publication = join(root, 'target/site');
const output = join(publication, 'docs');
// Only this resolved generated tree may be replaced. Never publish site source/test files.
if (existsSync(publication)) {
  const actual = await realpath(publication), expected = join(await realpath(root), 'target', 'site');
  if (actual !== expected) throw new Error('Site output resolves outside the expected generated directory');
  await rm(publication, { recursive: true, force: true });
}
await mkdir(join(output, "_assets"), { recursive: true });
for (const file of ['index.html', 'favicon.svg']) await writeFile(join(publication, file), new Uint8Array(await Bun.file(join(root, 'site', file)).arrayBuffer()));
await mkdir(join(output, "_source"), { recursive: true });
const hasher = new Bun.CryptoHasher("sha256");
for (const page of pages) { hasher.update(page.sourcePath); hasher.update("\0"); hasher.update(page.markdown); hasher.update("\0"); }
const identity = hasher.digest("hex");
const records: { id: string; source: string; status: string; sha256: string }[] = [];
for (const page of pages) {
  const rendered = renderMarkdown(page.markdown, page, pages);
  if (page.package) {
    const directory = join(root, "packages", page.package, "dist");
    let declarations: string[];
    try { declarations = (await readdir(directory)).filter(file => file === 'index.d.ts'); if (!declarations.length) throw new Error('Missing root declarations'); }
    catch { throw new Error(`Missing ${page.package} declarations; run bun run build before building the docs site.`); }
    rendered.html += '<h2 id="public-api-declarations">Public API declarations</h2><p>Root exports from the current package build. Referenced declaration modules describe these exports; private source subpaths are not public entrypoints.</p>';
    rendered.headings.push({ id: "public-api-declarations", title: "Public API declarations", level: 2 });
    for (const file of declarations) rendered.html += `<details><summary>${e(file)}</summary><div class="code-block"><div class="code-toolbar"><span>TypeScript declarations</span><button class="copy-code" type="button" aria-label="Copy code">Copy</button></div><pre><code>${e(await Bun.file(join(directory, file)).text())}</code></pre></div></details>`;
  }
  const target = join(output, pageHref(page.id));
  await mkdir(resolve(target, ".."), { recursive: true });
  await writeFile(target, documentShell(page, pages, rendered.html, rendered.headings, identity));
  await writeFile(join(output, '_source', sourceName(page.id)), markdownExport(page, pages, base));
  records.push({ id: page.id, source: page.sourcePath, status: page.status, sha256: new Bun.CryptoHasher("sha256").update(page.markdown).digest("hex") });
}
await writeFile(join(output, "_assets/docs.css"), await Bun.file(join(root, "site/styles.css")).text());
const client = await Bun.build({ entrypoints: [join(root, "site/client.ts")], target: "browser", minify: true });
if (!client.success) throw new AggregateError(client.logs, "Docs client build failed");
await writeFile(join(output, "_assets/docs.js"), await client.outputs[0]!.text());
const search = pages.map(page => ({ title: page.title, group: page.group, href: pageHref(page.id), text: page.markdown.toLowerCase().replace(/[`#*_[\]()>|]/g, " ").replace(/\s+/g, " ") }));
await writeFile(join(output, "search-index.json"), JSON.stringify(search));
await writeFile(join(output, "build-receipt.json"), JSON.stringify({ format: "loop-docs-v1", contentSha256: identity, toolchain: `bun@${Bun.version}`, pages: records }, null, 2) + "\n");
await writeFile(join(output, 'support.json'), JSON.stringify({ format: 'loop-support-v1', reviewedAt: '2026-11-11', distribution: 'source/packed preview', entries: support }, null, 2) + '\n');
await writeFile(join(publication, 'llms.txt'), llmsText(pages, base));
await writeFile(join(publication, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + ['', ...pages.map(page => 'docs/' + pageHref(page.id))].map(path => `<url><loc>${e(new URL(path, base).href)}</loc></url>`).join('') + '</urlset>\n');
await buildDemo(join(output, '_demo'));
await writeFile(join(publication, "install.ps1"), await Bun.file(join(root, "scripts/manage.ps1")).text());
await verifyPublication(publication, pages, base);
await checkSite(publication, ['index.html', 'docs/_demo/index.html', ...pages.map(page => 'docs/' + pageHref(page.id))]);
console.log(`Built ${pages.length} documentation pages from imported Markdown · ${identity.slice(0, 12)}`);
