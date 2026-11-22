import { describe, expect, test } from 'bun:test';
import { capabilityMatrix } from './support';
import { renderCapabilityExplorer } from './capability-explorer';

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

describe('capability explorer static rendering', () => {
  test('renders every catalog entry and its exact host statuses, notes and evidence', () => {
    const html = renderCapabilityExplorer({ id: 'all-capabilities' });
    expect((html.match(/data-capability-entry\b/g) ?? []).length).toBe(capabilityMatrix.length);
    expect(capabilityMatrix).toHaveLength(21);
    for (const item of capabilityMatrix) {
      expect(html).toContain(`data-capability-id="${item.id}" data-area="${escapeHtml(item.area)}"`);
      expect(html).toContain(`<h3>${escapeHtml(item.name)}</h3>`);
      expect(html).toContain(escapeHtml(item.evidence));
      for (const host of ['browser', 'rust-desktop', 'headless'] as const) {
        expect(html).toContain(`data-${host}-status="${item.hosts[host].status}"`);
        expect(html).toContain(escapeHtml(item.hosts[host].note));
      }
    }
    expect(html).toContain('hidden');
    expect(html).toContain('<details class="capability-evidence">');
    expect(html).toContain('aria-live="polite"');
  });

  test('compact mode is a curated 6–8 entries and generated ids are unique', () => {
    const compact = renderCapabilityExplorer({ compact: true });
    expect((compact.match(/data-capability-entry\b/g) ?? []).length).toBeGreaterThanOrEqual(6);
    expect((compact.match(/data-capability-entry\b/g) ?? []).length).toBeLessThanOrEqual(8);
    for (const id of ['application-lifecycle', 'component-loading', 'semantic-ui', 'permissions', 'gpu-resources', 'simulation-clocks']) {
      expect(compact).toContain(`data-capability-id="${id}"`);
      expect(capabilityMatrix.some(item => item.id === id)).toBe(true);
    }
    const first = renderCapabilityExplorer();
    const second = renderCapabilityExplorer();
    const idOf = (html: string) => html.match(/<section[^>]* id="([^"]+)"/)?.[1];
    expect(idOf(first)).not.toBe(idOf(second));
  });

  test('escapes custom ids and renders accessible textual status names', () => {
    const html = renderCapabilityExplorer({ id: 'unsafe"<id>' });
    expect(html).toContain('id="unsafe&quot;&lt;id&gt;"');
    expect(html).toContain('Supported');
    expect(html).toContain('Experimental');
    expect(html).toContain('Application-owned');
    expect(html).toContain('Unsupported');
    expect(html).toContain('Untested');
    expect(html).toContain('Proposed');
  });
});
