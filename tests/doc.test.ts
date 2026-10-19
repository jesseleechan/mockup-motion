import { describe, it, expect } from "vitest";
import { createDoc, defaultShot } from "../src/doc/defaults";
import { sanitizeDoc } from "../src/doc/validate";
import { migrateV1Project, LEGACY_PRESET_TO_TEMPLATE, type V1Project } from "../src/doc/migrate";
import { V1_PRESETS, createV1Project } from "./fixtures/v1-presets";
import { getTemplateById } from "../src/templates";
import type { Layout } from "../src/doc/types";

describe("WP-01: Document Defaults and Validation", () => {
  it("defaults validate cleanly without any warnings", () => {
    const doc = createDoc();
    const { doc: sanitized, warnings } = sanitizeDoc(doc);
    expect(warnings).toEqual([]);
    expect(sanitized.version).toBe(2);
    expect(sanitized.style.shadow).toBe("soft");
    expect(sanitized.style.grain).toBe(0.25);
    expect(sanitized.style.vignette).toBe(0.06);
    expect(sanitized.export.resolution).toBe(1080);
    expect(sanitized.export.fps).toBe(30);
    expect(sanitized.export.quality).toBe("high");
    expect(sanitized.export.supersample).toBe(1.5);
    expect(sanitized.shots.length).toBe(1);
    expect(sanitized.shots[0].duration).toBe(5);
  });

  describe("sanitizeDoc handles broken documents (10 cases)", () => {
    it("1. handles non-object input gracefully", () => {
      const { doc, warnings } = sanitizeDoc(null);
      expect(warnings.length).toBeGreaterThan(0);
      expect(doc.version).toBe(2);
      expect(doc.shots.length).toBe(1);
    });

    it("2. corrects invalid aspect ratio to 16:9", () => {
      const { doc } = sanitizeDoc({ aspect: "invalid:ratio" });
      expect(doc.aspect).toBe("16:9");
    });

    it("3. clamps shot duration to range [1, 30]", () => {
      const brokenDoc = createDoc({
        shots: [
          { ...defaultShot(), duration: -5 },
          { ...defaultShot(), duration: 100 },
        ],
      });
      const { doc } = sanitizeDoc(brokenDoc);
      expect(doc.shots[0].duration).toBe(1);
      expect(doc.shots[1].duration).toBe(30);
    });

    it("4. clamps grain and vignette to [0, 1]", () => {
      const brokenDoc = createDoc();
      const styleRecord = brokenDoc.style as unknown as Record<string, unknown>;
      styleRecord.grain = 4.5;
      styleRecord.vignette = -2;
      const { doc } = sanitizeDoc(brokenDoc);
      expect(doc.style.grain).toBe(1);
      expect(doc.style.vignette).toBe(0);
    });

    it("5. sanitizes camera moves: invalid preset defaults to pushIn, clamps intensity and float", () => {
      const shot = defaultShot();
      const cameraRecord = shot.camera as unknown as Record<string, unknown>;
      cameraRecord.preset = "invalid_3d_spin";
      shot.camera.intensity = 5;
      shot.camera.float = -1;
      const brokenDoc = createDoc({ shots: [shot] });
      const { doc } = sanitizeDoc(brokenDoc);
      expect(doc.shots[0].camera.preset).toBe("pushIn");
      expect(doc.shots[0].camera.intensity).toBe(1);
      expect(doc.shots[0].camera.float).toBe(0);
    });

    it("6. drops shot with missing/invalid layout and ensures at least 1 shot", () => {
      const broken = {
        shots: [
          { id: "s1", duration: 5, layout: null },
          { id: "s2", duration: 5, layout: { kind: "invalid" } },
        ],
      };
      const { doc, warnings } = sanitizeDoc(broken);
      expect(warnings.length).toBeGreaterThan(0);
      expect(doc.shots.length).toBe(1);
      expect(doc.shots[0].layout.kind).toBe("single");
    });

    it("7. removes missing asset references in single, saved pair and rows layouts", () => {
      const brokenDoc = createDoc({
        assets: [{ id: "asset-1", kind: "image", name: "test", mime: "image/png", bytes: 10 }],
        shots: [
          {
            ...defaultShot(),
            layout: { kind: "single", device: "browser", assetId: "missing-asset" },
          },
          {
            ...defaultShot(),
            // A saved pair (cut on 19 Oct 2026) loads as a browser with its desktop capture.
            layout: {
              kind: "pair",
              desktopId: "missing-desk",
              mobileId: "asset-1",
              arrangement: "overlap",
            } as unknown as Layout,
          },
          {
            ...defaultShot(),
            layout: {
              kind: "rows",
              assetIds: ["asset-1", "missing-id"],
              rows: 2,
              device: "browser",
              tilt: 0,
              travel: "period",
            },
          },
        ],
      });
      const { doc, warnings } = sanitizeDoc(brokenDoc);
      expect(warnings.length).toBeGreaterThan(0);
      const l0 = doc.shots[0].layout as { assetId?: string };
      const l1 = doc.shots[1].layout;
      const l2 = doc.shots[2].layout as { assetIds?: string[] };
      expect(l0.assetId).toBe("");
      expect(l1).toEqual({ kind: "single", device: "browser", assetId: "" });
      expect(l2.assetIds).toEqual(["asset-1"]);
    });

    it("8. replaces an unknown background kind with the default background", () => {
      const brokenDoc = createDoc() as unknown as { style: { background: unknown } };
      brokenDoc.style.background = { kind: "video", assetId: "clip" };
      const { doc } = sanitizeDoc(brokenDoc);
      expect(doc.style.background).toEqual(createDoc().style.background);
    });

    it("9. drops text layers and title cards from a saved document", () => {
      // Saved before typography was removed (October 2026): a title card, then a browser shot
      // with a text layer, with the old typography style fields.
      const saved = JSON.parse(JSON.stringify(createDoc())) as Record<string, unknown> & {
        style: Record<string, unknown>;
        shots: Record<string, unknown>[];
      };
      saved.style.fonts = {
        display: { source: "builtin", family: "Fraunces", weight: 600 },
        body: { source: "builtin", family: "Inter", weight: 400 },
      };
      saved.style.textColor = "#112233";
      const browser = saved.shots[0];
      browser.texts = [{ id: "t1", text: "Headline", role: "title", animation: "fadeUp" }];
      saved.shots = [{ ...browser, id: "title", layout: { kind: "title" } }, browser];

      const { doc } = sanitizeDoc(saved);
      expect(doc.shots).toHaveLength(1);
      expect(doc.shots[0].id).toBe(browser.id);
      expect(doc.shots[0].layout.kind).toBe("single");
      expect(doc.shots[0]).not.toHaveProperty("texts");
      expect(doc.style).not.toHaveProperty("fonts");
      expect(doc.style).not.toHaveProperty("textColor");

      // A document of title cards only gets a default shot.
      saved.shots = [{ ...browser, id: "title", layout: { kind: "title" } }];
      const titleOnly = sanitizeDoc(saved).doc;
      expect(titleOnly.shots).toHaveLength(1);
      expect(titleOnly.shots[0].layout).toEqual(defaultShot().layout);
    });

    it("10. sanitizes transition duration", () => {
      const shot = defaultShot();
      shot.transitionIn = {
        kind: "wipe",
        duration: -1,
        easing: "quintInOut",
      };
      const brokenDoc = createDoc({ shots: [shot] });
      const { doc } = sanitizeDoc(brokenDoc);
      expect(doc.shots[0].transitionIn.duration).toBe(0);
    });
  });

  it("loads a shot saved with the removed cursor and drops the cursor", () => {
    const saved = createDoc();
    const shot = {
      ...saved.shots[0],
      cursor: { enabled: true, style: "pointer", keys: [{ t: 1, x: 0.5, y: 0.5, click: true }] },
    };
    const { doc, warnings } = sanitizeDoc({ ...saved, shots: [shot] });
    expect(warnings).toEqual([]);
    expect(doc.shots).toHaveLength(1);
    expect(doc.shots[0].id).toBe(saved.shots[0].id);
    expect(doc.shots[0].layout).toEqual(saved.shots[0].layout);
    expect("cursor" in doc.shots[0]).toBe(false);
  });

  describe("v1 to v2 migration produces valid docs for all 8 presets", () => {
    it("maps v1 presets only to built-in templates", () => {
      for (const id of Object.values(LEGACY_PRESET_TO_TEMPLATE)) {
        expect(getTemplateById(id), id).toBeDefined();
      }
    });

    // Every v1 preset's template has been removed (PF01, D9). The map and its lookup stay so a
    // future template can claim a preset again.
    it("maps no v1 preset to a template", () => {
      expect(LEGACY_PRESET_TO_TEMPLATE).toEqual({});
    });

    for (const preset of V1_PRESETS) {
      it(`migrates preset: ${preset.id} (${preset.name})`, () => {
        const v1Project: V1Project = {
          version: 1,
          name: `Test Project - ${preset.name}`,
          presetId: preset.id,
          customized: false,
          aspectRatio: "16:9",
          composition: structuredClone(preset.composition),
          images: [
            {
              id: "img-1",
              name: "desktop.png",
              url: "",
              width: 1920,
              height: 1080,
              aspectRatio: 16 / 9,
              category: "desktop",
            },
            {
              id: "img-2",
              name: "mobile.png",
              url: "",
              width: 390,
              height: 844,
              aspectRatio: 390 / 844,
              category: "mobile",
            },
          ],
          exportSettings: {
            resolution: 1080,
            fps: 30,
            quality: "high",
            format: "mp4",
          },
        };

        const doc = migrateV1Project(v1Project);
        expect(doc.version).toBe(2);
        expect(doc.name).toBe(v1Project.name);
        expect(doc.shots.length).toBeGreaterThanOrEqual(1);
        // No v1 preset has a template any more; the shots come from the v1 composition.
        expect(doc.templateId).toBeUndefined();

        // Layout verification
        if (preset.id === "clean-hero" || preset.id === "soft-studio") {
          expect(doc.shots[0].layout.kind).toBe("single");
        } else if (
          preset.id === "midnight-rows" ||
          preset.id === "angled-gallery" ||
          preset.id === "gallery-wall"
        ) {
          // Desktop Frames (src/doc/legacy-layouts.ts)
          expect(doc.shots[0].layout).toMatchObject({ kind: "rows", travel: "period", tilt: 0 });
        } else if (preset.id === "phone-columns") {
          // Mobile Frames
          expect(doc.shots[0].layout).toMatchObject({ kind: "columns", travel: "period" });
        } else if (preset.id === "responsive-pair") {
          expect(doc.shots[0].layout).toMatchObject({ kind: "single", device: "browser" });
        }

        // Assets verification
        expect(doc.assets.length).toBe(2);
        expect(doc.assets[0].role).toBe("desktop");
        expect(doc.assets[1].role).toBe("mobile");
      });
    }

    it("migrates scrolling and drops the brand title and subtitle", () => {
      const v1Project: V1Project = {
        version: 1,
        name: "Brand & Scroll Test",
        presetId: "clean-hero",
        customized: true,
        aspectRatio: "16:9",
        composition: {
          ...structuredClone(V1_PRESETS[0].composition),
          brand: {
            title: "Super Brand",
            subtitle: "Award Winning Design",
            color: "#FFFFFF",
            size: 50,
            position: "bottom",
            logoId: "logo-asset",
          },
          contentMotion: {
            enabled: true,
            start: 0,
            end: 0.75,
            hold: 1.2,
          },
        },
        images: [
          {
            id: "site-full",
            name: "tall.png",
            url: "",
            width: 1440,
            height: 4000,
            aspectRatio: 1440 / 4000,
            category: "desktop",
          },
        ],
        exportSettings: {
          resolution: 1080,
          fps: 30,
          quality: "high",
          format: "mp4",
        },
      };

      const doc = migrateV1Project(v1Project);
      // Text layers were removed (October 2026), so the V1 brand text has no equivalent.
      expect(doc.shots).toHaveLength(1);
      expect(doc.shots[0]).not.toHaveProperty("texts");

      expect(doc.shots[0].scroll?.enabled).toBe(true);
      expect(doc.shots[0].scroll?.stops).toEqual([0, 0.75]);
      expect(doc.shots[0].scroll?.hold).toBe(1.2);
    });
  });
});

