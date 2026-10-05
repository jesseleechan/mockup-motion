import type { AssetRef, Style } from "../doc/types";
import { defaultCameraMove, defaultShot, defaultStyle } from "../doc/defaults";
import type { Template, TemplateBuildContext } from "./types";

export const BUILTIN_TEMPLATES: Template[] = [
  {
    id: "hero-drift",
    name: "Hero Drift",
    description: "Gentle push-in on a desktop browser mockup with subtle ambient float.",
    category: "single",
    slots: [
      {
        key: "desktop1",
        role: "desktop",
        required: true,
        prefer: "tall",
        label: "Desktop screenshot",
      },
    ],
    defaultDuration: 5,
    build: (ctx: TemplateBuildContext) => {
      const asset = ctx.slots.desktop1;
      const baseStyle: Style = {
        ...defaultStyle(),
        ...ctx.style,
        browserChrome: "standard",
      };
      const shot = defaultShot({
        kind: "single",
        device: "browser",
        assetId: asset?.id ?? "",
      });
      shot.camera = {
        preset: "pushIn",
        intensity: 0.5,
        easing: "smooth",
        float: 0.3,
      };
      shot.duration = 5;
      return { style: baseStyle, shots: [shot], loop: true };
    },
  },
  {
    id: "frameless-card",
    name: "Frameless Card",
    description: "Clean floating screenshot card with dramatic hero tilt and soft shadows.",
    category: "single",
    slots: [
      {
        key: "desktop1",
        role: "desktop",
        required: true,
        prefer: "any",
        label: "Screenshot",
      },
    ],
    defaultDuration: 5,
    build: (ctx: TemplateBuildContext) => {
      const asset = ctx.slots.desktop1;
      const baseStyle: Style = {
        ...defaultStyle(),
        ...ctx.style,
        shadow: "medium",
      };
      const shot = defaultShot({
        kind: "single",
        device: "card",
        assetId: asset?.id ?? "",
      });
      shot.camera = {
        preset: "heroTilt",
        intensity: 0.8,
        easing: "smooth",
        float: 0.2,
      };
      shot.duration = 5;
      return { style: baseStyle, shots: [shot], loop: true };
    },
  },
  {
    id: "floating-phone",
    name: "Floating Phone",
    description: "Mobile app presentation orbiting with gentle perspective.",
    category: "mobile",
    slots: [
      {
        key: "mobile1",
        role: "mobile",
        required: true,
        prefer: "any",
        label: "Mobile screenshot",
      },
    ],
    defaultDuration: 5,
    build: (ctx: TemplateBuildContext) => {
      const asset = ctx.slots.mobile1;
      const baseStyle: Style = {
        ...defaultStyle(),
        ...ctx.style,
        deviceFinish: "graphite",
      };
      const shot = defaultShot({
        kind: "single",
        device: "phone",
        assetId: asset?.id ?? "",
      });
      shot.camera = {
        preset: "orbitRight",
        intensity: 0.7,
        easing: "smooth",
        float: 0.2,
      };
      shot.duration = 5;
      return { style: baseStyle, shots: [shot], loop: true };
    },
  },
  {
    id: "isometric-laptop",
    name: "Isometric Laptop",
    description: "Modern laptop perspective floating along an elegant isometric drift.",
    category: "single",
    slots: [
      {
        key: "desktop1",
        role: "desktop",
        required: true,
        prefer: "any",
        label: "Desktop screenshot",
      },
    ],
    defaultDuration: 5,
    build: (ctx: TemplateBuildContext) => {
      const asset = ctx.slots.desktop1;
      const baseStyle: Style = {
        ...defaultStyle(),
        ...ctx.style,
        deviceFinish: "silver",
      };
      const shot = defaultShot({
        kind: "single",
        device: "laptop",
        assetId: asset?.id ?? "",
      });
      shot.camera = {
        preset: "isoDrift",
        intensity: 0.8,
        easing: "smooth",
        float: 0.2,
      };
      shot.duration = 5;
      return { style: baseStyle, shots: [shot], loop: true };
    },
  },
  {
    id: "title-intro",
    name: "Title Intro",
    description: "Bold typographic title card with smooth kinetic reveals.",
    category: "reel",
    slots: [],
    defaultDuration: 3,
    build: (ctx: TemplateBuildContext) => {
      const baseStyle: Style = {
        ...defaultStyle(),
        ...ctx.style,
      };
      const shot = defaultShot({
        kind: "title",
      });
      shot.camera = defaultCameraMove();
      shot.camera.preset = "static";
      shot.camera.intensity = 0;
      shot.duration = 3;
      shot.texts = [
        {
          id: crypto.randomUUID(),
          text: ctx.projectName || "Crafting Calm Digital Experiences",
          role: "title",
          font: "display",
          size: 6.0,
          anchor: "center",
          align: "center",
          color: "",
          animation: "maskReveal",
          delay: 0,
        },
        {
          id: crypto.randomUUID(),
          text: "Curated typography with balanced wrapping and kinetic motion",
          role: "subtitle",
          font: "body",
          size: 2.5,
          anchor: "bottom",
          align: "center",
          color: "",
          animation: "fadeUp",
          delay: 0.3,
        },
      ];
      return { style: baseStyle, shots: [shot], loop: true };
    },
  },
  {
    id: "app-showcase",
    name: "App Showcase",
    description: "Two-shot dynamic reel opening with mobile orbit and finishing with a desktop hero drift.",
    category: "portfolio",
    slots: [
      {
        key: "mobile1",
        role: "mobile",
        required: true,
        prefer: "any",
        label: "Mobile screenshot",
      },
      {
        key: "desktop1",
        role: "desktop",
        required: true,
        prefer: "any",
        label: "Desktop screenshot",
      },
    ],
    defaultDuration: 7,
    build: (ctx: TemplateBuildContext) => {
      const mobAsset = ctx.slots.mobile1;
      const dskAsset = ctx.slots.desktop1;
      const baseStyle: Style = {
        ...defaultStyle(),
        ...ctx.style,
      };

      const shot1 = defaultShot({
        kind: "single",
        device: "phone",
        assetId: mobAsset?.id ?? "",
      });
      shot1.camera = {
        preset: "orbitRight",
        intensity: 0.6,
        easing: "smooth",
        float: 0.2,
      };
      shot1.duration = 3.5;

      const shot2 = defaultShot({
        kind: "single",
        device: "laptop",
        assetId: dskAsset?.id ?? "",
      });
      shot2.camera = {
        preset: "pushIn",
        intensity: 0.5,
        easing: "smooth",
        float: 0.2,
      };
      shot2.duration = 3.5;
      shot2.transitionIn = { kind: "fade", duration: 0.5, easing: "smooth" };

      return { style: baseStyle, shots: [shot1, shot2], loop: true };
    },
  },
];

