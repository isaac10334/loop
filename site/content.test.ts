import { expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pages } from './content';
import { support } from './support';
import { renderMarkdown, resolveLink } from './render';
import { documentShell } from './shell';
import { llmsText, markdownExport, siteBase } from './exports';
const page = (id: string) => pages.find(p => p.id === id)!;
const internal = /(?:ENGINEERING_PLAN|development-alpha|agent-workflow|execution-plan|agent-prompts|C:\/Users|C:\/src|TickTick)/;
test('publication is a finite public allowlist, never internal repository discovery', () => {
  expect(pages.length).toBe(21);
  expect(new Set(pages.map(p => p.id)).size).toBe(pages.length);
  expect(new Set(pages.map(p => p.sourcePath)).size).toBe(pages.length);
  for (const item of pages) {
    expect(item.sourcePath.startsWith('docs/public/') || /^packages\/[^/]+\/README.md$/.test(item.sourcePath)).toBe(true);
    expect(existsSync(resolve(import.meta.dir, '..', item.sourcePath))).toBe(true);
    expect(item.markdown).not.toMatch(internal);
  }
});
test('application-first navigation keeps source release status explicit', () => {
  expect(pages.slice(0, 4).map(p => p.id)).toEqual(['index', 'installation', 'quickstart', 'concepts']);
  expect(page('installation').markdown).toContain('v0.1.0');
  expect(page('installation').markdown).toContain('not yet published to npm');
  const rendered = renderMarkdown(page('index').markdown, page('index'), pages);
  const shell = documentShell(page('index'), pages, rendered.html, rendered.headings, 'test');
  expect(shell).toContain('Current source guide');
  expect(shell).not.toContain('Design &amp; roadmap');
  expect(resolveLink('quickstart.md', page('index'), pages)).toBe('quickstart.html');
  expect(resolveLink('support.md', page('quickstart'), pages)).toBe('reference/support.html');
});
test('agent routing and Markdown alternatives use the same allowlist and deployment base', () => {
  const base = siteBase('https://example.com/nested/loop/');
  const llms = llmsText(pages, base);
  expect(llms).not.toMatch(internal);
  expect(llms).toContain('https://example.com/nested/loop/docs/_source/quickstart.md');
  for (const item of pages) {
    const markdown = markdownExport(item, pages, base);
    expect(markdown).not.toMatch(internal);
    expect(markdown).toContain('Loop Kit developer preview');
    expect(markdown).not.toMatch(/\]\(\.\.?\//);
  }
  expect(markdownExport(page('index'), pages, base)).toContain('https://example.com/nested/loop/docs/_source/quickstart.md');
  expect(() => siteBase('file:///private/')).toThrow();
});
test('support entries separate implementations, authority, provenance and exact WIT identity', () => {
  for (const item of support) {
    expect(item.authority.length).toBeGreaterThan(10);
    expect(item.restrictions.length).toBeGreaterThan(10);
    expect(existsSync(resolve(import.meta.dir, '..', item.evidence.source))).toBe(true);
    if (item.wit) expect(existsSync(resolve(import.meta.dir, '..', item.wit))).toBe(true);
  }
  expect(support.filter(item => item.id === 'loopkit:ui/surfaces').length).toBe(2);
  expect(support.some(item => item.status === 'unsupported')).toBe(true);
  expect(page('reference/support').markdown).toContain('canonical pre-lift');
});
