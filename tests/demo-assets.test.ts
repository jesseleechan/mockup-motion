import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { collectAssetIds, layoutAssetIds } from "../src/doc/assets";
import type { ProjectDoc } from "../src/doc/types";
import { createLabAssetProvider, resolveLabAssetUrl } from "../src/lab/asset-provider";
import { DEMO_ASSETS, demoAsset } from "../src/lab/demo-assets";
import { VISUAL_FIXTURES } from "../src/lab/visual-fixtures";
import { BUILTIN_TEMPLATES, buildTemplatePreviewDoc } from "../src/templates";

const PUBLIC_DIR = path.resolve("public");
const FIXTURE_DIR = path.resolve("src/lab/fixtures");

const sizeCache = new Map<string, Promise<{ width: number; height: number }>>();

function realSize(url: string): Promise<{ width: number; height: number }> {
  let size = sizeCache.get(url);
  if (!size) {
    size = sharp(path.join(PUBLIC_DIR, url))
      .metadata()
      .then(({ width, height }) => {
        if (!width || !height) throw new Error(`${url}: sharp reported no size`);
        return { width, height };
      });
    sizeCache.set(url, size);
  }
  return size;
}

function jsonFixtures(): Record<string, ProjectDoc> {
  const out: Record<string, ProjectDoc> = {};
  for (const file of fs.readdirSync(FIXTURE_DIR).filter((f) => f.endsWith(".json"))) {
    out[`fixtures/${file}`] = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, file), "utf8"));
  }
  return out;
}

const DOCS: Record<string, ProjectDoc> = {
  ...Object.fromEntries(
    BUILTIN_TEMPLATES.map((t) => [`template ${t.id}`, buildTemplatePreviewDoc(t)]),
  ),
  ...jsonFixtures(),
  ...Object.fromEntries(Object.entries(VISUAL_FIXTURES).map(([k, d]) => [`visual ${k}`, d])),
};

/** Every problem with a document's image assets: unresolvable ids and false sizes. */
async function assetProblems(doc: ProjectDoc): Promise<string[]> {
  const problems: string[] = [];
  const declared = new Map(doc.assets.map((a) => [a.id, a]));
  const ids = new Set([
    ...doc.assets.filter((a) => a.kind === "image").map((a) => a.id),
    ...collectAssetIds(doc),
  ]);
  for (const id of ids) {
    const demo = DEMO_ASSETS.get(id);
    if (!demo) {
      problems.push(`${id}: not in the demo map`);
      continue;
    }
    const file = path.join(PUBLIC_DIR, demo.url);
    if (!fs.existsSync(file)) {
      problems.push(`${id}: ${demo.url} does not exist`);
      continue;
    }
    const ref = declared.get(id);
    if (!ref) {
      problems.push(`${id}: drawn but not declared in doc.assets`);
      continue;
    }
    const real = await realSize(demo.url);
    if (ref.width !== real.width || ref.height !== real.height) {
      problems.push(
        `${id}: declared ${ref.width}x${ref.height}, file is ${real.width}x${real.height}`,
      );
    }
    if (ref.role !== demo.role) problems.push(`${id}: declared role ${ref.role}, is ${demo.role}`);
  }
  return problems;
}

describe("F04 demo asset map", () => {
  it("covers all 20 manifest captures with the true file sizes", async () => {
    expect(DEMO_ASSETS.size).toBe(20);
    const wrong: string[] = [];
    for (const asset of DEMO_ASSETS.values()) {
      const real = await realSize(asset.url);
      if (asset.width !== real.width || asset.height !== real.height) {
        wrong.push(`${asset.id}: ${asset.width}x${asset.height} vs ${real.width}x${real.height}`);
      }
    }
    expect(wrong).toEqual([]);
    expect(demoAsset("demo-northwind-mobile-full")).toMatchObject({ width: 780, height: 15006 });
  });

  it.each(Object.keys(DOCS))(
    "%s: every asset resolves to a real file of its declared size",
    async (key) => {
      expect(await assetProblems(DOCS[key])).toEqual([]);
    },
  );

  it("the lab provider rejects unknown ids instead of substituting an image", async () => {
    expect(() => resolveLabAssetUrl("demo-aurelia")).toThrow("Unknown demo asset: demo-aurelia");
    await expect(createLabAssetProvider().getImage("nope", 640)).rejects.toThrow(
      "Unknown demo asset: nope",
    );
    expect(resolveLabAssetUrl("demo-studio-kova-desktop-full")).toBe(
      "/demo/studio-kova/desktop-full.webp",
    );
    expect(resolveLabAssetUrl("/demo/aurelia.png")).toBe("/demo/aurelia.png");
    expect(resolveLabAssetUrl("blob:http://localhost/abc")).toBe("blob:http://localhost/abc");
  });
});

describe("F04 template previews use varied demo sites", () => {
  const screens = (templateId: string) => {
    const doc = buildTemplatePreviewDoc(BUILTIN_TEMPLATES.find((t) => t.id === templateId)!);
    return doc.shots.flatMap((s) => layoutAssetIds(s.layout)).map(demoAsset);
  };
  const sites = (templateId: string) => new Set(screens(templateId).map((a) => a.site));

  it.each(["portfolio-rows", "isometric-wall", "cascade-stack"])(
    "%s shows 4+ different desktop sites",
    (id) => {
      expect(screens(id).every((a) => a.role === "desktop")).toBe(true);
      expect(sites(id).size).toBeGreaterThanOrEqual(4);
    },
  );

  it("phone-parade shows 4+ different mobile sites", () => {
    expect(screens("phone-parade").every((a) => a.role === "mobile")).toBe(true);
    expect(sites("phone-parade").size).toBeGreaterThanOrEqual(4);
  });

  it.each(["responsive-pair", "responsive-trio"])("%s shows one site on every device", (id) => {
    const roles = new Set(screens(id).map((a) => a.role));
    expect(roles).toEqual(new Set(["desktop", "mobile"]));
    expect(sites(id).size).toBe(1);
  });

  it("scroll-story scrolls a full-page desktop capture", () => {
    const [screen] = screens("scroll-story");
    expect(screen).toMatchObject({ role: "desktop", capture: "full", tall: true });
  });
});
