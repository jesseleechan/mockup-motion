/**
 * The capture lives in the `mockup-motion-capture` package (packages/capture). `npm run capture`
 * runs it, and this module re-exports it for the repo's scripts and tests. The package isn't on
 * npm yet; its README has the publish steps.
 */
export {
  captureBaseNames,
  captureUrl,
  getBrowserLaunchOptions,
  hostSlug,
  launchBrowser,
  parseArgs,
  preparePage,
  recordSectionBoundaries,
} from "../packages/capture/src/index.mjs";
export type {
  CaptureMetadata,
  CaptureOptions,
  CaptureResult,
  SectionBoundary,
} from "../packages/capture/src/index.mjs";
