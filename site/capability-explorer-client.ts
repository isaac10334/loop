const mountedRoots = new WeakSet<object>();
const hostIds = ['browser', 'rust-desktop', 'headless'] as const;
type HostId = typeof hostIds[number];
type Explorer = HTMLElement & { dataset: DOMStringMap };

function belongsToRoot(element: Element, root: ParentNode): boolean {
  return root === element || ('contains' in root && (root as Node).contains(element));
}
function refresh(explorer: Explorer, host: HostId): void {
  explorer.dataset.activeHost = host;
  const query = explorer.querySelector<HTMLInputElement>('[data-capability-search]')?.value.trim().toLocaleLowerCase() ?? '';
  const status = explorer.querySelector<HTMLSelectElement>('[data-capability-status]')?.value ?? 'all';
  const rows = [...explorer.querySelectorAll<HTMLElement>('[data-capability-entry]')];
  let visible = 0;
  for (const entry of rows) {
    const matchesSearch = !query || (entry.dataset.search ?? '').includes(query);
    // HTML dataset camel casing for rust-desktop-status is rustDesktopStatus.
    const statusKey = host === 'rust-desktop' ? 'rustDesktopStatus' : `${host}Status`;
    const matchesActiveStatus = status === 'all' || entry.dataset[statusKey] === status;
    const show = matchesSearch && matchesActiveStatus;
    entry.hidden = !show;
    if (show) visible++;
    for (const cell of entry.querySelectorAll<HTMLElement>('[data-host-cell]')) cell.hidden = cell.dataset.hostCell !== host;
    for (const note of entry.querySelectorAll<HTMLElement>('[data-detail-host]')) note.hidden = note.dataset.detailHost !== host;
  }
  const count = explorer.querySelector<HTMLOutputElement>('[data-capability-count]');
  if (count) count.textContent = `${visible} ${visible === 1 ? 'capability' : 'capabilities'}`;
  const empty = explorer.querySelector<HTMLElement>('[data-capability-empty]');
  if (empty) empty.hidden = visible !== 0;
  for (const button of explorer.querySelectorAll<HTMLButtonElement>('[data-host-choice]')) {
    button.setAttribute('aria-pressed', String(button.dataset.hostChoice === host));
  }
}

/** Enhance static explorer markup once per root; native disclosures remain usable without JS. */
export function mountCapabilityExplorers(root: ParentNode = document): void {
  if (typeof root !== 'object' || root === null) return;
  const explorers = (): Explorer[] => {
    const found = [...root.querySelectorAll<Explorer>('[data-capability-explorer]')];
    if (root instanceof Element && root.matches('[data-capability-explorer]')) found.unshift(root as Explorer);
    return found;
  };
  const ensureMount = (explorer: Explorer): void => {
    if (explorer.dataset.enhanced === 'true') return;
    explorer.dataset.enhanced = 'true';
    const controls = explorer.querySelector<HTMLElement>('[data-capability-controls]');
    if (controls) controls.hidden = false;
    refresh(explorer, 'browser');
  };
  for (const explorer of explorers()) ensureMount(explorer);
  if (mountedRoots.has(root as object)) return;
  mountedRoots.add(root as object);
  const eventRoot = root as ParentNode & EventTarget;
  const findExplorer = (target: EventTarget | null): Explorer | undefined => {
    if (!(target instanceof Element)) return;
    const explorer = target.closest<Explorer>('[data-capability-explorer]');
    return explorer && belongsToRoot(explorer, root) ? explorer : undefined;
  };
  eventRoot.addEventListener('click', event => {
    const explorer = findExplorer(event.target);
    if (!explorer) return;
    const button = (event.target as Element).closest<HTMLButtonElement>('button');
    if (!button || !explorer.contains(button)) return;
    if (button.matches('[data-host-choice]')) {
      const host = button.dataset.hostChoice as HostId;
      if (hostIds.includes(host)) refresh(explorer, host);
    } else if (button.matches('[data-capability-reset]')) {
      const search = explorer.querySelector<HTMLInputElement>('[data-capability-search]');
      const status = explorer.querySelector<HTMLSelectElement>('[data-capability-status]');
      if (search) search.value = '';
      if (status) status.value = 'all';
      refresh(explorer, explorer.dataset.activeHost as HostId || 'browser');
      search?.focus();
    }
  });
  eventRoot.addEventListener('input', event => {
    const explorer = findExplorer(event.target);
    if (explorer && (event.target as Element).matches('[data-capability-search]')) refresh(explorer, explorer.dataset.activeHost as HostId || 'browser');
  });
  eventRoot.addEventListener('change', event => {
    const explorer = findExplorer(event.target);
    if (explorer && (event.target as Element).matches('[data-capability-status]')) refresh(explorer, explorer.dataset.activeHost as HostId || 'browser');
  });
}
