/** Semantic website icons. Swap this one registry to change the visual source, not call sites.
 * Original 24px stroke glyphs; no icon font, runtime dependency or renderer coupling.
 * Icons are decorative unless label is supplied. Icon-only controls still need a button name.
 */
const glyphs = {
  book: '<path d="M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H4zM13 7a3 3 0 0 1 3-3h5v15h-4a4 4 0 0 0-4 2"/>',
  browser: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M7 6.5h.01M10 6.5h.01"/>',
  desktop: '<rect x="3" y="3" width="18" height="13" rx="2"/><path d="M8 21h8M12 16v5"/>',
  terminal: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3M13 15h4"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  experiment: '<path d="M9 3h6M10 3v6l-6 10a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2L14 9V3M7 15h10"/>',
  roadmap: '<circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="M7 5h9a4 4 0 0 1 0 8H8a3 3 0 0 0 0 6h9"/>',
  external: '<path d="M14 3h7v7M21 3 10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/>',
  unknown: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1 .6-1.5 1-1.5 2M12 17h.01"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM8 12l3 3 5-6"/>',
  component: '<path d="m12 2 5 5-5 5-5-5zM6 10l5 5-5 5-5-5zM18 10l5 5-5 5-5-5zM12 17l2.5 2.5-2.5 2.5-2.5-2.5z"/>',
  layers: '<path d="m12 3 10 5-10 5L2 8zM2 12l10 5 10-5M2 16l10 5 10-5"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  'arrow-right': '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  gamepad: '<path d="M7 7h10a4 4 0 0 1 4 4l1 6a2 2 0 0 1-3 2l-4-3H9l-4 3a2 2 0 0 1-3-2l1-6a4 4 0 0 1 4-4Z M6 10v4M4 12h4M16 11h.01M19 13h.01"/>',
  agent: '<rect x="4" y="7" width="16" height="13" rx="3"/><path d="M12 3v4M9 12h.01M15 12h.01M9 16h6M1 11v5M23 11v5"/>',
  code: '<path d="m8 6-6 6 6 6m8-12 6 6-6 6M14 3l-4 18"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  moon: '<path d="M20.8 13a9 9 0 1 1-9.8-9.8A7 7 0 0 0 20.8 13Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
} as const;
export type IconName = keyof typeof glyphs;
const escape = (text: string) => text.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
export function icon(name: IconName, options: { label?: string; className?: string } = {}): string {
  return `<svg class="icon${options.className ? ' ' + escape(options.className) : ''}" data-icon="${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" focusable="false" ${options.label ? `role="img" aria-label="${escape(options.label)}"` : 'aria-hidden="true"'}>${glyphs[name]}</svg>`;
}
