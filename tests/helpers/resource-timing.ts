import type { Page } from "@playwright/test";

// Chromium keeps 250 resource-timing entries by default. Under the Vite dev server every module
// is its own request, and the editor already makes about 245 before its export dialog loads
// Mediabunny, so with a few more modules Mediabunny's entry is dropped.
const RESOURCE_TIMING_BUFFER = 5000;

/**
 * Raises the page's resource-timing buffer before any script runs, so specs that find the app's
 * optimized Mediabunny module in `performance.getEntriesByType("resource")` still see its entry
 * however many modules the app loads first.
 */
export async function keepResourceTimings(page: Page): Promise<void> {
  await page.addInitScript((size) => {
    performance.setResourceTimingBufferSize(size);
  }, RESOURCE_TIMING_BUFFER);
}
