import { execFileSync } from "child_process";
import { watch as fsWatch } from "fs";
import { basename, resolve } from "path";
import { CLAUDE_DIR } from "./constants.mjs";

export function startWatch(outputPath, scanRoots, cliArgs) {
  if (!cliArgs.quiet) console.log("Watching for changes...");
  let debounce = null;
  let regenerating = false;
  const watchDirs = [CLAUDE_DIR, ...scanRoots.slice(0, 5)];

  // Forward original flags minus --watch and --diff to avoid nested watchers
  // and noisy snapshot writes on every file change
  const forwardedArgs = process.argv
    .slice(2)
    .filter((a) => a !== "--watch" && a !== "--diff")
    .concat(["--quiet"]);

  // Resolve output path to detect and ignore self-writes
  const resolvedOutput = resolve(outputPath);

  function regenerate(_eventType, filename) {
    // Ignore changes to our own output file and cache files to prevent infinite loops
    if (
      filename &&
      (filename === basename(resolvedOutput) ||
        filename === "dashboard-snapshot.json" ||
        filename === "ccusage-cache.json")
    )
      return;
    if (regenerating) return;
    if (debounce) globalThis.clearTimeout(debounce);
    debounce = globalThis.setTimeout(() => {
      regenerating = true;
      if (!cliArgs.quiet) console.log("Change detected, regenerating...");
      try {
        execFileSync(process.execPath, [process.argv[1], ...forwardedArgs], {
          stdio: "inherit",
        });
        if (!cliArgs.quiet) console.log(outputPath);
      } catch (e) {
        console.error("Regeneration failed:", e.message);
      }
      regenerating = false;
    }, 500);
  }
  for (const dir of watchDirs) {
    try {
      fsWatch(dir, { recursive: true }, regenerate);
    } catch {
      /* unreadable */
    }
  }
}
