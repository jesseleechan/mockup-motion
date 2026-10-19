import { parseArgs, USAGE } from "./args.mjs";
import { BrowserNotFoundError } from "./browser.mjs";
import { captureUrl } from "./capture.mjs";

/**
 * Runs the command line and returns the exit code.
 *
 * @param {string[]} args the arguments after `node` and the script path
 * @returns {Promise<number>}
 */
export async function main(args) {
  const parsed = parseArgs(args);
  if (parsed.help) {
    console.log(USAGE);
    return parsed.exitCode;
  }

  const { options } = parsed;
  console.log(`[Capture] Launching capture for: ${options.url}`);
  try {
    const result = await captureUrl(options);
    console.log(`[Capture] Complete!`);
    console.log("Desktop output:", result.desktopFiles);
    console.log("Mobile output:", result.mobileFiles);
    return 0;
  } catch (err) {
    // A missing browser is a setup step, not a crash: say what to run, without a stack trace.
    if (err instanceof BrowserNotFoundError) {
      console.error(err.message);
    } else {
      console.error("[Capture Error]", err);
    }
    return 1;
  }
}
