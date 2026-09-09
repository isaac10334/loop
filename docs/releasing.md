# Publishing

Repository: `isaac10334/loop`. Website: https://isaac10334.github.io/loop/.

All workflows use manual dispatch from GitHub's Actions tab.

## Repository configuration

- **Settings → Pages → Build and deployment → Source: GitHub Actions.**
- **Settings → Secrets and variables → Actions → New repository secret**:
  name it **CARGO_REGISTRY_TOKEN** and paste a crates.io token permitted to
  publish `loop-host`. This is a secret, not a repository variable.
- No other custom secrets or variables are required. GitHub supplies
  `GITHUB_TOKEN`; the workflows request their required permissions.

## Release order

1. Update the workspace version and the CLI's exact `loop-host` dependency
   together. Keep the Rust version in the toolchain, installer release metadata,
   CLI build tasks, and documentation in sync.
2. Run **Publish host crate**. Crates.io versions cannot be overwritten.
3. Run **Release Windows CLI** with the matching version, without a `v` prefix.
   It checks, builds, tests the installer and published host, then creates the
   tagged release. Existing release tags are not overwritten.
4. Run **Deploy website** when the page or installer changes.

The first host publication can also use a local `cargo login` followed by
`cargo publish --locked -p loop-host`. A local login does not configure the
GitHub Actions secret.

## Stable links

The install command stays at
`https://isaac10334.github.io/loop/install.ps1`.
It resolves the latest release, then downloads assets from that exact version.
The direct ZIP link uses
`https://github.com/isaac10334/loop/releases/latest/download/loop-windows-x64.zip`.

Keep the account, repository name, and asset names unchanged. No custom domain
or Vercel account is required. Pages and release assets can later sit behind a
custom domain without changing the packaging process.