// F02: persistence preserves the visual direction of legacy documents.
describe("F02 CSS angle compatibility", () => {
  it("converts unmarked v2 style and override gradients exactly once", () => {
    const raw = createDoc();
    raw.style.background = { kind: "gradient", stops: ["#000000", "#FFFFFF"], angle: 135 };
    raw.shots[0].styleOverrides = {
      background: { kind: "gradient", stops: ["#000000", "#FFFFFF"], angle: 0 },
      grain: 0.2,
    };
    const first = sanitizeDoc(raw).doc;
    expect(first.style.background).toEqual({
      kind: "gradient",
      stops: ["#000000", "#FFFFFF"],
      angle: 315,
      angleConvention: "css",
    });
    expect(first.shots[0].styleOverrides).toEqual({
      background: {
        kind: "gradient",
        stops: ["#000000", "#FFFFFF"],
        angle: 90,
        angleConvention: "css",
      },
      grain: 0.2,
    });
    expect(sanitizeDoc(first).doc).toEqual(first);
  });
  it("retains historical v1 CSS angles during migration", () => {
    const preset = createV1Project();
    preset.composition.background.type = "gradient";
    preset.composition.background.angle = 180;
    expect(migrateV1Project(preset).style.background).toMatchObject({
      kind: "gradient",
      angle: 180,
      angleConvention: "css",
    });
  });
});

