import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Browser } from "@playwright/test";
import sharp from "sharp";
import { launchBrowser, preparePage, recordSectionBoundaries } from "./capture";

/** A page of a demo site. `home` is the site's index page; its files keep their original names. */
interface DemoPageSpec {
  id: string;
  /** Path under the site's folder in `demo-sites/`; empty for the index page. */
  path: string;
}

interface DemoSiteSpec {
  id: string;
  name: string;
  pages: DemoPageSpec[];
}

const HOME: DemoPageSpec = { id: "home", path: "" };

const SITES: DemoSiteSpec[] = [
  {
    id: "aurelia",
    name: "Aurelia",
    // Site Tour and Responsive Tour show these pages of one site; Before & After shows the
    // earlier home page next to today's (docs/presets-2-plan, D14).
    pages: [
      HOME,
      { id: "works", path: "works.html" },
      { id: "studio", path: "studio.html" },
      { id: "journal", path: "journal.html" },
      { id: "home-before", path: "home-before.html" },
    ],
  },
  { id: "northwind", name: "Northwind", pages: [HOME] },
  { id: "maison-oak", name: "Maison Oak", pages: [HOME] },
  { id: "field-notes", name: "Field Notes", pages: [HOME] },
  { id: "studio-kova", name: "Studio Kova", pages: [HOME] },
];

const MIME_MAP: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};

function startServer(root: string, port = 3456): Promise<http.Server> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let reqPath = decodeURI(req.url || "/").split("?")[0];
      if (reqPath === "/" || !reqPath) reqPath = "/index.html";

      let filePath = path.join(root, reqPath);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, "index.html");
      }

      if (!fs.existsSync(filePath)) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end(`Not found: ${reqPath}`);
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_MAP[ext] || "application/octet-stream";
      res.writeHead(200, {
        "Content-Type": contentType,
        "Cache-Control": "no-cache",
      });
      fs.createReadStream(filePath).pipe(res);
    });

    server.listen(port, () => {
      resolve(server);
    });
  });
}

export interface DemoManifestEntry {
  site: string;
  /** Absent for a site's home page, so the original entries keep their shape. */
  page?: string;
  file: string;
  role: "hero" | "full";
  tall: boolean;
  width: number;
  height: number;
  category: "desktop" | "mobile";
  sizeBytes: number;
}

interface CaptureSpec {
  category: "desktop" | "mobile";
  role: "hero" | "full";
  viewport: { width: number; height: number };
  deviceScaleFactor: number;
  /** The sections file written next to a full-page capture. */
  sectionsFile?: string;
}

// Desktop hero 1440 × 900 @2x, desktop full page 1440 wide @1x, mobile 390 × 844 @2x.
const CAPTURES: CaptureSpec[] = [
  {
    category: "desktop",
    role: "hero",
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  },
  {
    category: "desktop",
    role: "full",
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    sectionsFile: "sections.json",
  },
  {
    category: "mobile",
    role: "hero",
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  },
  {
    category: "mobile",
    role: "full",
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    // Responsive Scroll stops both screens on the same section.
    sectionsFile: "sections-mobile.json",
  },
];

const entryKey = (e: Pick<DemoManifestEntry, "site" | "page" | "category" | "role">) =>
  `${e.site}/${e.page ?? HOME.id}/${e.category}/${e.role}`;

/**
 * Replaces the entries that were captured again in place and inserts new ones after the last
 * entry of their site, so recapturing some pages leaves every other entry as it was.
 */
export function mergeManifest(
  existing: DemoManifestEntry[],
  captured: DemoManifestEntry[],
): DemoManifestEntry[] {
  const merged = [...existing];
  for (const entry of captured) {
    const at = merged.findIndex((e) => entryKey(e) === entryKey(entry));
    if (at >= 0) {
      merged[at] = entry;
      continue;
    }
    const lastOfSite = merged.map((e) => e.site).lastIndexOf(entry.site);
    merged.splice(lastOfSite >= 0 ? lastOfSite + 1 : merged.length, 0, entry);
  }
  return merged;
}

/** `--site <id>` and `--page <id>`, each repeatable, limit the capture. Neither means all. */
function parseFilters(argv: string[]): { sites: string[]; pages: string[] } {
  const sites: string[] = [];
  const pages: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag !== "--site" && flag !== "--page") throw new Error(`Unknown argument: ${flag}`);
    if (!value || value.startsWith("--")) throw new Error(`${flag} needs a value`);
    (flag === "--site" ? sites : pages).push(value);
    i++;
  }
  for (const site of sites) {
    if (!SITES.some((s) => s.id === site)) throw new Error(`Unknown demo site: ${site}`);
  }
  for (const page of pages) {
    const known = SITES.some(
      (s) => (sites.length === 0 || sites.includes(s.id)) && s.pages.some((p) => p.id === page),
    );
    if (!known) throw new Error(`No selected demo site has a page "${page}"`);
  }
  return { sites, pages };
}

