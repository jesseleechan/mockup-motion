import type { V1Composition, V1Project } from "../../src/doc/migrate";

export interface V1Preset {
  id: string;
  name: string;
  description: string;
  category: "desktop" | "mobile" | "mixed";
  composition: V1Composition;
}

export function createV1Composition(): V1Composition {
  return {
    layout: "hero",
    scale: 78,
    spacing: 24,
    rotation: 0,
    count: 3,
    alignment: "center",
    assetIds: { primary: "", mobile: "" },
    frame: {
      type: "browser",
      appearance: "light",
      radius: 14,
      border: 1,
      finish: "titanium",
      title: "",
      status: false,
    },
    image: { fit: "cover", crop: 0 },
    background: {
      type: "gradient",
      color: "#b8b0fa",
      secondColor: "#fff3e5",
      angle: 135,
      intensity: 40,
      imageId: "",
    },
    motion: {
      type: "zoom",
      duration: 6,
      amount: 12,
      direction: "forward",
      easing: "smooth",
      loop: true,
      hold: 0,
    },
    contentMotion: { enabled: false, start: 0, end: 100, hold: 0.6 },
    effects: { shadow: 35, blur: 32, offset: 18, reflection: 0 },
    brand: {
      title: "",
      subtitle: "",
      color: "#ffffff",
      size: 32,
      position: "bottom",
      logoId: "",
    },
  };
}

function v1Preset(
  id: string,
  name: string,
  description: string,
  category: V1Preset["category"],
  change: (c: V1Composition) => void,
): V1Preset {
  const composition = createV1Composition();
  change(composition);
  return { id, name, description, category, composition };
}

export const V1_PRESETS: V1Preset[] = [
  v1Preset("clean-hero", "Clean Hero", "A little room for your best work.", "desktop", () => {}),
  v1Preset("soft-studio", "Soft Studio", "Warm tones. A quiet floating canvas.", "desktop", (c) => {
    c.frame.type = "none";
    c.background.color = "#eadbd1";
    c.background.secondColor = "#f8eee6";
    c.motion.type = "drift";
    c.scale = 75;
  }),
  v1Preset("midnight-rows", "Midnight Rows", "Your portfolio, moving in rhythm.", "desktop", (c) => {
    c.layout = "rows";
    c.frame.type = "rounded";
    c.frame.appearance = "dark";
    c.background.type = "spotlight";
    c.background.color = "#171b25";
    c.background.secondColor = "#424765";
    c.motion.type = "glide";
    c.motion.amount = 22;
    c.scale = 85;
    c.spacing = 22;
  }),
  v1Preset("gallery-wall", "Gallery Wall", "A collection with space to breathe.", "desktop", (c) => {
    c.layout = "grid";
    c.frame.type = "rounded";
    c.background.color = "#d6dde3";
    c.background.secondColor = "#edf0f1";
    c.motion.type = "drift";
    c.scale = 80;
    c.spacing = 22;
  }),
  v1Preset(
    "angled-gallery",
    "Angled Gallery",
    "A fresh angle on the whole collection.",
    "desktop",
    (c) => {
      c.layout = "rows";
      c.frame.type = "browser";
      c.rotation = -10;
      c.background.color = "#b3b7c5";
      c.background.secondColor = "#f7dbc0";
      c.motion.type = "glide";
      c.motion.amount = 18;
      c.scale = 82;
    },
  ),
  v1Preset(
    "phone-columns",
    "Phone Columns",
    "Mobile designs in gentle counterflow.",
    "mobile",
    (c) => {
      c.layout = "columns";
      c.frame.type = "phone";
      c.background.color = "#d5dce5";
      c.background.secondColor = "#e8e9f0";
      c.motion.type = "glide";
      c.motion.amount = 18;
      c.scale = 80;
      c.count = 2;
    },
  ),
  v1Preset("phone-spotlight", "Phone Spotlight", "One screen. All the attention.", "mobile", (c) => {
    c.frame.type = "phone";
    c.background.type = "spotlight";
    c.background.color = "#201b37";
    c.background.secondColor = "#a493e8";
    c.background.intensity = 75;
    c.motion.type = "drift";
    c.scale = 82;
  }),
  v1Preset(
    "responsive-pair",
    "Responsive Pair",
    "Desktop and mobile, side by side.",
    "mixed",
    (c) => {
      c.layout = "pair";
      c.background.color = "#dce0e8";
      c.background.secondColor = "#f4f1ef";
      c.motion.type = "drift";
      c.scale = 82;
    },
  ),
];

export function createV1Project(): V1Project {
  return {
    version: 1,
    name: "Untitled project",
    presetId: "clean-hero",
    customized: false,
    aspectRatio: "16:9",
    composition: createV1Composition(),
    images: [],
    exportSettings: {
      resolution: 1080,
      fps: 30,
      quality: "high",
      format: "mp4",
    },
  };
}