describe("Removed backgrounds load as preset looks", () => {
  it("loads mesh as a gradient of its colours, and ambient and image as the Ash solid", () => {
    const saved = createDoc() as unknown as {
      style: { background: unknown };
      shots: { styleOverrides?: { background?: unknown } }[];
    };
    saved.style.background = {
      kind: "mesh",
      colors: ["#1B1B2F", "#3A2F4F", "#6B4E71", "#C3A6A0"],
      drift: 0.05,
      seed: 42,
    };
    saved.shots = [defaultShot(), defaultShot()];
    saved.shots[0].styleOverrides = {
      background: { kind: "ambient", assetId: "shot", blur: 0.8, dim: 0.2 },
    };
    saved.shots[1].styleOverrides = { background: { kind: "image", assetId: "shot", dim: 0 } };

    const { doc } = sanitizeDoc(saved);
    expect(doc.style.background).toEqual({
      kind: "gradient",
      stops: ["#1B1B2F", "#C3A6A0"],
      angle: 315,
      angleConvention: "css",
    });
    const ash = { kind: "solid", color: "#DFE1E3" };
    expect(doc.shots[0].styleOverrides?.background).toEqual(ash);
    expect(doc.shots[1].styleOverrides?.background).toEqual(ash);
  });

  it("migrates a v1 image background to the Ash solid", () => {
    const preset = createV1Project();
    preset.composition.background.type = "image";
    expect(migrateV1Project(preset).style.background).toEqual({
      kind: "solid",
      color: "#DFE1E3",
    });
  });
});

