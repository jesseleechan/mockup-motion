/**
 * The capture lives in the `mockup-motion-capture` package (packages/capture), which anyone can
 * run with `npx mockup-motion-capture <url>`. `npm run capture` runs the same package, and this
 * module re-exports it for the repo's scripts and tests.
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
