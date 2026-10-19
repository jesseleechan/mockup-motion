import { describe, expect, it } from "vitest";
import {
  captureBaseNames,
  hostSlug,
  isMissingBrowserError,
  parseArgs,
} from "../packages/capture/src/index.mjs";

describe("capture CLI", () => {
  it("names files after the host, port and path, as the editor expects", () => {
    const host = hostSlug("http://localhost:8765/aurelia/");
    expect(host).toBe("localhost_8765__aurelia_");
    expect(hostSlug("https://www.example.com/")).toBe("www.example.com");
    expect(hostSlug("not a url")).toBe("capture");
    expect(captureBaseNames(host, 1440, 390)).toEqual({
      desktop: "localhost_8765__aurelia_-desktop-1440",
      mobile: "localhost_8765__aurelia_-mobile-390@2x",
    });
  });

  it("reads the URL and every option", () => {
    const parsed = parseArgs([
      "https://example.com",
      "--out",
      "shots",
      "--desktop",
      "1280",
      "--mobile",
      "375",
      "--scale",
      "3",
      "--mode",
      "full",
      "--hide",
      ".cookie, #chat",
      "--wait",
      "500",
      "--unstick",
    ]);
    expect(parsed).toEqual({
      help: false,
      options: {
        url: "https://example.com",
        outDir: "shots",
        desktopWidth: 1280,
        mobileWidth: 375,
        scale: 3,
        mode: "full",
        hide: ".cookie, #chat",
        waitMs: 500,
        unstick: true,
      },
    });
  });

  it("shows help, failing only when no URL is given", () => {
    expect(parseArgs([])).toEqual({ help: true, exitCode: 1 });
    expect(parseArgs(["--help"])).toEqual({ help: true, exitCode: 0 });
    expect(parseArgs(["https://example.com", "-h"])).toEqual({ help: true, exitCode: 0 });
  });

  it("tells a missing browser apart from other launch errors", () => {
    expect(
      isMissingBrowserError(
        new Error("browserType.launch: Executable doesn't exist at /ms-playwright/chromium-1243"),
      ),
    ).toBe(true);
    expect(
      isMissingBrowserError(
        new Error("browserType.launch: Chromium distribution 'msedge' is not found at /opt/x"),
      ),
    ).toBe(true);
    expect(
      isMissingBrowserError(new Error("Target page, context or browser has been closed")),
    ).toBe(false);
  });
});
