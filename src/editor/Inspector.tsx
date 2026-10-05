import { RotateCcw } from "lucide-react";
import type { Composition, Project } from "../types";
import { canScroll, chooseImages } from "../rendering/geometry";
import { Section, Select, Slider, Toggle, Segments, TextField } from "./Controls";
import { createComposition } from "../presets/presets";
const PALETTES = [
  ["#b8b0fa", "#fff3e5"],
  ["#e6d1c2", "#fff5e9"],
  ["#d6b6fa", "#f3e8fc"],
  ["#9fc5ff", "#e8f0ff"],
  ["#171b25", "#454667"],
];
const opts = (values: [string, string][]) => values.map(([value, label]) => ({ value, label }));
export function Inspector({
  project,
  change,
  begin,
  end,
  reset,
  onImageCrop,
}: {
  project: Project;
  change: (c: Partial<Composition>) => void;
  begin: () => void;
  end: () => void;
  reset: () => void;
  onImageCrop: (id: string, value: number) => void;
}) {
  const c = project.composition,
    defaults = createComposition();
  const slider = (
    label: string,
    value: number,
    min: number,
    max: number,
    onChange: (v: number) => void,
    unit = "",
    step = 1,
  ) => <Slider {...{ label, value, min, max, onChange, unit, step, begin, end }} />;
  const group = <K extends keyof Composition>(key: K, patch: Partial<Composition[K]>) =>
    change({
      [key]: { ...(c[key] as object), ...(patch as object) },
    } as Partial<Composition>);
  const assetOptions = [
    { value: "", label: "Choose screenshot" },
    ...project.images.map((i) => ({ value: i.id, label: i.name })),
  ];
  const scrollable = canScroll(c, project.images);
  const cropImage = chooseImages(c, project.images).primary;
  return (
    <aside className="inspector" aria-label="Composition settings">
      <div className="panel-heading">
        <h2>Make it yours</h2>
        <button className="subtle-button" onClick={reset}>
          <RotateCcw size={13} />
          Reset
        </button>
      </div>
      <Section
        title="Layout"
        open
        onReset={() => change({ scale: 78, spacing: 24, rotation: 0, alignment: "center" })}
      >
        <Select
          label="Layout"
          value={c.layout}
          options={opts([
            ["hero", "Single frame"],
            ["rows", "Screenshot rows"],
            ["grid", "Gallery grid"],
            ["columns", "Phone columns"],
            ["pair", "Responsive pair"],
          ])}
          onChange={(v) =>
            change({
              layout: v as Composition["layout"],
              contentMotion: { ...c.contentMotion, enabled: false },
            })
          }
        />
        {slider("Composition size", c.scale, 35, 110, (v) => change({ scale: v }), "%")}
        {c.layout !== "hero" &&
          slider("Spacing", c.spacing, 0, 100, (v) => change({ spacing: v }), "px")}
        {["rows", "grid", "columns"].includes(c.layout) &&
          slider(c.layout === "rows" ? "Rows" : "Columns", c.count, 1, 4, (v) =>
            change({ count: v }),
          )}
        <details className="advanced">
          <summary>More layout settings</summary>
          {slider("Rotation", c.rotation, -20, 20, (v) => change({ rotation: v }), "°")}
          <Segments
            label="Alignment"
            value={c.alignment}
            options={opts([
              ["left", "Left"],
              ["center", "Center"],
              ["right", "Right"],
            ])}
            onChange={(v) => change({ alignment: v as Composition["alignment"] })}
          />
        </details>
        {c.layout === "hero" && (
          <Select
            label="Screenshot"
            value={c.assetIds.primary}
            options={[{ value: "", label: "First compatible image" }, ...assetOptions.slice(1)]}
            onChange={(v) => group("assetIds", { primary: v })}
          />
        )}
        {c.layout === "pair" && (
          <>
            <Select
              label="Desktop screenshot"
              value={c.assetIds.primary}
              options={assetOptions}
              onChange={(v) => group("assetIds", { primary: v })}
            />
            <Select
              label="Mobile screenshot"
              value={c.assetIds.mobile}
              options={assetOptions}
              onChange={(v) => group("assetIds", { mobile: v })}
            />
            <p className="control-hint">Assign the desktop and mobile versions of your design.</p>
          </>
        )}
      </Section>
      <Section title="Frame" open onReset={() => group("frame", defaults.frame)}>
        {c.layout !== "pair" && c.layout !== "columns" && (
          <Segments
            label="Frame style"
            value={c.frame.type}
            options={opts([
              ["browser", "Browser"],
              ["rounded", "Rounded"],
              ["none", "None"],
              ["phone", "Phone"],
            ])}
            onChange={(v) => group("frame", { type: v as Composition["frame"]["type"] })}
          />
        )}
        <details className="advanced">
          <summary>Frame details</summary>
          <Segments
            label="Frame appearance"
            value={c.frame.appearance}
            options={opts([
              ["light", "Light"],
              ["dark", "Dark"],
            ])}
            onChange={(v) => group("frame", { appearance: v as "light" | "dark" })}
          />
          {c.frame.type === "phone" || c.layout === "columns" || c.layout === "pair" ? (
            <>
              <Select
                label="Device finish"
                value={c.frame.finish}
                options={opts([
                  ["titanium", "Titanium"],
                  ["midnight", "Midnight"],
                  ["silver", "Silver"],
                  ["gold", "Gold"],
                ])}
                onChange={(v) =>
                  group("frame", {
                    finish: v as Composition["frame"]["finish"],
                  })
                }
              />
              <Toggle
                label="Status details"
                checked={c.frame.status}
                onChange={(v) => group("frame", { status: v })}
              />
            </>
          ) : (
            <>
              {slider(
                "Corner radius",
                c.frame.radius,
                0,
                40,
                (v) => group("frame", { radius: v }),
                "px",
              )}
              {slider(
                "Border width",
                c.frame.border,
                0,
                5,
                (v) => group("frame", { border: v }),
                "px",
              )}
              <TextField
                label="Browser title"
                value={c.frame.title}
                placeholder="yourwebsite.com"
                onChange={(v) => group("frame", { title: v })}
              />
            </>
          )}
        </details>
      </Section>
      <Section title="Screenshot" onReset={() => group("image", defaults.image)}>
        <Segments
          label="Image fit"
          value={c.image.fit}
          options={opts([
            ["cover", "Fill frame"],
            ["contain", "Fit image"],
          ])}
          onChange={(v) => group("image", { fit: v as "cover" | "contain" })}
        />
        {slider(
          "Crop position",
          cropImage?.crop ?? c.image.crop,
          0,
          100,
          (v) => (cropImage ? onImageCrop(cropImage.id, v) : group("image", { crop: v })),
          "%",
        )}
        <p className="control-hint">
          Choose the visible part of tall screenshots. Content stays still.
        </p>
      </Section>
      <Section title="Background" open onReset={() => group("background", defaults.background)}>
        <Segments
          label="Background style"
          value={c.background.type}
          options={opts([
            ["solid", "Solid"],
            ["gradient", "Gradient"],
            ["spotlight", "Studio"],
            ["image", "Image"],
          ])}
          onChange={(v) =>
            group("background", {
              type: v as Composition["background"]["type"],
            })
          }
        />
        <div className="palette-row">
          {PALETTES.map(([color, secondColor]) => (
            <button
              key={color}
              aria-label={`Use ${color} palette`}
              aria-pressed={c.background.color === color}
              className={c.background.color === color ? "active" : ""}
              style={{
                background: `linear-gradient(135deg,${color},${secondColor})`,
              }}
              onClick={() => group("background", { color, secondColor })}
            />
          ))}
          <label className="custom-color" title="Custom background color">
            +
            <input
              aria-label="Background color"
              type="color"
              value={c.background.color}
              onChange={(e) => group("background", { color: e.target.value })}
            />
          </label>
        </div>
        {c.background.type === "image" ? (
          <Select
            label="Background image"
            value={c.background.imageId}
            options={assetOptions}
            onChange={(v) => group("background", { imageId: v })}
          />
        ) : (
          <>
            <div
              className="gradient-preview"
              style={{
                background: `linear-gradient(${c.background.angle}deg,${c.background.color},${c.background.secondColor})`,
              }}
            />
            <div className="color-fields">
              <label>
                <input
                  aria-label="First background color"
                  type="color"
                  value={c.background.color}
                  onChange={(e) => group("background", { color: e.target.value })}
                />
                <span>{c.background.color}</span>
              </label>
              {c.background.type !== "solid" && (
                <label>
                  <input
                    aria-label="Second background color"
                    type="color"
                    value={c.background.secondColor}
                    onChange={(e) => group("background", { secondColor: e.target.value })}
                  />
                  <span>{c.background.secondColor}</span>
                </label>
              )}
            </div>
            {c.background.type === "gradient" && (
              <details className="advanced">
                <summary>Gradient settings</summary>
                {slider(
                  "Gradient angle",
                  c.background.angle,
                  0,
                  360,
                  (v) => group("background", { angle: v }),
                  "°",
                )}
              </details>
            )}
            {c.background.type === "spotlight" &&
              slider(
                "Spotlight strength",
                c.background.intensity,
                0,
                100,
                (v) => group("background", { intensity: v }),
                "%",
              )}
          </>
        )}
      </Section>
      <Section title="Motion" open onReset={() => group("motion", defaults.motion)}>
        {slider("Duration", c.motion.duration, 3, 20, (v) => group("motion", { duration: v }), "s")}
        <Select
          label="Motion"
          value={c.motion.type}
          options={opts([
            ["still", "Still"],
            ["drift", "Gentle drift"],
            ["glide", "Slow glide"],
            ["zoom", "Gentle zoom"],
          ])}
          onChange={(v) => group("motion", { type: v as Composition["motion"]["type"] })}
        />
        {c.motion.type !== "still" &&
          slider(
            "Motion amount",
            c.motion.amount,
            0,
            80,
            (v) => group("motion", { amount: v }),
            "%",
          )}
        <details className="advanced">
          <summary>Advanced motion</summary>
          <Segments
            label="Direction"
            value={c.motion.direction}
            options={opts([
              ["forward", "Forward"],
              ["reverse", "Reverse"],
            ])}
            onChange={(v) => group("motion", { direction: v as "forward" | "reverse" })}
          />
          <Select
            label="Easing"
            value={c.motion.easing}
            options={opts([
              ["smooth", "Smooth"],
              ["linear", "Linear"],
            ])}
            onChange={(v) => group("motion", { easing: v as "smooth" | "linear" })}
          />
          {slider(
            "Start / end hold",
            c.motion.hold,
            0,
            Math.min(3, c.motion.duration / 3),
            (v) => group("motion", { hold: v }),
            "s",
            0.1,
          )}
          <Toggle
            label="Scroll within screenshot"
            checked={scrollable && c.contentMotion.enabled}
            disabled={!scrollable}
            onChange={(v) => group("contentMotion", { enabled: v })}
            hint={
              scrollable
                ? "Optional. Off in every built-in preset."
                : "Use a single frame with a tall image and Fill frame to scroll."
            }
          />
          {scrollable && c.contentMotion.enabled && (
            <>
              {slider(
                "Scroll start",
                c.contentMotion.start,
                0,
                100,
                (v) => group("contentMotion", { start: v }),
                "%",
              )}
              {slider(
                "Scroll end",
                c.contentMotion.end,
                0,
                100,
                (v) => group("contentMotion", { end: v }),
                "%",
              )}
              {slider(
                "Scroll hold",
                c.contentMotion.hold,
                0,
                3,
                (v) => group("contentMotion", { hold: v }),
                "s",
                0.1,
              )}
              <p className="control-hint">Loop mode gently returns to the starting crop.</p>
            </>
          )}
        </details>
      </Section>
      <Section title="Effects" onReset={() => group("effects", defaults.effects)}>
        {slider(
          "Shadow strength",
          c.effects.shadow,
          0,
          100,
          (v) => group("effects", { shadow: v }),
          "%",
        )}
        {slider("Shadow blur", c.effects.blur, 0, 70, (v) => group("effects", { blur: v }), "px")}
        {slider(
          "Shadow offset",
          c.effects.offset,
          0,
          50,
          (v) => group("effects", { offset: v }),
          "px",
        )}
        {slider(
          "Reflection",
          c.effects.reflection,
          0,
          100,
          (v) => group("effects", { reflection: v }),
          "%",
        )}
      </Section>
      <Section title="Branding" onReset={() => group("brand", defaults.brand)}>
        <TextField
          label="Title"
          value={c.brand.title}
          placeholder="Your project, beautifully presented."
          onChange={(v) => group("brand", { title: v })}
        />
        <TextField
          label="Subtitle"
          value={c.brand.subtitle}
          placeholder="Designed by you"
          onChange={(v) => group("brand", { subtitle: v })}
        />
        <Select
          label="Position"
          value={c.brand.position}
          options={opts([
            ["top", "Top"],
            ["bottom", "Bottom"],
          ])}
          onChange={(v) => group("brand", { position: v as "top" | "bottom" })}
        />
        {slider("Title size", c.brand.size, 16, 64, (v) => group("brand", { size: v }), "px")}
        <label className="color-label">
          Text color
          <input
            aria-label="Branding color"
            type="color"
            value={c.brand.color}
            onChange={(e) => group("brand", { color: e.target.value })}
          />
        </label>
        <Select
          label="Logo"
          value={c.brand.logoId}
          options={[{ value: "", label: "No logo" }, ...assetOptions.slice(1)]}
          onChange={(v) => group("brand", { logoId: v })}
        />
      </Section>
      <p className="inspector-footer">Made on your device. No watermark.</p>
    </aside>
  );
}
