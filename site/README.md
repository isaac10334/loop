# Public website development

`content.ts` is the explicit publication allowlist. Canonical public guides live in
`docs/public/`; selected package READMEs provide advanced references. Internal
plans, evidence, prompts, contribution/release procedures and repository instructions
are preserved in place but are not catalog entries.

```powershell
bun install --frozen-lockfile
bun run docs:build
bun test site
bun site/serve.ts
```

The landing uses `landing.css` for its near-black/blue instrument-panel design,
VectorCraft gear artwork under `assets/`, and the existing real browser-kit demo.
`mechanism-state.ts` owns the illustrative run/pause/reverse/step/scrub transitions;
`mechanism.ts` owns its DOM projection and pauses frame scheduling offscreen or
when hidden. Reduced motion keeps manual controls but disables continuous playback.
This illustration is separate from the real Loop Kit demo. Earlier CAD exports
are retained locally but no longer published.
Theme changes propagate to that same-origin demo; its message handler checks both
origin and parent. Native view transitions enhance pointer theme changes, while
keyboard and reduced-motion changes are immediate. Reveal content remains visible
without JavaScript. No React or GPU dependency is required for this landing.

Preview: `http://127.0.0.1:3098`. The build emits only public artifacts to
`target/site`; Pages uploads that directory, never this source directory. It does
not deploy or publish. `DOCS_BASE_URL` can override the canonical directory URL
(default `https://isaac10334.github.io/loop/`); relative navigation works under a
subdirectory. The installer and real Windows release links are preserved.

The same catalog generates HTML, search, Markdown alternatives, `llms.txt`, sitemap
and build receipt. `support.ts` supplies the small structured support catalog,
rendered API catalog, browser/native/headless engine capability matrix and JSON export. The existing `entries` JSON field remains compatible; `capabilityMatrix` adds the roadmap states and boundaries. Support is not authority; status and evidence
must remain explicit. New public content requires a catalog entry and audience
review; do not recursively discover Markdown.

`demo-build.ts` bundles the canonical counter example's official config, provider
and application through public host-kit resolver/bootstrap APIs. The resulting
in-browser demo runs real semantic input/state/disposal, not a simulated interface.
Its build receipt is a site-bundling receipt, not an evaluated CLI or installed
release receipt. The separate outside-checkout example check owns those claims.

## Docs shell, icons and capability explorer

`docs-theme.css` applies the landing's dark/light palette and font pairing to the
reading layout. `docs-navigation.ts` progressively replaces the article and TOC
while keeping the header, sidebar and theme alive. It intercepts only allowlisted
same-origin docs pages; modified clicks, downloads and external links remain normal.
It keeps at most eight fetched pages, prefetches at most two concurrently on intent,
cancels superseded navigations, restores history/scroll, and falls back to ordinary
navigation for incompatible builds or failed fetches. Static links work without JS.
`client.ts` remounts TOC observation and delegated interactions after each swap.

`icons.ts` is the only glyph source. Call `icon('browser')` with a semantic
`IconName`; replace its registry to change the icon family. Icons are decorative
by default. Supply `{ label: 'Meaning' }` for a standalone meaningful image; name
icon-only buttons on the button. No icon font or React dependency is involved.

`capability-explorer.ts` projects the reviewed `support.ts` catalog into static
HTML; its client enhancement adds host selection, search and status filtering.
The landing uses a compact host showcase from the same catalog. All host notes
and evidence remain readable in native disclosures without JavaScript. Full
Markdown and JSON exports are unchanged. `landing-content.ts` owns the broader
product narrative and labels engine/agent ambitions separately from current support.

## Headless browser check

Use an existing Playwright ESM installation and Chrome. The script installs nothing,
uses an isolated profile under `target/docs-browser-check`, and opens no visible
native window. With the preview running:

```powershell
$env:PLAYWRIGHT_MODULE = 'file:///absolute/path/to/playwright/index.mjs'
$env:DOCS_ORIGIN = 'http://127.0.0.1:3098'
node site/browser-check.mjs
node site/docs-browser-check.mjs
```

`CHROME_PATH` selects another existing Chrome executable. Run through Node on
Windows for Playwright pipe support. The script checks the real counter demo,
shutdown/restart, navigation/TOC/search, Markdown alternatives, content exclusions,
keyboard focus, theme and mobile overflow/menu. Receipts and desktop/mobile
screenshots are local generated artifacts. Unit tests and HTTP checks do not
replace this browser check, nor does Chrome prove native Tao/Wry behavior.
The docs-specific check verifies persistent shell identity, nested paths, Back/Forward
scroll restoration, late-request races, ordinary-navigation fallback, explorer filters,
mobile navigation, and no-JavaScript links. It writes screenshots and a receipt under
`target/docs-navigation-check`.
