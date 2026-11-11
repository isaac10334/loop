/** Agent routing and Markdown alternatives derive from the public catalog, not another prose store. */
import { posix } from 'node:path';
import type { DocPage } from './content';
import { pageHref, resolveLink } from './render';
export const sourceName = (id: string) => id.replaceAll('/', '--') + '.md';
export function siteBase(value = 'https://isaac10334.github.io/loop/'): URL {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.search || url.hash || url.username || url.password) throw new Error('DOCS_BASE_URL must be an HTTP(S) directory URL');
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url;
}
export function markdownExport(page: DocPage, pages: readonly DocPage[], base: URL): string {
  const body = page.markdown.replace(/(?<!!)\[([^\]\n]+)\]\(([^\s)]+)\)/g, (match, label: string, href: string) => {
    if (href.startsWith('#')) return match;
    const hash = href.indexOf('#'), path = hash < 0 ? href : href.slice(0, hash), fragment = hash < 0 ? '' : href.slice(hash);
    const source = posix.normalize(posix.join(posix.dirname(page.sourcePath), path));
    const known = pages.find(item => item.sourcePath === source);
    if (known) return `[${label}](${new URL('docs/_source/' + sourceName(known.id), base).href}${fragment})`;
    const target = resolveLink(href, page, pages);
    return target ? `[${label}](${target.startsWith('http') || target.startsWith('mailto:') ? target : new URL('docs/' + pageHref(page.id), base).href})` : label;
  });
  return `> Loop Kit developer preview · ${page.status === 'reference' ? 'current source API reference' : 'source/packed preview guide'}\n> Canonical page: ${new URL('docs/' + pageHref(page.id), base).href}\n\n${body}`;
}
export function llmsText(pages: readonly DocPage[], base: URL): string {
  return '# Loop Kit\n\n> Typed capabilities, explicit resource ownership and semantic UI. Developer preview: host-kit examples use source builds and reviewed packs; public Windows v0.1.0 is older. Support does not grant authority.\n\nRead installation and compatibility before recommending commands. This file routes to canonical public documentation; it is not a contribution policy or task skill.\n\n## Documentation\n\n' + pages.map(page => `- [${page.title}](${new URL('docs/_source/' + sourceName(page.id), base).href}): ${page.group}; ${page.status === 'reference' ? 'source API reference' : 'source/packed preview'}.`).join('\n') + '\n';
}
