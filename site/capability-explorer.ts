import { capabilityMatrix, type CapabilityHost, type CapabilityStatus, type EngineCapability } from './support';
import { icon, type IconName } from './icons';

export interface CapabilityExplorerOptions { id?: string; compact?: boolean }
let nextExplorerId = 0;
const compactIds = new Set(['application-lifecycle', 'component-loading', 'semantic-ui', 'permissions', 'gpu-resources', 'simulation-clocks']);
const hosts: readonly { id: CapabilityHost; label: string; icon: IconName }[] = [
  { id: 'browser', label: 'Browser', icon: 'browser' },
  { id: 'rust-desktop', label: 'Rust desktop', icon: 'desktop' },
  { id: 'headless', label: 'Headless', icon: 'terminal' }
];
const statusText: Record<CapabilityStatus, string> = {
  supported: 'Supported', experimental: 'Experimental', proposed: 'Proposed',
  'application-owned': 'Application-owned', unsupported: 'Unsupported', untested: 'Untested'
};
const statusIcon: Record<CapabilityStatus, IconName> = {
  supported: 'check', experimental: 'experiment', proposed: 'roadmap',
  'application-owned': 'shield', unsupported: 'close', untested: 'unknown'
};
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}
function statusMarkup(status: CapabilityStatus): string {
  return `<span class="capability-status capability-status--${status}" data-status="${status}">${icon(statusIcon[status])}<span>${statusText[status]}</span></span>`;
}
function hostCells(item: EngineCapability): string {
  return hosts.map(({ id, label }) => {
    const support = item.hosts[id];
    return `<div class="capability-host-cell" data-host-cell="${id}"><span class="capability-host-label">${label}</span>${statusMarkup(support.status)}<p>${escapeHtml(support.note)}</p></div>`;
  }).join('');
}
function row(item: EngineCapability, explorerId: string): string {
  const searchText = [item.name, item.area, ...hosts.map(({ id }) => item.hosts[id].note), item.evidence].join(' ');
  return `<article class="capability-entry" id="${escapeHtml(explorerId)}-${escapeHtml(item.id)}" data-capability-entry data-capability-id="${escapeHtml(item.id)}" data-area="${escapeHtml(item.area)}" data-search="${escapeHtml(searchText.toLocaleLowerCase())}" data-browser-status="${item.hosts.browser.status}" data-rust-desktop-status="${item.hosts['rust-desktop'].status}" data-headless-status="${item.hosts.headless.status}">
    <div class="capability-entry-heading"><h3>${escapeHtml(item.name)}</h3><p class="capability-area">${escapeHtml(item.area)}</p></div>
    <div class="capability-hosts">${hostCells(item)}</div>
    <details class="capability-evidence"><summary>Notes &amp; evidence</summary><dl>${hosts.map(({ id, label }) => `<div data-detail-host="${id}"><dt>${label} · ${statusText[item.hosts[id].status]}</dt><dd>${escapeHtml(item.hosts[id].note)}</dd></div>`).join('')}<div><dt>Evidence</dt><dd>${escapeHtml(item.evidence)}</dd></div></dl></details>
  </article>`;
}

/** Render the full or curated capability catalog as useful static HTML without JavaScript. */
export function renderCapabilityExplorer(options: CapabilityExplorerOptions = {}): string {
  const id = options.id ?? `capability-explorer-${++nextExplorerId}`;
  const items = options.compact ? capabilityMatrix.filter(item => compactIds.has(item.id)) : capabilityMatrix;
  const rows = items.map(item => row(item,id)).join('');
  const filters: readonly CapabilityStatus[] = ['supported', 'experimental', 'proposed', 'application-owned', 'unsupported', 'untested'];
  return `<section class="capability-explorer" id="${escapeHtml(id)}" data-capability-explorer data-compact="${options.compact ? 'true' : 'false'}" aria-labelledby="${escapeHtml(id)}-title">
    <header class="capability-explorer-heading"><div><h2 id="${escapeHtml(id)}-title">${options.compact ? 'Choose your host.' : 'Capability explorer'}</h2><p>${options.compact ? "See what works today, what you supply, and what's planned." : 'Choose a host, filter by feature or status, then open a row for limits and evidence. Support status does not grant authority.'}</p></div><output data-capability-count aria-live="polite">${items.length} capabilities</output></header>
    <div class="capability-controls" data-capability-controls hidden>
      <div class="capability-host-picker" role="group" aria-label="Host profile">${hosts.map(({ id: hostId, label, icon: iconName }, index) => `<button type="button" data-host-choice="${hostId}" aria-pressed="${index === 0}">${icon(iconName)}<span>${label}</span></button>`).join('')}</div>
      <div class="capability-filter-row"><label>Search capabilities<input type="search" data-capability-search autocomplete="off" placeholder="Name, area, or notes"></label>
        <label>Active host status<select data-capability-status><option value="all">All statuses</option>${filters.map(status => `<option value="${status}">${statusText[status]}</option>`).join('')}</select></label>
        <button type="button" data-capability-reset>Clear filters</button></div>
    </div>
    <p class="capability-empty" data-capability-empty hidden>No capabilities match these filters.</p>
    <div class="capability-entries">${rows}</div>
  </section>`;
}

export { statusText };