async function capturePage(
  browser: Browser,
  url: string,
  outDir: string,
  spec: CaptureSpec,
): Promise<{ file: string; width: number; height: number; sizeBytes: number }> {
  const mobile = spec.category === "mobile";
  const ctx = await browser.newContext({
    viewport: spec.viewport,
    deviceScaleFactor: spec.deviceScaleFactor,
    reducedMotion: "reduce",
    ...(mobile ? { isMobile: true, hasTouch: true } : {}),
  });
  try {
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: "networkidle" });
    await preparePage(page, { unstick: spec.role === "full" });

    if (spec.sectionsFile) {
      const sections = await recordSectionBoundaries(
        page,
        spec.viewport.width,
        spec.deviceScaleFactor,
      );
      fs.writeFileSync(
        path.join(outDir, spec.sectionsFile),
        JSON.stringify(sections, null, 2),
        "utf-8",
      );
      console.log(`  -> Recorded ${sections.sections.length} sections in ${spec.sectionsFile}`);
    }

    const rawPng = await page.screenshot({ fullPage: spec.role === "full" });
    const file = `${spec.category}-${spec.role}.webp`;
    const webpPath = path.join(outDir, file);
    await sharp(rawPng).webp({ quality: 92 }).toFile(webpPath);

    const meta = await sharp(webpPath).metadata();
    if (!meta.width || !meta.height) throw new Error(`${webpPath}: sharp reported no size`);
    const sizeBytes = fs.statSync(webpPath).size;
    console.log(
      `  -> Saved ${file}: ${meta.width}x${meta.height}, ${(sizeBytes / 1024).toFixed(1)} KB`,
    );
    return { file, width: meta.width, height: meta.height, sizeBytes };
  } finally {
    await ctx.close();
  }
}

export async function runDemoCapture(argv: string[] = []) {
  const filters = parseFilters(argv);
  const rootDir = path.resolve("demo-sites");
  const publicDemoDir = path.resolve("public/demo");
  const manifestPath = path.join(publicDemoDir, "manifest.json");
  fs.mkdirSync(publicDemoDir, { recursive: true });

  const port = 3591;
  const server = await startServer(rootDir, port);
  console.log(`[Demo Capture] Local server listening on http://localhost:${port}`);

  const browser = await launchBrowser();
  const captured: DemoManifestEntry[] = [];

  try {
    for (const site of SITES) {
      if (filters.sites.length > 0 && !filters.sites.includes(site.id)) continue;
      for (const demoPage of site.pages) {
        if (filters.pages.length > 0 && !filters.pages.includes(demoPage.id)) continue;
        const isHome = demoPage.id === HOME.id;
        console.log(`\n[Demo Capture] ${site.name} (${site.id}), page ${demoPage.id}`);

        // A home page's files sit in the site's folder; any other page's in a folder of its own.
        const folder = isHome ? site.id : `${site.id}/${demoPage.id}`;
        const outDir = path.join(publicDemoDir, folder);
        fs.mkdirSync(outDir, { recursive: true });
        const url = `http://localhost:${port}/${site.id}/${demoPage.path}`;

        for (const spec of CAPTURES) {
          const shot = await capturePage(browser, url, outDir, spec);
          captured.push({
            site: site.id,
            ...(isHome ? {} : { page: demoPage.id }),
            file: `${folder}/${shot.file}`,
            role: spec.role,
            tall: spec.role === "full",
            width: shot.width,
            height: shot.height,
            category: spec.category,
            sizeBytes: shot.sizeBytes,
          });
        }
      }
    }
    if (captured.length === 0) throw new Error("Nothing matched --site and --page");

    const existing: DemoManifestEntry[] = fs.existsSync(manifestPath)
      ? JSON.parse(fs.readFileSync(manifestPath, "utf-8"))
      : [];
    const manifest = mergeManifest(existing, captured);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
    const totalBytes = manifest.reduce((sum, e) => sum + e.sizeBytes, 0);
    console.log(`\n[Demo Capture] Manifest written to: ${manifestPath}`);
    console.log(`[Demo Capture] Captured ${captured.length}; manifest holds ${manifest.length}`);
    console.log(
      `[Demo Capture] Total size: ${(totalBytes / (1024 * 1024)).toFixed(2)} MB (Budget: <= 14 MB)`,
    );
  } finally {
    await browser.close();
    server.close();
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
) {
  runDemoCapture(process.argv.slice(2)).catch((err) => {
    console.error("[Demo Capture Error]", err);
    process.exit(1);
  });
}
