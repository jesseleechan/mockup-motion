import { describe, it, expect } from "vitest";
import { createDoc, defaultShot } from "../src/doc/defaults";
import { sanitizeDoc } from "../src/doc/validate";
import { migrateV1Project, LEGACY_PRESET_TO_TEMPLATE, type V1Project } from "../src/doc/migrate";
import { PRESETS } from "../src/presets/presets";

describe("WP-01: Document Defaults and Validation", () => {
  it("defaults validate cleanly without any warnings", () => {
    const doc = createDoc();
    const { doc: sanitized, warnings } = sanitizeDoc(doc);
    expect(warnings).toEqual([]);
    expect(sanitized.version).toBe(2);
    expect(sanitized.style.shadow).toBe("soft");
    expect(sanitized.style.grain).toBe(0.25);
    expect(sanitized.style.vignette).toBe(0.06);
    expect(sanitized.style.fonts.display.family).toBe("Inter Display");
    expect(sanitized.style.fonts.body.family).toBe("Inter");
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

    it("7. removes missing asset references in single, pair, rows layout", () => {
      const brokenDoc = createDoc({
        assets: [{ id: "asset-1", kind: "image", name: "test", mime: "image/png", bytes: 10 }],
        shots: [
          {
            ...defaultShot(),
            layout: { kind: "single", device: "browser", assetId: "missing-asset" },
          },
          {
            ...defaultShot(),
            layout: {
              kind: "pair",
              desktopId: "missing-desk",
              mobileId: "asset-1",
              arrangement: "overlap",
            },
          },
          {
            ...defaultShot(),
            layout: {
              kind: "rows",
              assetIds: ["asset-1", "missing-id"],
              rows: 2,
              device: "browser",
              tilt: 10,
              speed: 0.2,
            },
          },
        ],
      });
      const { doc, warnings } = sanitizeDoc(brokenDoc);
      expect(warnings.length).toBeGreaterThan(0);
      const l0 = doc.shots[0].layout as { assetId?: string };
      const l1 = doc.shots[1].layout as { desktopId?: string; mobileId?: string };
      const l2 = doc.shots[2].layout as { assetIds?: string[] };
      expect(l0.assetId).toBe("");
      expect(l1.desktopId).toBe("");
      expect(l1.mobileId).toBe("asset-1");
      expect(l2.assetIds).toEqual(["asset-1"]);
    });

    it("8. resets missing asset in ambient and image background to empty", () => {
      const brokenDoc = createDoc();
      brokenDoc.style.background = {
        kind: "ambient",
        assetId: "nonexistent",
        blur: 0.5,
        dim: 0.2,
      };
      const { doc, warnings } = sanitizeDoc(brokenDoc);
      expect(warnings.length).toBeGreaterThan(0);
      expect(doc.style.background.kind).toBe("ambient");
      const bg = doc.style.background as { assetId?: string };
      expect(bg.assetId).toBe("");
    });

    it("9. clamps font weights to [100, 900]", () => {
      const brokenDoc = createDoc();
      brokenDoc.style.fonts.display.weight = 1500;
      brokenDoc.style.fonts.body.weight = 10;
      const { doc } = sanitizeDoc(brokenDoc);
      expect(doc.style.fonts.display.weight).toBe(900);
      expect(doc.style.fonts.body.weight).toBe(100);
    });

    it("10. sanitizes text layer size, delay, and transition duration", () => {
      const shot = defaultShot();
      shot.texts = [
        {
          id: "t1",
          text: "Headline",
          role: "title",
          font: "display",
          size: 0.5, // below 1.6% min
          anchor: "center",
          align: "center",
          color: "",
          animation: "none",
          delay: -4,
        },
      ];
      shot.transitionIn = {
        kind: "wipe",
        duration: -1,
        easing: "quintInOut",
      };
      const brokenDoc = createDoc({ shots: [shot] });
      const { doc } = sanitizeDoc(brokenDoc);
      expect(doc.shots[0].texts[0].size).toBe(1.6);
      expect(doc.shots[0].texts[0].delay).toBe(0);
      expect(doc.shots[0].transitionIn.duration).toBe(0);
    });
  });

  describe("v1 to v2 migration produces valid docs for all 8 presets", () => {
    for (const preset of PRESETS) {
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
        expect(doc.templateId).toBe(LEGACY_PRESET_TO_TEMPLATE[preset.id]);

        // Layout verification
        if (preset.id === "clean-hero" || preset.id === "soft-studio") {
          expect(doc.shots[0].layout.kind).toBe("single");
        } else if (preset.id === "midnight-rows" || preset.id === "angled-gallery") {
          expect(doc.shots[0].layout.kind).toBe("rows");
        } else if (preset.id === "gallery-wall") {
          expect(doc.shots[0].layout.kind).toBe("wall");
        } else if (preset.id === "phone-columns") {
          expect(doc.shots[0].layout.kind).toBe("columns");
        } else if (preset.id === "responsive-pair") {
          expect(doc.shots[0].layout.kind).toBe("pair");
        }

        // Assets verification
        expect(doc.assets.length).toBe(2);
        expect(doc.assets[0].role).toBe("desktop");
        expect(doc.assets[1].role).toBe("mobile");
      });
    }

    it("migrates brand title, subtitle, and scrolling correctly", () => {
      const v1Project: V1Project = {
        version: 1,
        name: "Brand & Scroll Test",
        presetId: "clean-hero",
        customized: true,
        aspectRatio: "16:9",
        composition: {
          ...structuredClone(PRESETS[0].composition),
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
      expect(doc.shots[0].texts.length).toBe(2);
      expect(doc.shots[0].texts[0].text).toBe("Super Brand");
      expect(doc.shots[0].texts[0].role).toBe("title");
      expect(doc.shots[0].texts[0].anchor).toBe("bottom");
      expect(doc.shots[0].texts[0].animation).toBe("fadeUp");

      expect(doc.shots[0].texts[1].text).toBe("Award Winning Design");
      expect(doc.shots[0].texts[1].role).toBe("subtitle");
      expect(doc.shots[0].texts[1].anchor).toBe("bottom");

      expect(doc.shots[0].scroll?.enabled).toBe(true);
      expect(doc.shots[0].scroll?.stops).toEqual([0, 0.75]);
      expect(doc.shots[0].scroll?.hold).toBe(1.2);
    });
  });
});
