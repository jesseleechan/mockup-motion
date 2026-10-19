import fs from "node:fs";
import { createRequire } from "node:module";
import { chromium } from "playwright";

// Each Playwright version expects its own Chromium build, so the install command names the
// version this package runs. A bare `npx playwright` could fetch a newer one.
const PLAYWRIGHT_VERSION = createRequire(import.meta.url)("playwright/package.json").version;

export const MISSING_BROWSER_MESSAGE = `No browser found. Install Playwright's Chromium, then run the capture again:\n\n  npx playwright@${PLAYWRIGHT_VERSION} install chromium\n`;

/** Thrown by `launchBrowser` when neither Playwright's Chromium, Chrome nor Edge is installed. */
export class BrowserNotFoundError extends Error {
  constructor() {
    super(MISSING_BROWSER_MESSAGE);
    this.name = "BrowserNotFoundError";
  }
}

/**
 * Playwright's launch errors for a browser that isn't installed: its own Chromium ("Executable
 * doesn't exist at …") or a channel ("Chromium distribution 'chrome' is not found at …").
 *
 * @param {unknown} err
 * @returns {boolean}
 */
export function isMissingBrowserError(err) {
  const message = err instanceof Error ? err.message : String(err);
  return /Executable doesn't exist|distribution '[^']+' is not found/i.test(message);
}

/**
 * Prefers installed Chrome on Windows, else Playwright's Chromium.
 *
 * @returns {{ headless: boolean, channel: string | undefined }}
 */
export function getBrowserLaunchOptions() {
  const isWinChrome = fs.existsSync("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe");
  return {
    headless: true,
    channel: isWinChrome ? "chrome" : undefined,
  };
}

/**
 * Launches a headless browser for the capture. `PW_CHROMIUM_EXECUTABLE` names a Chromium binary
 * to use as is. Otherwise it tries `getBrowserLaunchOptions()`, then the system Chrome, then
 * Edge, and throws `BrowserNotFoundError` when none of them is installed. Any other launch error
 * is rethrown unchanged.
 *
 * @returns {Promise<import("playwright").Browser>}
 */
export async function launchBrowser() {
  const executablePath = process.env.PW_CHROMIUM_EXECUTABLE;
  if (executablePath) return await chromium.launch({ headless: true, executablePath });

  const preferred = getBrowserLaunchOptions();
  // `undefined` is Playwright's own Chromium.
  const channels = [preferred.channel, undefined, "chrome", "msedge"].filter(
    (channel, i, all) => all.indexOf(channel) === i,
  );
  for (const channel of channels) {
    try {
      return await chromium.launch({ headless: true, channel });
    } catch (err) {
      if (!isMissingBrowserError(err)) throw err;
    }
  }
  throw new BrowserNotFoundError();
}
