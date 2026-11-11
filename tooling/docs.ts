/** Build public packages, then project imported repository Markdown into the static Pages site. */
import { run } from "./packages";
await run(["bun", "run", "build"]);
await import("../site/build");
