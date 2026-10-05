import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { expect, test } from "@playwright/test";

/**
 * Performance budgets from WP-18. Misses are warnings (annotations), not failures.
 * Numbers are also written to test-results/perf-budget.json for the PR notes.
 */

interface BudgetReport {
  previewFps?: number;
  exportSeconds?: number;
  startupMs?: number;
  entryGzipKb?: number;
  notes: string[];
}

function gzipSize(file: string): number {
  return gzipSync(fs.readFileSync(file)).length;
}

test.describe("WP-18 performance budgets", () => {
  test("preview, export, startup, and entry bundle", async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    const report: BudgetReport = { notes: [] };

    const started = Date.now();
    await page.goto("/");
    await page.getByRole("button", { name: "Try with demo content" }).click();
    await expect(page.locator("canvas").first()).toBeVisible();
    report.startupMs = Date.now() - started;
    if (report.startupMs > 1500) {
      report.notes.push(
        `Startup to canvas was ${report.startupMs}ms (budget 1500ms). This is a warm dev server, not a cold Lighthouse load.`,
      );
    }

    const fps = await page.evaluate(async () => {
      const canvas = document.querySelector("canvas") as HTMLCanvasElement | null;
      if (!canvas) return 0;
      const start = performance.now();
      let frames = 0;
      await new Promise<void>((resolve) => {
        function tick(now: number) {
          frames += 1;
          if (now - start >= 1000) resolve();
          else requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      });
      return frames;
    });
    report.previewFps = fps;
    if (fps < 55) {
      report.notes.push(`Preview loop measured ${fps} fps (budget ≥ 55 for a single shot).`);
    }

    await page.getByRole("button", { name: "Export", exact: true }).click();
    const dialog = page.getByRole("dialog");
    const exportStart = Date.now();
    await dialog.getByRole("button", { name: "Start export" }).click();
    await expect(dialog.getByRole("link", { name: /Download/ })).toBeVisible({ timeout: 60_000 });
    report.exportSeconds = (Date.now() - exportStart) / 1000;
    if (report.exportSeconds > 12) {
      report.notes.push(
        `1080p export took ${report.exportSeconds.toFixed(1)}s (budget ≤ 12s on an M1-class machine).`,
      );
    }

    const dist = path.resolve(process.cwd(), "dist/assets");
    if (fs.existsSync(dist)) {
      const entries = fs
        .readdirSync(dist)
        .filter((f) => f.startsWith("index-") && f.endsWith(".js"));
      if (entries[0]) {
        report.entryGzipKb = Math.round(gzipSize(path.join(dist, entries[0])) / 1024);
        if (report.entryGzipKb > 250) {
          report.notes.push(`Entry JS is ${report.entryGzipKb} KB gzip (budget ≤ 250 KB).`);
        }
      }
    } else {
      report.notes.push("dist/ not present; entry size was not measured in this run.");
    }

    const outDir = path.resolve(process.cwd(), "test-results");
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "perf-budget.json"), JSON.stringify(report, null, 2));

    for (const note of report.notes) {
      testInfo.annotations.push({ type: "budget", description: note });
    }
    expect(report.previewFps).toBeGreaterThan(0);
  });
});
