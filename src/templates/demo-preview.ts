import type { AssetRef, ProjectDoc } from "../doc/types";
import { createDoc } from "../doc/defaults";
import type { Template } from "./types";
import { fillSlots } from "./slots";

export const DEMO_PREVIEW_ASSETS: AssetRef[] = [
  {
    id: "demo-aurelia-desktop-full",
    name: "Aurelia Studio Desktop",
    kind: "image",
    mime: "image/webp",
    bytes: 367382,
    role: "desktop",
    width: 1440,
    height: 4300,
    meta: { tall: true },
  },
  {
    id: "demo-aurelia-desktop-hero",
    name: "Aurelia Hero",
    kind: "image",
    mime: "image/webp",
    bytes: 348640,
    role: "desktop",
    width: 2880,
    height: 1800,
    meta: { tall: false },
  },
  {
    id: "demo-aurelia-mobile-full",
    name: "Aurelia Mobile Full",
    kind: "image",
    mime: "image/webp",
    bytes: 482306,
    role: "mobile",
    width: 780,
    height: 13372,
    meta: { tall: true },
  },
  {
    id: "demo-aurelia-mobile-hero",
    name: "Aurelia Mobile Hero",
    kind: "image",
    mime: "image/webp",
    bytes: 159248,
    role: "mobile",
    width: 780,
    height: 1688,
    meta: { tall: false },
  },
  {
    id: "demo-northwind-desktop",
    name: "Northwind Studio",
    kind: "image",
    mime: "image/webp",
    bytes: 269130,
    role: "desktop",
    width: 1440,
    height: 4052,
    meta: { tall: true },
  },
  {
    id: "demo-northwind-mobile",
    name: "Northwind Mobile",
    kind: "image",
    mime: "image/webp",
    bytes: 553414,
    role: "mobile",
    width: 780,
    height: 5000,
    meta: { tall: true },
  },
  {
    id: "demo-maison-desktop",
    name: "Maison Oak",
    kind: "image",
    mime: "image/webp",
    bytes: 285688,
    role: "desktop",
    width: 1440,
    height: 3519,
    meta: { tall: true },
  },
  {
    id: "demo-fieldnotes-desktop",
    name: "Field Notes",
    kind: "image",
    mime: "image/webp",
    bytes: 477240,
    role: "desktop",
    width: 1440,
    height: 4261,
    meta: { tall: true },
  },
  {
    id: "demo-studiokova-desktop",
    name: "Studio Kova",
    kind: "image",
    mime: "image/webp",
    bytes: 254500,
    role: "desktop",
    width: 1440,
    height: 4365,
    meta: { tall: true },
  },
];

export function buildTemplatePreviewDoc(template: Template): ProjectDoc {
  const slots = fillSlots(template, DEMO_PREVIEW_ASSETS);
  const built = template.build({
    aspect: "16:9",
    slots,
    projectName: template.name,
  });

  const base = createDoc();
  return {
    ...base,
    name: template.name,
    aspect: "16:9",
    templateId: template.id,
    assets: DEMO_PREVIEW_ASSETS,
    style: built.style,
    shots: built.shots,
    loop: built.loop,
  };
}
