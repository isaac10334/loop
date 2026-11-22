# Website creative assets

## Current kinetic vector artwork

`kinetic-gear.svg` was exported headlessly with VectorCraft CLI 0.24.1. Its
editable source is `kinetic-gear.vectorcraft`; `create-mechanism.mjs` regenerates
the discovered-command recipe `kinetic-gear.commands.json`. The export has nine
editable paths/shapes on a 160 × 160 transparent artboard and no export warnings.
The website composes two copies with an SVG connecting rod and slider. This is
an interactive illustration, not a Loop Kit execution or engineering simulation.

```powershell
node site/assets/create-mechanism.mjs
& 'C:/Program Files/ArtCraft/VectorCraft/vectorcraft-cli.exe' run --commands site/assets/kinetic-gear.commands.json
```

`loop-display.ttf` is Space Grotesk, paired with DM Sans for body text. Both are
self-hosted variable fonts from Google Fonts under their adjacent SIL OFL
licenses (`Space-Grotesk-LICENSE.txt` and `DM-Sans-LICENSE.txt`). Sources:
<https://github.com/google/fonts/tree/main/ofl/spacegrotesk> and
<https://github.com/google/fonts/tree/main/ofl/dmsans>.

The earlier SolidCraft artwork below is retained as source history but is no
longer included in the publication allowlist or displayed on the landing page.

## Earlier workbench landing variant

`workbench-rings.json` is the isolated editable recipe for `workbench-rings.sc`
and `loop-workbench.png` (900 × 700, straight-alpha PNG). Generated with
SolidCraft CLI 0.45.0 using the same two-ring geometry below, with lime
`#d5ef83` and porcelain `#eeeede` appearances. The CLI measured two closed
bodies, each 30,951.0794 mm³. Reproduce from the repository root:

```powershell
solidcraft-cli run site/assets/workbench-rings.json --save site/assets/workbench-rings.sc --results
solidcraft-cli render site/assets/workbench-rings.sc --out site/assets/loop-workbench.png --width 900 --height 700 --transparent --progressive --samples 128 --timeout 90 --overwrite
```

`loop-sans.ttf` is the DM Sans variable font from Google Fonts, self-hosted under
`DM-Sans-LICENSE.txt` (SIL Open Font License). Source:
<https://github.com/google/fonts/tree/main/ofl/dmsans>. The earlier landing paired
it with platform Georgia italic; the current pairing is described above. No
external font requests are made at runtime.


Two clean, perpendicular torus links, in muted emerald (`#28745f`) and pale mint (`#b8d9c5`), framed diagonally with a neutral CAD studio finish. The rings remain separate closed bodies; no text or site integration is included.

## Deliverables

- `loop-interlocking-rings.png` — 1000 × 800 GPU snapshot, colored, no grid/axes; a restrained light background for use as the reliable preview/hero fallback.
- `loop-interlocking-rings-transparent.png` — 1000 × 800 SolidCraft progressive render with straight coverage alpha and transparent background (128 samples). Its PBR render is more subdued/noisier than the snapshot; inspect against the actual hero background before choosing it.
- [Editable recipe](interlocking-rings.json) and [native SolidCraft design](interlocking-rings.sc) are retained beside the exports. Optional generated mesh handoff: `../../target/brand-artcraft/interlocking-rings.glb`.

## Reproduction and provenance

Generated headlessly with `D:/Programs/SolidCraft/solidcraft-cli.exe`, SolidCraft CLI **0.45.0**. The recipe uses discovered `solid.torus`, `solid.move` and `appearance.assign` commands; it builds a 32 mm major-radius, 7 mm tube-radius torus at the origin and a matching torus 28 mm along Y, rotated 90° about X. The offset avoids solid overlap while making the rings link. Appearance uses modest PBR metallic/roughness values (0.18/0.28 emerald; 0.08/0.30 mint; dielectric IOR 1.46).

From the repository root, regenerate native and GLB files with:

```powershell
& 'D:/Programs/SolidCraft/solidcraft-cli.exe' run 'site/assets/interlocking-rings.json' --save 'target/brand-artcraft/interlocking-rings.sc' --out 'target/brand-artcraft/interlocking-rings.glb' --quiet
```

Snapshot (body-color overrides make this export consistent across display defaults):

```powershell
& 'D:/Programs/SolidCraft/solidcraft-cli.exe' snapshot 'target/brand-artcraft/interlocking-rings.sc' --out 'site/assets/loop-interlocking-rings.png' --width 1000 --height 800 --view iso --no-grid --no-axes --body 'Emerald ring:color=#28745f' --body 'Mint ring:color=#b8d9c5'
```

Transparent render:

```powershell
& 'D:/Programs/SolidCraft/solidcraft-cli.exe' render 'target/brand-artcraft/interlocking-rings.sc' --out 'site/assets/loop-interlocking-rings-transparent.png' --width 1000 --height 800 --transparent --progressive --samples 128 --timeout 60 --overwrite
```

## Checks and limits

`solidcraft-cli eval` reports exactly two closed bodies, each with volume **30,951.0794 mm³**, area **8,843.1655 mm²**, and center of mass at the intended ring center. Analytic torus volume `2π²Rr²` for `R=32`, `r=7` is **30,951.0794 mm³**, matching the measured value. The design timeline has two torus features and one move; appearance assignments are preserved in the reproducible recipe. PNG dimensions and renderer-reported alpha mode were checked, and the rendered images were inspected visually. No site source/build/style files were changed; no dependencies or global settings were changed.
