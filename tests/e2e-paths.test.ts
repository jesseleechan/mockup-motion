import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { E2E_TRIGGER_PATHS, e2eTriggers, parseChangedPaths } from "../scripts/e2e-paths";

const ROOT = path.resolve(__dirname, "..");
const E2E_DIR = path.join(ROOT, "tests/e2e");

function runCli(input: string): { stdout: string; status: number | null } {
  const result = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--no-warnings", "scripts/e2e-paths.ts"],
    { cwd: ROOT, input, encoding: "utf8" },
  );
  return { stdout: result.stdout.trim(), status: result.status };
}

describe("e2e path filter", () => {
  it("skips e2e for docs, unit tests, visual and perf specs, and other scripts", () => {
    const changed = [
      "README.md",
      "CLAUDE.md",
      "AGENTS.md",
      "docs/plan/follow-ups.md",
      "docs/fix-plan/evidence/F11/screens-1x-vs-2x.png",
      "tests/motion.test.ts",
      "tests/fixtures/v1-presets.ts",
      "tests/visual/stills.spec.ts",
      "tests/perf/export-speed.spec.ts",
      "scripts/contact-sheet.ts",
      "demo-sites/aurelia/index.html",
      "eslint.config.js",
      ".github/workflows/visual-baselines.yml",
    ];
    expect(e2eTriggers(changed)).toEqual([]);
  });

  it("runs e2e for the render path, the UI, the specs and their tooling", () => {
    const changed = [
      "src/engine/Engine.ts",
      "src/motion/evaluate.ts",
      "src/templates/index.ts",
      "src/export/engine-export.ts",
      "src/assets/fonts.ts",
      "src/editor/EditorShell.tsx",
      "src/ui/Button.tsx",
      "public/demo/aurelia.png",
      "index.html",
      "vite.config.ts",
      "tsconfig.json",
      "tests/e2e/first-run.spec.ts",
      "tests/helpers/pixels.ts",
      "playwright.config.ts",
      "package.json",
      "package-lock.json",
      ".github/workflows/ci.yml",
      "scripts/e2e-paths.ts",
      "scripts/e2e-shards.ts",
    ];
    expect(e2eTriggers(changed)).toEqual(changed);
  });

  it("matches whole path segments, not prefixes of other names", () => {
    expect(e2eTriggers(["srcs/notes.md", "tests/e2e-paths.test.ts", "package.json.bak"])).toEqual(
      [],
    );
  });

  it("covers every source file outside tests/e2e that an e2e spec imports", () => {
    const imported = new Set<string>();
    for (const file of fs.readdirSync(E2E_DIR).filter((name) => name.endsWith(".ts"))) {
      const source = fs.readFileSync(path.join(E2E_DIR, file), "utf8");
      for (const match of source.matchAll(/from "(\.\.?\/[^"]+)"/g)) {
        const resolved = path.relative(ROOT, path.resolve(E2E_DIR, match[1]));
        imported.add(resolved.split(path.sep).join("/"));
      }
    }
    // Guards the test itself: the specs do import from src/ and tests/helpers/.
    expect([...imported].some((p) => p.startsWith("src/"))).toBe(true);
    expect([...imported].some((p) => p.startsWith("tests/helpers/"))).toBe(true);
    const missing = [...imported].filter((p) => e2eTriggers([p]).length === 0);
    expect(missing).toEqual([]);
  });

  it("lists only paths that exist", () => {
    const missing = E2E_TRIGGER_PATHS.filter((p) => !fs.existsSync(path.join(ROOT, p)));
    expect(missing).toEqual([]);
  });

  it("parses git diff output with blank lines and CRLF", () => {
    expect(parseChangedPaths("docs/a.md\r\n\r\nsrc/b.ts\n")).toEqual(["docs/a.md", "src/b.ts"]);
  });

  it("prints run=false for a docs-only change and run=true for a render change", () => {
    expect(runCli("docs/plan/follow-ups.md\nCLAUDE.md\n")).toEqual({
      stdout: "run=false",
      status: 0,
    });
    expect(runCli("docs/plan/follow-ups.md\nsrc/engine/Engine.ts\n")).toEqual({
      stdout: "run=true",
      status: 0,
    });
  });
});
