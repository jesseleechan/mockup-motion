import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { E2E_SHARDS, shardSpecPaths } from "../scripts/e2e-shards";

const ROOT = path.resolve(__dirname, "..");
const SPECS = fs
  .readdirSync(path.join(ROOT, "tests/e2e"))
  .filter((name) => name.endsWith(".spec.ts"))
  .map((name) => `tests/e2e/${name}`);
const ALL_FILTERS = E2E_SHARDS.flatMap((_, i) => shardSpecPaths(i + 1));

describe("e2e shards", () => {
  it("puts every e2e spec in exactly one shard", () => {
    expect(SPECS.length).toBeGreaterThan(20);
    expect([...ALL_FILTERS].sort()).toEqual([...SPECS].sort());
  });

  // Playwright treats each file argument as a case-insensitive regular expression on the path,
  // so "ui.spec.ts" must not also select "ui-overflow.spec.ts".
  it("gives Playwright filters that each select only their own spec", () => {
    for (const filter of ALL_FILTERS) {
      const re = new RegExp(filter, "i");
      expect(SPECS.filter((spec) => re.test(`/home/runner/work/repo/${spec}`))).toEqual([filter]);
    }
  });

  it("has one CI matrix entry per shard", () => {
    const workflow = fs.readFileSync(path.join(ROOT, ".github/workflows/ci.yml"), "utf8");
    const shards = E2E_SHARDS.map((_, i) => i + 1).join(", ");
    expect(workflow).toContain(`shard: [${shards}]`);
    expect(workflow).toContain(`name: e2e shard \${{ matrix.shard }}/${E2E_SHARDS.length}`);
  });

  it("rejects an unknown shard", () => {
    expect(() => shardSpecPaths(0)).toThrow(/Unknown e2e shard/);
    expect(() => shardSpecPaths(E2E_SHARDS.length + 1)).toThrow(/Unknown e2e shard/);
    expect(() => shardSpecPaths(Number.NaN)).toThrow(/Unknown e2e shard/);
  });

  it("prints a shard's specs from the command line and fails on a bad shard", () => {
    const run = (arg: string) =>
      spawnSync(
        process.execPath,
        ["--experimental-strip-types", "--no-warnings", "scripts/e2e-shards.ts", arg],
        { cwd: ROOT, encoding: "utf8" },
      );
    const last = run(String(E2E_SHARDS.length));
    expect(last.status).toBe(0);
    expect(last.stdout.trim()).toBe(shardSpecPaths(E2E_SHARDS.length).join(" "));
    expect(run("9").status).not.toBe(0);
  });
});
