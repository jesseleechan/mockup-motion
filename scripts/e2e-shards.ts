/**
 * Splits the e2e specs across the CI shards by file. Playwright's own `--shard` cuts the
 * alphabetical test list into contiguous slices, which put every slow export and editor spec on
 * one shard (23 min, while another took 4). These groups are balanced on the per-file durations
 * of CI run 37717786655 (43 min in total): export.spec alone is about 12.5 min, and each other
 * group about 10 min.
 *
 * Every spec in tests/e2e must be in exactly one group; tests/e2e-shards.test.ts fails otherwise.
 * When you add a spec, put it in the group with the least time. The `e2e-shard` matrix in
 * .github/workflows/ci.yml has one entry per group.
 *
 * Usage: node scripts/e2e-shards.ts <shard number, 1-based>
 * Prints that shard's spec paths, separated by spaces, for `playwright test`.
 *
 * Runs under plain Node (type stripping), like scripts/e2e-paths.ts.
 */
import { pathToFileURL } from "node:url";

export const E2E_SHARDS: readonly (readonly string[])[] = [
  [
    "assets",
    "orientation",
    "art-direction",
    "layouts",
    "timeline",
    "wave5",
    "first-run",
    "backgrounds",
    "spike",
  ],
  ["editor", "color", "ui-overflow", "polish", "text", "demo-assets", "library", "shadows-post"],
  [
    "audio",
    "export-dialog",
    "entrance",
    "thumbnails",
    "stage",
    "lab",
    "devices",
    "ui",
    "preset-tone",
  ],
  ["export", "frames", "slider", "mobile-frames"],
];

/** The spec paths of a 1-based shard, as Playwright file filters. */
export function shardSpecPaths(shard: number): string[] {
  const group = E2E_SHARDS[shard - 1];
  if (!Number.isInteger(shard) || !group) {
    throw new Error(`Unknown e2e shard "${shard}". Expected 1 to ${E2E_SHARDS.length}.`);
  }
  return group.map((name) => `tests/e2e/${name}.spec.ts`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(shardSpecPaths(Number(process.argv[2])).join(" "));
}
