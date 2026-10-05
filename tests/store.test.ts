import { describe, it, expect } from "vitest";
import { createEditorStore } from "../src/state/store";
import { defaultShot, defaultStyle } from "../src/doc/defaults";
import type { AssetRef } from "../src/doc/types";

describe("WP-01: Editor Store and Undo/Redo", () => {
  it("coalescing merges rapid keystrokes with the same coalesceKey into 1 undo step", async () => {
    const store = createEditorStore();
    expect(store.getState().past.length).toBe(0);

    const chars = "HelloWorld";
    for (let i = 0; i < chars.length; i++) {
      store.getState().apply(
        (draft) => {
          draft.name = chars.slice(0, i + 1);
        },
        { coalesceKey: "project-name" },
      );
    }

    expect(store.getState().doc.name).toBe("HelloWorld");
    // All 10 updates were coalesced under 'project-name'
    expect(store.getState().past.length).toBe(1);

    // Undo restores the state prior to the typing sequence
    store.getState().undo();
    expect(store.getState().doc.name).toBe("Untitled presentation");
    expect(store.getState().past.length).toBe(0);

    // Redo restores the full typed name
    store.getState().redo();
    expect(store.getState().doc.name).toBe("HelloWorld");
  });

  it("transactions: begin and end around slider drags produce exactly 1 undo step", () => {
    const store = createEditorStore();
    expect(store.getState().past.length).toBe(0);

    store.getState().begin();

    // Drag slider through 20 tick positions
    for (let val = 1; val <= 20; val++) {
      store.getState().apply((draft) => {
        draft.style.grain = val / 20;
      });
    }

    expect(store.getState().doc.style.grain).toBe(1);
    // Still in transaction, no history pushed yet
    expect(store.getState().past.length).toBe(0);

    store.getState().end();

    // After end(), exactly 1 undo step recorded
    expect(store.getState().past.length).toBe(1);
    expect(store.getState().past[0].style.grain).toBe(0.25); // default

    store.getState().undo();
    expect(store.getState().doc.style.grain).toBe(0.25);

    store.getState().redo();
    expect(store.getState().doc.style.grain).toBe(1);
  });

  it("identical reference mutation is a no-op that does not add an undo step", () => {
    const store = createEditorStore();
    const initialPast = store.getState().past.length;

    store.getState().apply((_draft) => {
      // no modifications
    });

    expect(store.getState().past.length).toBe(initialPast);
  });

  it("new edits invalidate the redo branch", () => {
    const store = createEditorStore();

    store.getState().apply((draft) => {
      draft.name = "Version A";
    });
    store.getState().apply((draft) => {
      draft.name = "Version B";
    });

    store.getState().undo();
    expect(store.getState().doc.name).toBe("Version A");
    expect(store.getState().future.length).toBe(1);

    // New edit on branch
    store.getState().apply((draft) => {
      draft.name = "Version C";
    });

    // Redo branch must be cleared
    expect(store.getState().future.length).toBe(0);
    expect(store.getState().doc.name).toBe("Version C");
  });

  it("history retains a bounded set of at most 100 documents", () => {
    const store = createEditorStore();

    for (let i = 1; i <= 150; i++) {
      store.getState().apply((draft) => {
        draft.name = `Version ${i}`;
      });
    }

    expect(store.getState().past.length).toBe(100);
    expect(store.getState().doc.name).toBe("Version 150");
  });

  it("applyTemplateResult is 1 undo step and keeps existing assets intact", () => {
    const store = createEditorStore();
    const sampleAsset: AssetRef = {
      id: "my-photo",
      kind: "image",
      name: "Photo.png",
      mime: "image/png",
      bytes: 1234,
      role: "desktop",
    };

    store.getState().apply((draft) => {
      draft.assets.push(sampleAsset);
    });
    expect(store.getState().doc.assets.length).toBe(1);

    const newStyle = { ...defaultStyle(), shadow: "dramatic" as const };
    const newShots = [
      {
        ...defaultShot(),
        duration: 7,
      },
    ];

    store.getState().applyTemplateResult(
      {
        style: newStyle,
        shots: newShots,
        loop: false,
      },
      "new-template",
    );

    expect(store.getState().doc.style.shadow).toBe("dramatic");
    expect(store.getState().doc.shots[0].duration).toBe(7);
    expect(store.getState().doc.loop).toBe(false);
    expect(store.getState().doc.templateId).toBe("new-template");
    // Assets are preserved!
    expect(store.getState().doc.assets).toEqual([sampleAsset]);

    // Undo reverts the template application in 1 step
    store.getState().undo();
    expect(store.getState().doc.style.shadow).toBe("soft");
    expect(store.getState().doc.assets).toEqual([sampleAsset]);
  });

  it("removeAsset clears all references across layouts and text layers in 1 step", async () => {
    const store = createEditorStore();
    const assetId = "to-delete";
    const keptAssetId = "stay-here";

    store.getState().apply((draft) => {
      draft.assets = [
        { id: assetId, kind: "image", name: "Delete Me", mime: "image/png", bytes: 100 },
        { id: keptAssetId, kind: "image", name: "Keep Me", mime: "image/png", bytes: 200 },
      ];
      draft.shots = [
        {
          ...defaultShot(),
          layout: { kind: "single", device: "browser", assetId },
          texts: [
            {
              id: "t1",
              text: "Hello",
              role: "title",
              font: "display",
              size: 6,
              anchor: "center",
              align: "center",
              color: "",
              animation: "none",
              delay: 0,
              logoAssetId: assetId,
            },
          ],
        },
        {
          ...defaultShot(),
          layout: {
            kind: "pair",
            desktopId: assetId,
            mobileId: keptAssetId,
            arrangement: "overlap",
          },
          texts: [],
        },
      ];
    });

    expect(store.getState().doc.assets.length).toBe(2);

    await store.getState().removeAsset(assetId);

    const doc = store.getState().doc;
    expect(doc.assets.map((a) => a.id)).toEqual([keptAssetId]);
    // Layout reference in single layout cleared to ""
    const l0 = doc.shots[0].layout as { assetId?: string };
    expect(l0.assetId).toBe("");
    // Text logoAssetId cleared
    expect(doc.shots[0].texts[0].logoAssetId).toBeUndefined();
    // Desktop in pair layout cleared to "", mobile kept
    const l1 = doc.shots[1].layout as { desktopId?: string; mobileId?: string };
    expect(l1.desktopId).toBe("");
    expect(l1.mobileId).toBe(keptAssetId);
  });
});
