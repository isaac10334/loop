/** Verify the composed public output, including machine exports, against the same finite catalog. */
import { readdir } from 'node:fs/promises';
import { join, posix } from 'node:path';
import type { DocPage } from './content';
import { pageHref } from './render';
import { sourceName } from './exports';
export async function verifyPublication(root: string, pages: readonly DocPage[], base: URL): Promise<void> {
  const expected = new Set(['index.html', 'favicon.svg', 'assets/kinetic-gear.svg', 'assets/loop-display.ttf', 'assets/Space-Grotesk-LICENSE.txt', 'assets/loop-sans.ttf', 'assets/landing.css', 'assets/DM-Sans-LICENSE.txt', 'install.ps1', 'llms.txt', 'sitemap.xml',
    'docs/_assets/docs.css', 'docs/_assets/docs.js', 'docs/search-index.json', 'docs/build-receipt.json', 'docs/support.json',
    'docs/_demo/index.html', 'docs/_demo/app.js', 'docs/_demo/build-receipt.json',
    ...pages.flatMap(page => ['docs/' + pageHref(page.id), 'docs/_source/' + sourceName(page.id)])]);
  const files: string[] = [];
  async function walk(path = ''): Promise<void> {
    for (const entry of await readdir(join(root, path), { withFileTypes: true })) {
      const name = posix.join(path, entry.name);
      if (entry.isDirectory()) await walk(name); else if (entry.isFile()) files.push(name); else throw Error('Unexpected public output entry: ' + name);
    }
  }
  await walk();
  if (files.length !== expected.size || files.some(file => !expected.has(file))) throw Error('Public output differs from the publication allowlist');
  const forbidden = /(?:C:[\\/](?:Users|src)[\\/]|ENGINEERING_PLAN|docs\/development-alpha|agent-prompts|execution-plan|TickTick)/;
  for (const file of files.filter(file => /\.(html|md|txt|json|xml)$/.test(file))) {
    const text = await Bun.file(join(root, file)).text();
    if (forbidden.test(text)) throw Error('Internal working material leaked into ' + file);
    if (file.endsWith('.md') || file === 'llms.txt') {
      for (const [, href] of text.matchAll(/\]\((https?:\/\/[^\s)]+)\)/g)) {
        const url = new URL(href!);
        if (url.origin === base.origin && url.pathname.startsWith(base.pathname)) {
          const local = decodeURIComponent(url.pathname.slice(base.pathname.length));
          if (!expected.has(local)) throw Error(`Machine export ${file} links to absent public output ${local}`);
        }
      }
    }
  }
  console.log(`Verified ${files.length} allowlisted public artifacts and machine-export links`);
}
