# CLI and configuration reference

These host-kit commands describe the **source-built preview**. The latest public Windows v0.1.0 release is a legacy CLI; see [installation](installation.md). Check `loop --help` on the binary you actually invoke.

## Host-kit commands

| Task | Command |
| --- | --- |
| Scaffold | `loop create <path> --kit browser\|native --yes` |
| Static inspection | `loop inspect <root> --json` |
| Trusted evaluation | `loop inspect <root> --config loop.config.ts --evaluate-config --trust-local-config --target <id> --json` |
| Run | `loop run <root> --config loop.config.ts --trust-local-config --target <id> --instance <name>` |
| Develop | `loop dev <root> --config loop.config.ts --trust-local-config --target <id> --instance <name>` |
| Build | `loop build <root> --config loop.config.ts --trust-local-config --target <id>` |
| Stop | `loop stop <instance> --root <root> --json` |
| Restart | `loop restart <instance> --root <root> --trust-local-config --json` |

Create does not install dependencies. Review the generated project and prepare a frozen lock before evaluation. A project with several targets requires explicit target selection. Run/dev stay in the foreground; stop from another terminal or use the normal termination signal. JSON success is emitted after shutdown; startup information appears on stderr.

Static inspect reads literal metadata without importing config. Evaluation, run, dev and config-mode build execute same-user trusted code. There is no durable blanket trust grant. `--port` and `--profile` select resources; they do not authorize guest operations.

## Configuration files

| File | Purpose |
| --- | --- |
| `loop.config.ts` | Trusted versioned kit/plugin/target composition. One default export from `defineConfig`. |
| `loop.package.json` | Literal source inventory and pinned source dependencies. Does not execute code or issue grants. |
| `package.json` and dependency lock | Installed package versions/tool inputs; installation is explicit. |
| `loop.toml` | Existing legacy Component application format; not silently merged with typed config. |

Paths resolve from the explicitly selected project/config root, not arbitrary parent discovery. Unknown required schemas/fields reject. Config imports, source inventory and dependency locks must agree; do not work around currency checks with private source imports.

## Errors and recovery

Config-mode JSON errors carry diagnostic code/message. Exit codes distinguish invocation/schema (2), trust (3), tool/runtime/build (4), conflict/busy/stale (5) and protocol (6). Clap syntax/help may exit before the JSON handler. Preserve the diagnostic code before deciding whether to retry. Legacy errors retain their existing stderr/exit behavior.

Noncooperative trusted hooks may delay cleanup. Restart requires fresh config trust before stopping the old instance. Source replacement that needs new imports can require a restart; a failed build must not be treated as a successful replacement.

## Legacy application route

```powershell
loop create hello --template desktop --language rust --yes
loop run hello --headless --actions refresh,increment
loop build hello --release
```

These are legacy `loop.toml` commands, not arbitrary Component-world execution. Native `loop run hello` without `--headless` opens a window. Generated host builds resolve an exact host crate; published `loop-host 0.1.0` is not compatible with the new native-kit API. Use the reviewed development route rather than treating a local path patch as a public installation check.
