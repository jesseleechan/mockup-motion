import { describe, expect, it } from "vitest";
import { TILE_ASPECT, tileFit } from "../src/editor/library/tile-fit";

describe("a screenshot fills its Library tile without a side crop", () => {
  it("a capture no wider than the tile covers it from the top", () => {
    // A 16:10 viewport fills the tile exactly; a full page is cut only at the bottom.
    expect(tileFit({ width: 2880, height: 1800, role: "desktop" }, TILE_ASPECT)).toBe("cover");
    expect(
      tileFit({ width: 1440, height: 4341, role: "desktop", meta: { tall: true } }, TILE_ASPECT),
    ).toBe("cover");
    expect(tileFit({ width: 1024, height: 768 }, TILE_ASPECT)).toBe("cover");
  });

  it("a capture wider than the tile shows whole, never cropped at the sides", () => {
    expect(tileFit({ width: 1920, height: 1080, role: "desktop" }, TILE_ASPECT)).toBe("contain");
    expect(tileFit({ width: 3000, height: 1000 }, TILE_ASPECT)).toBe("contain");
  });

  it("a phone screen shows whole, while a full mobile page covers", () => {
    expect(tileFit({ width: 780, height: 1688, role: "mobile" }, TILE_ASPECT)).toBe("contain");
    expect(
      tileFit({ width: 780, height: 6000, role: "mobile", meta: { tall: true } }, TILE_ASPECT),
    ).toBe("cover");
    // Without its role, as in the inspector's small thumbnails, a phone screen covers.
    expect(tileFit({ width: 780, height: 1688 }, TILE_ASPECT)).toBe("cover");
  });

  it("a screenshot of unknown size covers", () => {
    expect(tileFit({}, TILE_ASPECT)).toBe("cover");
  });
});
