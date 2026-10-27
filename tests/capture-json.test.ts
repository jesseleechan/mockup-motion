import { describe, expect, it } from "vitest";
import {
  attachCaptures,
  captureFitsImage,
  captureSections,
  captureStem,
  parseCaptureJson,
  sectionKey,
  type CaptureJson,
} from "../src/assets/capture-json";
import { createDoc } from "../src/doc/defaults";
import { sanitizeDoc } from "../src/doc/validate";
import type { AssetRef } from "../src/doc/types";
import { demoAssetId, demoAssetRef } from "../src/lab/demo-assets";
import { applyCaptures, splitCaptureFiles } from "../src/editor/library/capture-import";
import aureliaDesktop from "../public/demo/aurelia/sections.json" with { type: "json" };
import aureliaMobile from "../public/demo/aurelia/sections-mobile.json" with { type: "json" };

const MOBILE: CaptureJson = aureliaMobile;

function image(id: string, name: string, width: number, height: number): AssetRef {
  return { id, kind: "image", name, mime: "image/png", bytes: 1, width, height };
}

describe("capture JSON (Responsive Scroll R02)", () => {
  it("parses a capture file and names the file when it can't", () => {
    const parsed = parseCaptureJson("m.json", JSON.stringify(MOBILE));
    expect(parsed.scale).toBe(2);
    expect(parsed.sections).toHaveLength(7);
    expect(() => parseCaptureJson("bad.json", "{")).toThrow(
      "bad.json: this file isn't valid JSON.",
    );
    expect(() => parseCaptureJson("other.json", '{"name":"x"}')).toThrow(
      "other.json: this isn't a capture file from npm run capture.",
    );
  });

  it("keys sections by id, else tag and first class", () => {
    expect(sectionKey({ tag: "section", id: "works" })).toBe("works");
    expect(sectionKey({ tag: "section", className: "works-section dark" })).toBe(
      "section.works-section",
    );
    expect(sectionKey({ tag: "footer" })).toBe("footer");
  });

  it("converts section tops to image px, ascending, first of a repeated key", () => {
    const sections = captureSections({
      url: "",
      viewportWidth: 390,
      scale: 2,
      pageHeight: 1000,
      sections: [
        { tag: "section", id: "b", top: 400 },
        { tag: "section", id: "a", top: 100.4 },
        { tag: "section", id: "b", top: 700 },
      ],
    });
    expect(sections).toEqual([
      { id: "a", top: 201 },
      { id: "b", top: 800 },
    ]);
    // Aurelia's mobile capture: works at 1602 CSS px is 3204 image px at 2×.
    expect(captureSections(MOBILE).find((s) => s.id === "works")?.top).toBe(3204);
  });

  it("strips the extension and the -full suffix from file names", () => {
    expect(captureStem("site-desktop-1440-full.png")).toBe("site-desktop-1440");
    expect(captureStem("site-desktop-1440.json")).toBe("site-desktop-1440");
    expect(captureStem("site-mobile-390@2x-full.png")).toBe("site-mobile-390@2x");
  });

  it("fits a capture to an image of its full-page size within 2 px", () => {
    expect(captureFitsImage(MOBILE, { width: 780, height: 11436 })).toBe(true);
    expect(captureFitsImage(MOBILE, { width: 780, height: 11438 })).toBe(true);
    expect(captureFitsImage(MOBILE, { width: 780, height: 11440 })).toBe(false);
    expect(captureFitsImage(MOBILE, { width: 1440, height: 11436 })).toBe(false);
  });

  it("attaches a capture to the new image with its stem", () => {
    const fresh = [
      image("a", "site-mobile-390@2x-full.png", 780, 11436),
      image("b", "other-mobile-390@2x-full.png", 780, 11436),
    ];
    const result = attachCaptures(
      fresh,
      [{ name: "site-mobile-390@2x.json", capture: MOBILE }],
      [],
    );
    expect(result.images[0].meta?.sections?.[3]).toEqual({ id: "works", top: 3204 });
    expect(result.images[0].meta?.page).toBe("http://localhost:3591/aurelia/");
    expect(result.images[1].meta?.sections).toBeUndefined();
    expect(result.unmatched).toEqual([]);
  });

  it("attaches by size only when exactly one image fits", () => {
    const one = attachCaptures(
      [image("a", "phone.png", 780, 11436), image("b", "hero.png", 780, 1688)],
      [{ name: "sections.json", capture: MOBILE }],
      [],
    );
    expect(one.images[0].meta?.sections).toBeDefined();
    const two = attachCaptures(
      [image("a", "one.png", 780, 11436), image("b", "two.png", 780, 11436)],
      [{ name: "sections.json", capture: MOBILE }],
      [],
    );
    expect(two.images.every((i) => i.meta?.sections === undefined)).toBe(true);
    expect(two.unmatched).toEqual(["sections.json"]);
  });

  it("never attaches sections by name to an image of another size", () => {
    const result = attachCaptures(
      [image("a", "site-mobile-390@2x.png", 780, 1688)],
      [{ name: "site-mobile-390@2x.json", capture: MOBILE }],
      [],
    );
    expect(result.images[0].meta?.sections).toBeUndefined();
    // Another width isn't the capture's screenshot at all.
    const other = attachCaptures(
      [image("a", "site-mobile-390@2x.png", 1170, 2532)],
      [{ name: "site-mobile-390@2x.json", capture: MOBILE }],
      [],
    );
    expect(other.images[0].meta).toBeUndefined();
    expect(other.unmatched).toEqual(["site-mobile-390@2x.json"]);
  });

  // A Site Tour usually shows first viewports, and each page's URL in the browser's pill.
  it("gives a capture's URL, not its sections, to its first-viewport screenshot", () => {
    const capture = { name: "site-mobile-390@2x.json", capture: MOBILE };
    const page = { page: "http://localhost:3591/aurelia/" };
    const both = attachCaptures(
      [
        image("full", "site-mobile-390@2x-full.png", 780, 11436),
        image("hero", "site-mobile-390@2x.png", 780, 1688),
      ],
      [capture],
      [],
    );
    expect(both.images[0].meta).toMatchObject(page);
    expect(both.images[0].meta?.sections?.length).toBeGreaterThan(0);
    expect(both.images[1].meta).toEqual(page);
    // Captured with --mode viewport, so without its full page.
    const alone = attachCaptures(
      [image("hero", "site-mobile-390@2x.png", 780, 1688)],
      [capture],
      [],
    );
    expect(alone.images[0].meta).toEqual(page);
    expect(alone.unmatched).toEqual([]);
    // Dropped after its screenshot is in the library.
    const later = attachCaptures(
      [],
      [capture],
      [image("lib", "site-mobile-390@2x.png", 780, 1688)],
    );
    expect(later.libraryUpdates).toEqual([{ id: "lib", meta: page }]);
    expect(later.unmatched).toEqual([]);
  });

  it("attaches a capture dropped alone to its screenshot in the library", () => {
    const library = [image("lib", "site-mobile-390@2x-full.png", 780, 11436)];
    const result = attachCaptures(
      [],
      [{ name: "site-mobile-390@2x.json", capture: MOBILE }],
      library,
    );
    expect(result.libraryUpdates).toHaveLength(1);
    expect(result.libraryUpdates[0].id).toBe("lib");
    expect(result.libraryUpdates[0].meta.sections?.[0]).toEqual({ id: "header", top: 0 });
  });

  it("keeps well-formed section data through validation and drops the rest", () => {
    const doc = createDoc();
    const raw = {
      ...doc,
      assets: [
        {
          ...image("a", "a.png", 780, 11436),
          meta: {
            tall: true,
            page: "https://example.com/",
            sections: [{ id: "b", top: 900 }, { id: "a", top: 10 }, { id: "", top: 5 }, { top: 3 }],
          },
        },
        { ...image("b", "b.png", 780, 11436), meta: { sections: "nope", page: 4 } },
      ],
    };
    const { doc: clean } = sanitizeDoc(raw);
    expect(clean.assets[0].meta).toEqual({
      tall: true,
      page: "https://example.com/",
      sections: [
        { id: "a", top: 10 },
        { id: "b", top: 900 },
      ],
    });
    expect(clean.assets[1].meta).toEqual({});
  });

  it("gives the demo full pages their sections and the hero shots none", () => {
    const desktop = demoAssetRef(demoAssetId("aurelia", "desktop", "full"));
    const mobile = demoAssetRef(demoAssetId("aurelia", "mobile", "full"));
    expect(desktop.meta?.sections?.find((s) => s.id === "works")?.top).toBe(1664);
    expect(mobile.meta?.sections?.find((s) => s.id === "works")?.top).toBe(3204);
    expect(desktop.meta?.page).toBe(mobile.meta?.page);
    expect(demoAssetRef(demoAssetId("aurelia", "mobile", "hero")).meta?.sections).toBeUndefined();
  });

  it("imports screenshots dropped with their capture files in any order", async () => {
    const json = (name: string, capture: CaptureJson) =>
      new File([JSON.stringify(capture)], name, { type: "application/json" });
    const webp = (name: string) => new File([new Uint8Array(8)], name, { type: "image/webp" });
    const { images, captures, errors } = await splitCaptureFiles([
      webp("aurelia-desktop-1440-full.webp"),
      json("aurelia-mobile-390@2x.json", MOBILE),
      webp("aurelia-mobile-390@2x-full.webp"),
      json("aurelia-desktop-1440.json", aureliaDesktop),
    ]);
    expect(errors).toEqual([]);
    expect(images.map((f) => f.name)).toEqual([
      "aurelia-desktop-1440-full.webp",
      "aurelia-mobile-390@2x-full.webp",
    ]);
    // The demo full pages' real sizes (public/demo/manifest.json).
    const { refs } = applyCaptures(
      [
        image("d", "aurelia-desktop-1440-full.webp", 1440, 4183),
        image("m", "aurelia-mobile-390@2x-full.webp", 780, 11436),
      ],
      captures,
    );
    const top = (ref: AssetRef, id: string) => ref.meta?.sections?.find((s) => s.id === id)?.top;
    // Desktop is captured at 1x, mobile at 2x: works is at 1664 and 1602 CSS px.
    expect(top(refs[0], "works")).toBe(1664);
    expect(top(refs[1], "works")).toBe(3204);
    expect(refs[0].meta?.sections).toHaveLength(7);
    expect(refs[0].meta?.page).toBe(refs[1].meta?.page);
  });
});
