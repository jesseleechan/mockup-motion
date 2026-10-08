/**
 * Decides whether a pull request needs the e2e suite. The `e2e` CI job pipes the PR's changed
 * paths (one per line) into this script and runs Playwright only when it prints `run=true`.
 * Pushes to main and the nightly schedule always run the full suite and never ask.
 *
 * Usage: git diff --name-only origin/main... | node scripts/e2e-paths.ts
 *
 * Runs under plain Node (type stripping, Node 22.12+) so the CI gate needs no `npm ci`: keep it
 * free of imports from the app and of syntax Node cannot strip (enums, namespaces, aliases).
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/**
 * Paths whose changes can change what the e2e specs see. An entry ending in "/" matches the whole
 * directory; any other entry matches one file. Everything else (docs, unit tests in tests/*.test.ts,
 * tests/visual, tests/perf, the other scripts, demo-sites sources, lint and format config) skips e2e.
 */
export const E2E_TRIGGER_PATHS: readonly string[] = [
  // The whole app: engine, motion, templates, export, asset loading, editor, UI, lab, storage.
  // The specs drive every one of these through the browser, so no src/ directory is exempt.
  "src/",
  // Demo screenshots and template previews that the app and the specs load at runtime.
  "public/",
  "index.html",
  "vite.config.ts",
  "tsconfig.json",
  "tests/e2e/",
  "tests/helpers/",
  "playwright.config.ts",
  "package.json",
  "package-lock.json",
  ".github/workflows/ci.yml",
  "scripts/e2e-paths.ts",
];

/** The changed paths that trigger e2e, in input order. */
export function e2eTriggers(changedPaths: readonly string[]): string[] {
  return changedPaths.filter((path) =>
    E2E_TRIGGER_PATHS.some((trigger) =>
      trigger.endsWith("/") ? path.startsWith(trigger) : path === trigger,
    ),
  );
}

/** Parses `git diff --name-only` style output: one path per line, blank lines ignored. */
export function parseChangedPaths(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function main(): void {
  const changed = parseChangedPaths(readFileSync(0, "utf8"));
  const triggers = e2eTriggers(changed);
  console.error(`${changed.length} changed path(s), ${triggers.length} trigger e2e.`);
  for (const path of triggers) console.error(`  ${path}`);
  console.log(`run=${triggers.length > 0}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