describe("Slider layout validation (presets P01)", () => {
  const image = (id: string) => ({
    id,
    kind: "image" as const,
    name: id,
    mime: "image/png",
    bytes: 100,
    width: 390,
    height: 844,
  });

  it("keeps a valid slider layout unchanged", () => {
    const layout = {
      kind: "slider" as const,
      assetIds: ["m1", "m2", "m3"],
      axis: "y" as const,
      shape: "desktop" as const,
      step: 3.2,
    };
    const doc = createDoc({
      assets: ["m1", "m2", "m3"].map(image),
      shots: [{ ...defaultShot(layout), duration: 9.6 }],
    });
    const { doc: sanitized, warnings } = sanitizeDoc(doc);
    expect(warnings).toEqual([]);
    expect(sanitized.shots[0].layout).toEqual(layout);
  });

  it("repairs an invalid slider layout", () => {
    const repaired = (layout: Record<string, unknown>) => {
      const doc = createDoc({ assets: ["m1", "m2"].map(image) });
      (doc.shots[0] as { layout: unknown }).layout = layout;
      return sanitizeDoc(doc).doc.shots[0].layout;
    };
    expect(
      repaired({ kind: "slider", assetIds: ["m1", "gone", 7, "m2"], axis: "z", shape: "watch" }),
    ).toEqual({ kind: "slider", assetIds: ["m1", "m2"], axis: "x", shape: "mobile", step: 2 });
    expect(repaired({ kind: "slider", assetIds: "m1", step: 9 })).toEqual({
      kind: "slider",
      assetIds: [],
      axis: "x",
      shape: "mobile",
      step: 4,
    });
    expect(repaired({ kind: "slider", assetIds: ["m2"], step: 0.5 })).toMatchObject({ step: 1.6 });
    expect(repaired({ kind: "slider", assetIds: ["m2"], step: Number.NaN })).toMatchObject({
      step: 2,
    });
  });
});
