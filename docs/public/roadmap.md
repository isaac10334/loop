# Roadmap and current limits

Loop Kit's next goal is a dependable path from a small application to a composed browser or Windows tool—not a larger package inventory.

## Next user-facing outcomes

1. **Install the demonstrated implementation.** Coordinate a new host crate and CLI release, then publish the reviewed npm packages so examples no longer need local tarball overrides.
2. **Make Component limits explicit and enforceable.** Close the browser canonical ABI pre-decode allocation gap before describing hostile-guest budget conformance as complete.
3. **Grow from real applications.** Use a small shell/input/UI specification to identify missing semantic behavior, with independent instances and disposal acceptance.

## Limits today

- Initial native presentation is Windows-only and supports a subset of semantic elements.
- Browser Component evidence is Chromium-family evidence, not Safari, Firefox or every WebView.
- The async document profile is a reviewed profile, not arbitrary-world execution or proven language parity.
- Trusted TypeScript configuration/providers are not sandboxed by scopes or process framing.
- No cloud marketplace, universal capability registry, voxel engine, multiplayer stack or GPU platform is included.

## Wizard Tower: the next specification slice

Wizard Tower is a planned complex voxel game intended to test Loop Kit against a demanding application. Its first useful foundation would be a shell: a start/pause/status panel, text input with predictable focus, replaceable state operations, and independent sessions that clean up when stopped.

The browser counter/provider example already demonstrates the smaller input, composition and ownership boundaries. It is a starting point for that shell, not a game engine. Voxel rendering, ECS, networking and GPU access are outside this preview.
