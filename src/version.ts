import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Server version, read from the package manifest so it never drifts. */
export const VERSION: string = (() => {
  try {
    const pkg = JSON.parse(
      readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8"),
    ) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
})();
