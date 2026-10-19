export const USAGE = `
Usage: npm run capture -- <url> [options]

Options:
  --out <dir>           Output directory (default: captures/)
  --desktop <width>     Desktop viewport width (default: 1440)
  --mobile <width>      Mobile viewport width (default: 390)
  --scale <factor>      Device scale factor (default: 2)
  --mode <mode>         Capture mode: full | viewport | both (default: both)
  --hide "<selectors>"  CSS selectors to hide
  --wait <ms>           Milliseconds to wait after ready
  --unstick             Convert position:fixed/sticky to static after first viewport
  --help, -h            Show this help

Browser: uses Playwright's Chromium, else Chrome, else Edge. Set PW_CHROMIUM_EXECUTABLE
to use a specific Chromium binary.
`;

/**
 * Reads the command line (without `node` and the script path). The first argument is the URL;
 * unknown flags are ignored.
 *
 * @param {string[]} args
 * @returns {{ help: true, exitCode: number } | { help: false, options: import("./index.mjs").CaptureOptions }}
 */
export function parseArgs(args) {
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    return { help: true, exitCode: args.length === 0 ? 1 : 0 };
  }

  /** @type {import("./index.mjs").CaptureOptions} */
  const options = { url: args[0] };

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--out" && i + 1 < args.length) {
      options.outDir = args[++i];
    } else if (arg === "--desktop" && i + 1 < args.length) {
      options.desktopWidth = parseInt(args[++i], 10);
    } else if (arg === "--mobile" && i + 1 < args.length) {
      options.mobileWidth = parseInt(args[++i], 10);
    } else if (arg === "--scale" && i + 1 < args.length) {
      options.scale = parseFloat(args[++i]);
    } else if (arg === "--mode" && i + 1 < args.length) {
      options.mode = /** @type {"full" | "viewport" | "both"} */ (args[++i]);
    } else if (arg === "--hide" && i + 1 < args.length) {
      options.hide = args[++i];
    } else if (arg === "--wait" && i + 1 < args.length) {
      options.waitMs = parseInt(args[++i], 10);
    } else if (arg === "--unstick") {
      options.unstick = true;
    }
  }

  return { help: false, options };
}