/**
 * Greedily fills template slots from available assets by matching roles.
 */
export function fillSlots(
  t: Template,
  assets: AssetRef[],
): Record<string, AssetRef | undefined> {
  const result: Record<string, AssetRef | undefined> = {};
  const used = new Set<string>();

  for (const slot of t.slots) {
    // 1. Try to find an unused asset matching role
    let match = assets.find((a) => !used.has(a.id) && a.role === slot.role);

    // 2. If prefer === "tall", prefer tall meta
    if (slot.prefer === "tall") {
      const tallMatch = assets.find(
        (a) => !used.has(a.id) && a.role === slot.role && a.meta?.tall,
      );
      if (tallMatch) match = tallMatch;
    }

    // 3. Fallback to any unused image asset
    if (!match) {
      match = assets.find((a) => !used.has(a.id) && a.kind === "image");
    }

    // 4. Fallback to any image asset even if reused
    if (!match) {
      match = assets.find((a) => a.kind === "image");
    }

    if (match) {
      result[slot.key] = match;
      used.add(match.id);
    } else {
      result[slot.key] = undefined;
    }
  }

  return result;
}

/**
 * Builds the template output using the document's available assets and configuration.
 */
export function buildTemplate(
  t: Template,
  doc: { aspect: TemplateBuildContext["aspect"]; assets: AssetRef[]; name: string; style?: Style },
) {
  const slots = fillSlots(t, doc.assets);
  return t.build({
    aspect: doc.aspect,
    slots,
    projectName: doc.name,
    style: doc.style,
  });
}
