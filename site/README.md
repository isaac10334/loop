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

Preview: `http://127.0.0.1:3098`. The build emits only public artifacts to
`target/site`; Pages uploads that directory, never this source directory. It does
not deploy or publish. `DOCS_BASE_URL` can override the canonical directory URL
(default `https://isaac10334.github.io/loop/`); relative navigation works under a
subdirectory. The installer and real Windows release links are preserved.

The same catalog generates HTML, search, Markdown alternatives, `llms.txt`, sitemap
and build receipt. `support.ts` supplies the small structured support catalog,
rendered matrix and JSON export. Support is not authority; status and evidence
must remain explicit. New public content requires a catalog entry and audience
review; do not recursively discover Markdown.

`demo-build.ts` bundles the canonical counter example's official config, provider
and application through public host-kit resolver/bootstrap APIs. The resulting
in-browser demo runs real semantic input/state/disposal, not a simulated interface.
Its build receipt is a site-bundling receipt, not an evaluated CLI or installed
release receipt. The separate outside-checkout example check owns those claims.

## Headless browser check

Use an existing Playwright ESM installation and Chrome. The script installs nothing,
uses an isolated profile under `target/docs-browser-check`, and opens no visible
native window. With the preview running:

```powershell
$env:PLAYWRIGHT_MODULE = 'file:///absolute/path/to/playwright/index.mjs'
$env:DOCS_ORIGIN = 'http://127.0.0.1:3098'
node site/browser-check.mjs
```

`CHROME_PATH` selects another existing Chrome executable. Run through Node on
Windows for Playwright pipe support. The script checks the real counter demo,
shutdown/restart, navigation/TOC/search, Markdown alternatives, content exclusions,
keyboard focus, theme and mobile overflow/menu. Receipts and desktop/mobile
screenshots are local generated artifacts. Unit tests and HTTP checks do not
replace this browser check, nor does Chrome prove native Tao/Wry behavior.
