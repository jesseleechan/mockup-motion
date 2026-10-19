import { describe, expect, it } from "vitest";
import {
  PHONE_BODY_ASPECT,
  PHONE_BORDER,
  PHONE_SCREEN_ASPECT,
  PHONE_STATUS_BAR,
  phoneViewportFraction,
} from "../src/motion/phone-spec";
import { resolveLayout } from "../src/motion/layouts";
import { scrollableFramesFor } from "../src/motion/scroll";
import { statusBarTone } from "../src/engine/devices/status-bar";

// Quality bar §3.3: the phone is an iPhone Pro, 71.9 x 150 mm, with a 402 x 874 pt screen.
describe("phone spec", () => {
  it("has the iPhone Pro's body proportions around the 0.4615 screen", () => {
    expect(PHONE_BODY_ASPECT).toBeCloseTo(71.9 / 150, 2);
    // The uniform border leaves exactly the screen aspect.
    const screenW = 1 - 2 * PHONE_BORDER;
    const screenH = 1 / PHONE_BODY_ASPECT - 2 * PHONE_BORDER;
    expect(screenW / screenH).toBeCloseTo(PHONE_SCREEN_ASPECT, 6);
  });

  it("sizes a single phone at 70-78% of the frame height with the iPhone body aspect", () => {
    const [node] = resolveLayout(
      { kind: "single", device: "phone", assetId: "" },
      "16:9",
      [],
      0,
      5,
    );
    expect(node.height).toBeGreaterThanOrEqual(0.7);
    expect(node.height).toBeLessThanOrEqual(0.78);
    expect(node.width / node.height).toBeCloseTo(PHONE_BODY_ASPECT, 6);
  });

  it("reserves the top 62 pt of the 874 pt screen for the status bar", () => {
    expect(PHONE_STATUS_BAR).toBeCloseTo(0.0709, 4);
    expect(phoneViewportFraction(false)).toBeCloseTo(1 - 62 / 874, 6);
    expect(phoneViewportFraction(undefined)).toBe(phoneViewportFraction(false));
    expect(phoneViewportFraction(true)).toBe(1);
  });
});

describe("scrollableFramesFor", () => {
  const page = { width: 780, height: 11436 };

  it("measures a phone page against the screen below the status bar", () => {
    const full = PHONE_SCREEN_ASPECT / (780 / 11436);
    expect(scrollableFramesFor("phone", PHONE_SCREEN_ASPECT, page)).toBeCloseTo(
      full / (1 - PHONE_STATUS_BAR) - 1,
      6,
    );
  });

  it("uses the whole screen when the screenshot has its own status bar, and on other devices", () => {
    const full = PHONE_SCREEN_ASPECT / (780 / 11436) - 1;
    const withBar = { ...page, meta: { hasStatusBar: true } };
    expect(scrollableFramesFor("phone", PHONE_SCREEN_ASPECT, withBar)).toBeCloseTo(full, 6);
    expect(scrollableFramesFor("card", PHONE_SCREEN_ASPECT, page)).toBeCloseTo(full, 6);
  });

  it("is 0 without image dimensions or for a page shorter than the screen", () => {
    expect(scrollableFramesFor("phone", PHONE_SCREEN_ASPECT, undefined)).toBe(0);
    expect(scrollableFramesFor("phone", PHONE_SCREEN_ASPECT, { width: 780 })).toBe(0);
    expect(scrollableFramesFor("browser", 1.6, { width: 1600, height: 800 })).toBe(0);
  });
});

describe("statusBarTone", () => {
  it("uses dark glyphs on light pages and light glyphs on dark ones, like iOS", () => {
    expect(statusBarTone([1, 1, 1])).toBe("dark");
    expect(statusBarTone([0.93, 0.95, 0.96])).toBe("dark");
    expect(statusBarTone([0.07, 0.07, 0.07])).toBe("light");
    expect(statusBarTone([0.5, 0.5, 0.5])).toBe("light");
    expect(statusBarTone([0.2, 0.3, 0.9])).toBe("light");
  });
});
