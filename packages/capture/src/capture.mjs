import fs from "node:fs";
import path from "node:path";
import { launchBrowser } from "./browser.mjs";
import { captureBaseNames, hostSlug } from "./naming.mjs";
import { preparePage, recordSectionBoundaries } from "./page.mjs";

/**
 * Captures one viewport of the page: its section data as JSON, then the screenshots `mode` asks
 * for. Returns the files written, in that order.
 *
 * @param {import("playwright").Browser} browser
 * @param {import("./index.mjs").CaptureOptions} options
 * @param {{ base: string, width: number, height: number, scale: number, mode: "full" | "viewport" | "both", mobile: boolean }} view
 * @returns {Promise<{ files: string[], meta: import("./index.mjs").CaptureMetadata }>}
 */
async function captureView(browser, options, view) {
  const outDir = options.outDir || "captures";
  const context = await browser.newContext({
    viewport: { width: view.width, height: view.height },
    deviceScaleFactor: view.scale,
    reducedMotion: "reduce",
    ...(view.mobile ? { isMobile: true, hasTouch: true } : {}),
  });
  const page = await context.newPage();
  await page.goto(options.url, { waitUntil: "networkidle", timeout: 30000 });
  await preparePage(page, {
    hide: options.hide,
    unstick: options.unstick,
    waitMs: options.waitMs,
  });

  const files = [];
  const meta = await recordSectionBoundaries(page, view.width, view.scale);
  const jsonFile = path.join(outDir, `${view.base}.json`);
  fs.writeFileSync(jsonFile, JSON.stringify(meta, null, 2), "utf-8");
  files.push(jsonFile);

  if (view.mode === "viewport" || view.mode === "both") {
    const vpFile = path.join(outDir, `${view.base}.png`);
    await page.screenshot({ path: vpFile, fullPage: false });
    files.push(vpFile);
  }
  if (view.mode === "full" || view.mode === "both") {
    const fullFile = path.join(outDir, `${view.base}-full.png`);
    await page.screenshot({ path: fullFile, fullPage: true });
    files.push(fullFile);
  }
  await context.close();
  return { files, meta };
}

/**
 * Captures the desktop and then the mobile view of `options.url` into `options.outDir`.
 *
 * @param {import("./index.mjs").CaptureOptions} options
 * @returns {Promise<{ desktopFiles: string[], mobileFiles: string[], metadata: Record<string, import("./index.mjs").CaptureMetadata> }>}
 */
export async function captureUrl(options) {
  const outDir = options.outDir || "captures";
  fs.mkdirSync(outDir, { recursive: true });

  const desktopWidth = options.desktopWidth ?? 1440;
  const mobileWidth = options.mobileWidth ?? 390;
  const scale = options.scale ?? 2;
  const mode = options.mode ?? "both";
  const names = captureBaseNames(hostSlug(options.url), desktopWidth, mobileWidth);

  const browser = await launchBrowser();
  /** @type {Record<string, import("./index.mjs").CaptureMetadata>} */
  const metadata = {};

  try {
    const desktop = await captureView(browser, options, {
      base: names.desktop,
      width: desktopWidth,
      height: 900,
      scale,
      mode,
      mobile: false,
    });
    metadata["desktop"] = desktop.meta;

    const mobile = await captureView(browser, options, {
      base: names.mobile,
      width: mobileWidth,
      height: 844,
      scale,
      mode,
      mobile: true,
    });
    metadata["mobile"] = mobile.meta;

    return { desktopFiles: desktop.files, mobileFiles: mobile.files, metadata };
  } finally {
    await browser.close();
  }
}
