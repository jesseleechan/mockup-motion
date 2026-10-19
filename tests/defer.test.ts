import { describe, expect, it } from "vitest";
import { preloadable } from "../src/editor/defer";

describe("preloadable (the Export dialog's chunk)", () => {
  it("shares one load between the idle preload and the click", async () => {
    let calls = 0;
    const load = preloadable(async () => ++calls);
    const [first, second] = await Promise.all([load(), load()]);
    expect([first, second, await load()]).toEqual([1, 1, 1]);
    expect(calls).toBe(1);
  });

  it("passes a failed load on, and loads again on the next call", async () => {
    let calls = 0;
    const load = preloadable(async () => {
      calls++;
      if (calls === 1) throw new Error("chunk failed to load");
      return "dialog";
    });
    await expect(load()).rejects.toThrow("chunk failed to load");
    await expect(load()).resolves.toBe("dialog");
    expect(calls).toBe(2);
  });
});
