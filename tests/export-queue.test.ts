import { describe, expect, it } from "vitest";
import { createDoc } from "../src/doc/defaults";
import type { Aspect } from "../src/doc/types";
import {
  docAtAspect,
  EXPORT_ASPECTS,
  orderSizes,
  runExportQueue,
  sizeChoices,
} from "../src/editor/export/queue";
import { framesLayout } from "../src/templates";

describe("export sizes", () => {
  it("offer the four sizes, with a project's other aspect first", () => {
    expect(sizeChoices("16:9")).toEqual(EXPORT_ASPECTS);
    expect(sizeChoices("1:1")).toEqual(["1:1", ...EXPORT_ASPECTS]);
  });

  it("export the project's aspect first, then in the chips' order", () => {
    expect(orderSizes(["9:16", "16:9", "4:5"], "4:5")).toEqual(["4:5", "16:9", "9:16"]);
    expect(orderSizes(["9:16", "4:3"], "16:9")).toEqual(["4:3", "9:16"]);
  });
});

describe("a document at another aspect", () => {
  it("is a re-fitted copy, and the project is unchanged", () => {
    const doc = createDoc({ aspect: "16:9" });
    doc.shots[0].layout = framesLayout("16:9", ["d1", "d2", "d3", "d4"]);
    const before = JSON.stringify(doc);

    const post = docAtAspect(doc, "4:5");

    expect(post.aspect).toBe("4:5");
    // Desktop Frames has 3 rows at 4:5, as "Switch to 4:5" would give it.
    expect(post.shots[0].layout).toEqual(framesLayout("4:5", ["d1", "d2", "d3", "d4"]));
    expect(JSON.stringify(doc)).toBe(before);
    expect(docAtAspect(doc, "16:9")).toBe(doc);
  });
});

describe("the export queue", () => {
  const aspects: Aspect[] = ["16:9", "4:3", "9:16"];

  it("exports one file per aspect in order, reporting each as it finishes", async () => {
    const events: string[] = [];
    await runExportQueue(
      aspects,
      async (aspect) => {
        events.push(`start ${aspect}`);
        return `${aspect}.mp4`;
      },
      (aspect, file, index) => events.push(`done ${index} ${file}`),
      new AbortController().signal,
    );
    expect(events).toEqual([
      "start 16:9",
      "done 0 16:9.mp4",
      "start 4:3",
      "done 1 4:3.mp4",
      "start 9:16",
      "done 2 9:16.mp4",
    ]);
  });

  it("stops on cancel and drops the file that was rendering", async () => {
    const controller = new AbortController();
    const done: Aspect[] = [];
    const started: Aspect[] = [];
    await runExportQueue(
      aspects,
      async (aspect, index) => {
        started.push(aspect);
        if (index === 1) controller.abort();
        return aspect;
      },
      (aspect) => done.push(aspect),
      controller.signal,
    );
    expect(started).toEqual(["16:9", "4:3"]);
    expect(done).toEqual(["16:9"]);
  });

  it("stops at a failure, keeping the files already reported", async () => {
    const done: Aspect[] = [];
    await expect(
      runExportQueue(
        aspects,
        async (aspect, index) => {
          if (index === 1) throw new Error("encoder failed");
          return aspect;
        },
        (aspect) => done.push(aspect),
        new AbortController().signal,
      ),
    ).rejects.toThrow("encoder failed");
    expect(done).toEqual(["16:9"]);
  });
});
