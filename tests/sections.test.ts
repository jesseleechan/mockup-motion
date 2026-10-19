import { describe, it, expect } from "vitest";
import { minDurationFor } from "../src/motion/scroll";
import { BUILTIN_TEMPLATES, buildTemplate } from "../src/templates";
import { createEditorStore } from "../src/state/store";

describe("WP-15: Scroll Story timing and opt-in", () => {
  it("minDurationFor respects the scroll speed limit and holds", () => {
    const stops = [0, 0.35, 0.7, 1.0];
    const spec = {
      enabled: true,
      stops,
      hold: 0.8,
      easing: "smooth" as const,
    };

    const scrollableFrames = 3.5; // ~3.5 viewports of content
    const minDur = minDurationFor(spec, scrollableFrames);

    // Must require positive duration respecting 0.9 vh/s limit + holds
    expect(minDur).toBeGreaterThan(4 * 0.8);
    expect(minDur).toBeGreaterThan(6.0);
  });

  it("turning scroll on never happens automatically during asset import or template application", async () => {
    const store = createEditorStore();

    // Default project has scroll disabled
    for (const shot of store.getState().doc.shots) {
      expect(shot.scroll?.enabled).toBeFalsy();
    }

    // Adding tall screenshots does not turn on scroll automatically
    await store.getState().addAssets([
      {
        id: "tall-asset",
        name: "Tall Screenshot",
        kind: "image",
        mime: "image/webp",
        bytes: 100000,
        role: "desktop",
        width: 1440,
        height: 5000,
        meta: { tall: true },
      },
    ]);

    for (const shot of store.getState().doc.shots) {
      expect(shot.scroll?.enabled).toBeFalsy();
    }

    // Applying standard templates (other than explicit scroll-story) does not enable scroll
    for (const template of BUILTIN_TEMPLATES) {
      if (template.id === "scroll-story") continue;
      const built = buildTemplate(template, {
        aspect: "16:9",
        assets: store.getState().doc.assets,
        name: "Test",
      });
      for (const shot of built.shots) {
        expect(shot.scroll?.enabled).toBeFalsy();
      }
    }
  });
});
