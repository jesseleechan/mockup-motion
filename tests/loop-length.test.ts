import { describe, expect, it } from "vitest";
import { defaultShot } from "../src/doc/defaults";
import type { Aspect, AssetRef, Layout } from "../src/doc/types";
import { LOOP_LENGTHS, loopLengthChips } from "../src/editor/loop-length";
import { createEditorStore } from "../src/state/store";
import { framesLayout, mobileFramesLayout } from "../src/templates";

// docs/phone-frames-plan/README.md §8, suggestion 4: loop length chips for both Frames presets.

type FramesLayout = Extract<Layout, { kind: "rows" | "columns" }>;

const ids = (count: number) => Array.from({ length: count }, (_, i) => `a${i}`);

const PRESETS: Record<"desktop" | "mobile", (aspect: Aspect, assetIds: string[]) => FramesLayout> =
  {
    desktop: framesLayout,
    mobile: mobileFramesLayout,
  };

interface ChipCase {
  preset: keyof typeof PRESETS;
  aspect: Aspect;
  count: number;
  /** The chips under framesDuration, with the reason each one shows. */
  disabled: Record<number, string>;
}

// framesDuration for each case, written out so a change to the speed limit or the card sizes
// fails here: the shortest loop is the asset period at 0.20 stage units per second, rounded up
// to 0.5 s, and only the screenshots that fit 30 s count (8 desktop cards at 16:9, 9 phones).
const CASES: ChipCase[] = [
  { preset: "desktop", aspect: "16:9", count: 4, disabled: {} }, // 15 s
  {
    preset: "desktop",
    aspect: "16:9",
    count: 6, // 22.5 s
    disabled: {
      15: "6 screenshots need at least 22.5 s",
      20: "6 screenshots need at least 22.5 s",
    },
  },
  {
    preset: "desktop",
    aspect: "16:9",
    count: 10, // 29.5 s for the first 8
    disabled: {
      15: "8 screenshots need at least 29.5 s",
      20: "8 screenshots need at least 29.5 s",
    },
  },
  { preset: "desktop", aspect: "9:16", count: 4, disabled: {} }, // 12 s
  {
    preset: "desktop",
    aspect: "9:16",
    count: 6, // 17.5 s
    disabled: { 15: "6 screenshots need at least 17.5 s" },
  },
  {
    preset: "desktop",
    aspect: "9:16",
    count: 10, // 29 s
    disabled: {
      15: "10 screenshots need at least 29 s",
      20: "10 screenshots need at least 29 s",
    },
  },
  { preset: "mobile", aspect: "16:9", count: 4, disabled: {} }, // 13 s
  {
    preset: "mobile",
    aspect: "16:9",
    count: 6, // 19.5 s
    disabled: { 15: "6 screenshots need at least 19.5 s" },
  },
  {
    preset: "mobile",
    aspect: "16:9",
    count: 10, // 29.5 s for the first 9
    disabled: {
      15: "9 screenshots need at least 29.5 s",
      20: "9 screenshots need at least 29.5 s",
    },
  },
  { preset: "mobile", aspect: "9:16", count: 4, disabled: {} }, // 11 s
  {
    preset: "mobile",
    aspect: "9:16",
    count: 6, // 16.5 s
    disabled: { 15: "6 screenshots need at least 16.5 s" },
  },
  {
    preset: "mobile",
    aspect: "9:16",
    count: 10, // 27.5 s
    disabled: {
      15: "10 screenshots need at least 27.5 s",
      20: "10 screenshots need at least 27.5 s",
    },
  },
];

/** A store holding one Frames shot at `aspect`, with an empty undo history. */
function framesStore(layout: FramesLayout, aspect: Aspect, duration: number) {
  const store = createEditorStore();
  // The doc sanitizer drops screenshot ids that aren't in the library.
  const assets: AssetRef[] = layout.assetIds.map((id) => ({
    id,
    kind: "image",
    name: id,
    mime: "image/png",
    bytes: 100,
    width: 1440,
    height: 900,
  }));
  store.getState().loadDoc({
    ...store.getState().doc,
    aspect,
    assets,
    shots: [{ ...defaultShot(layout), duration }],
  });
  const shot = store.getState().doc.shots[0];
  if (shot.layout.kind !== layout.kind || !("assetIds" in shot.layout)) {
    throw new Error("the Frames shot did not survive loadDoc");
  }
  expect(shot.layout.assetIds).toEqual(layout.assetIds);
  return store;
}

describe("loop length chips", () => {
  it("offers 15 s, 20 s and 30 s", () => {
    expect(LOOP_LENGTHS).toEqual([15, 20, 30]);
  });

  for (const c of CASES) {
    const name = `${c.preset} Frames, ${c.count} screenshots at ${c.aspect}`;

    it(`${name}: disables only the chips under the shortest loop, with a reason`, () => {
      const layout = PRESETS[c.preset](c.aspect, ids(c.count));
      const chips = loopLengthChips(layout, c.aspect, 30);
      expect(chips.map(({ seconds, disabled, reason }) => ({ seconds, disabled, reason }))).toEqual(
        LOOP_LENGTHS.map((seconds) => ({
          seconds,
          disabled: seconds in c.disabled,
          reason: c.disabled[seconds],
        })),
      );
    });

    it(`${name}: each allowed chip sets the duration in one undo step and shows as pressed`, () => {
      const layout = PRESETS[c.preset](c.aspect, ids(c.count));
      // Start from 30 s, or from 25 s when testing the 30 s chip itself.
      for (const chip of loopLengthChips(layout, c.aspect, 30)) {
        if (chip.disabled) continue;
        const start = chip.seconds === 30 ? 25 : 30;
        const store = framesStore(layout, c.aspect, start);
        expect(loopLengthChips(layout, c.aspect, start).find((x) => x.pressed)?.seconds).toBe(
          start === 30 ? 30 : undefined,
        );

        store.getState().setShotDuration(0, chip.seconds);
        const shot = store.getState().doc.shots[0];
        expect(shot.duration).toBe(chip.seconds);
        expect(
          loopLengthChips(layout, c.aspect, shot.duration)
            .filter((x) => x.pressed)
            .map((x) => x.seconds),
        ).toEqual([chip.seconds]);
        expect(store.getState().past).toHaveLength(1);

        store.getState().undo();
        expect(store.getState().doc.shots[0].duration).toBe(start);
        expect(store.getState().past).toHaveLength(0);
      }
    });
  }

  it("marks no chip when the duration matches none", () => {
    const layout = mobileFramesLayout("9:16", ids(4));
    expect(loopLengthChips(layout, "9:16", 17.5).some((chip) => chip.pressed)).toBe(false);
  });

  it("a disabled chip's length clamps to the shot's minimum, never below it", () => {
    // The chip is disabled in the inspector; the store still clamps any shorter request.
    const layout = mobileFramesLayout("16:9", ids(6));
    const store = framesStore(layout, "16:9", 30);
    store.getState().setShotDuration(0, 15);
    expect(store.getState().doc.shots[0].duration).toBe(19.5);
  });
});
