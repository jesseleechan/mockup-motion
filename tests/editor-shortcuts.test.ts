import { describe, expect, it } from "vitest";
import { isTypingTarget, leavesKeyToFocus, type KeyTarget } from "../src/editor/focus";

/** A focused element as the rule reads it: its tag and its role. */
function element(tagName: string, role: string | null = null, isContentEditable = false) {
  const el: KeyTarget = {
    tagName: tagName.toUpperCase(),
    isContentEditable,
    getAttribute: (name) => (name === "role" ? role : null),
  };
  return el;
}

function keydown(code: string, target: KeyTarget | null, defaultPrevented = false) {
  return { code, defaultPrevented, target };
}

const BODY = element("body");

describe("editor shortcuts and the focused element", () => {
  it("steps the playhead with the arrows, Home and End when no control handled them", () => {
    for (const code of ["ArrowLeft", "ArrowRight", "Home", "End"]) {
      expect(leavesKeyToFocus(keydown(code, BODY))).toBe(false);
      expect(leavesKeyToFocus(keydown(code, element("button", "radio")))).toBe(false);
    }
  });

  it("leaves a key a focused control already handled", () => {
    // A segmented item, a tab and a slider thumb call preventDefault on the arrows, Home and End.
    const controls = [
      element("button", "radio"),
      element("button", "tab"),
      element("span", "slider"),
    ];
    for (const target of controls) {
      for (const code of ["ArrowLeft", "ArrowRight", "Home", "End"]) {
        expect(leavesKeyToFocus(keydown(code, target, true))).toBe(true);
      }
    }
  });

  it("leaves Space to a focused element that acts on it", () => {
    const pressable = [
      element("button"), // a button or a chip
      element("button", "switch"),
      element("button", "tab"),
      element("button", "radio"), // a segmented item
      element("div", "button"),
      element("div", "menuitem"),
    ];
    for (const target of pressable) expect(leavesKeyToFocus(keydown("Space", target))).toBe(true);
  });

  it("plays with Space elsewhere, also on a slider, which doesn't act on Space", () => {
    expect(leavesKeyToFocus(keydown("Space", BODY))).toBe(false);
    expect(leavesKeyToFocus(keydown("Space", null))).toBe(false);
    expect(leavesKeyToFocus(keydown("Space", element("canvas")))).toBe(false);
    // The timeline scrubber and Radix's slider thumb.
    expect(leavesKeyToFocus(keydown("Space", element("div", "slider")))).toBe(false);
    expect(leavesKeyToFocus(keydown("Space", element("span", "slider")))).toBe(false);
  });

  it("leaves every key to a field that takes text", () => {
    for (const target of [element("input"), element("textarea"), element("div", null, true)]) {
      expect(isTypingTarget(target)).toBe(true);
      for (const code of ["Space", "ArrowLeft", "KeyZ"]) {
        expect(leavesKeyToFocus(keydown(code, target))).toBe(true);
      }
    }
    expect(isTypingTarget(element("button"))).toBe(false);
  });
});
