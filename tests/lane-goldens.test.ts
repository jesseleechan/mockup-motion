import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  decodeFrame,
  type GoldenFile,
  type GoldenGroup,
  goldenCases,
  goldenNodes,
} from "./fixtures/lane-golden-cases";

// PF02: the nodes recorded before the Frames period mode moved into `lanes.ts` must come out
// exactly the same after it, with no tolerance. Desktop Frames' pixels and saved tilted rows and
// columns depend on it (docs/phone-frames-plan/README.md §1, "Extraction risk").
const golden = JSON.parse(
  readFileSync(new URL("./fixtures/lane-goldens.json", import.meta.url), "utf8"),
) as GoldenFile;

const GROUPS: Record<GoldenGroup, string> = {
  frames: "Desktop Frames (rows, travel period)",
  columnsSteps: "tilted phone columns (travel steps)",
  rowsSteps: "tilted browser rows (travel steps)",
};

describe("lane goldens (PF02)", () => {
  const cases = goldenCases();
  for (const [group, title] of Object.entries(GROUPS) as [GoldenGroup, string][]) {
    it(`${title}: nodes match the recording exactly`, () => {
      const recorded = golden[group];
      expect(cases[group].map((c) => c.name)).toEqual(recorded.map((c) => c.name));
      cases[group].forEach((c, i) => {
        expect(c.duration, `${c.name} duration`).toBe(recorded[i].duration);
        expect(c.times, `${c.name} times`).toEqual(recorded[i].frames.map((f) => f.t));
        for (const frame of recorded[i].frames) {
          expect(goldenNodes(c, frame.t), `${c.name} t=${frame.t}`).toEqual(decodeFrame(frame));
        }
      });
    });
  }
});
