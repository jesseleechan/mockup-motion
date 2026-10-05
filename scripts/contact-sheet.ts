import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { BUILTIN_TEMPLATES } from "../src/templates";
import type { Aspect } from "../src/doc/types";

const MIME_MAP: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".json": "application/json",
};

function startStaticServer(root: string, port = 3790): Promise<http.Server> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const parsed = decodeURI(req.url || "/").split("?")[0];
      let filePath = path.join(root, parsed === "/" ? "index.html" : parsed);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, "index.html");
      }

      if (!fs.existsSync(filePath)) {
        const publicPath = path.join(path.resolve("public"), parsed);
        if (fs.existsSync(publicPath) && !fs.statSync(publicPath).isDirectory()) {
          filePath = publicPath;
        } else {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end(`Not found: ${parsed}`);
          return;
        }
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_MAP[ext] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-cache" });
      fs.createReadStream(filePath).pipe(res);
    });

    server.listen(port, () => resolve(server));
  });
}

export async function generateContactSheet() {
  const outDir = path.resolve("contact-sheet");
  fs.mkdirSync(outDir, { recursive: true });

  const port = 3790;
  const server = await startStaticServer(path.resolve("dist"), port);
  console.log(`[Contact Sheet] Server listening on http://localhost:${port}`);

  const aspects: Aspect[] = ["16:9", "9:16", "1:1", "4:5", "4:3"];
  const timeFractions = [0.1, 0.35, 0.6, 0.85];

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--use-gl=angle", "--use-angle=swiftshader"],
  });

  const manifest: {
    templateId: string;
    templateName: string;
    aspect: Aspect;
    tFrac: number;
    filePath: string;
  }[] = [];

  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1,
    });

    for (const template of BUILTIN_TEMPLATES) {
      console.log(`\nRendering contact sheet for ${template.name}...`);
      const totalDuration = template.defaultDuration;

      for (const aspect of aspects) {
        for (const frac of timeFractions) {
          const t = Math.round(frac * totalDuration * 100) / 100;
          const fileName = `${template.id}_${aspect.replace(":", "-")}_t${Math.round(frac * 100)}.png`;
          const filePath = path.join(outDir, fileName);

          try {
            await page.goto(
              `http://localhost:${port}/lab/?fixture=${template.id}&aspect=${encodeURIComponent(aspect)}&t=${t}`,
              { waitUntil: "domcontentloaded" },
            );

            await page.waitForFunction(() => window.__labReady === true, { timeout: 8000 }).catch(() => {});
            await page.waitForTimeout(400);

            const canvas = page.locator("canvas").first();
            if (await canvas.count() > 0) {
              const buffer = await canvas.screenshot();
              await sharp(buffer).png().toFile(filePath);
            } else {
              const buffer = await page.screenshot();
              await sharp(buffer).png().toFile(filePath);
            }

            manifest.push({
              templateId: template.id,
              templateName: template.name,
              aspect,
              tFrac: frac,
              filePath: fileName,
            });
          } catch (err) {
            console.warn(`Failed snapshot for ${template.id} ${aspect} t=${t}:`, err);
          }
        }
      }
    }

    // Build index.html
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>MockupMotion - Template Contact Sheet</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f1115; color: #f1f3f5; margin: 0; padding: 24px; }
    h1 { font-size: 24px; margin-bottom: 8px; }
    p { color: #9ca3af; font-size: 14px; margin-top: 0; margin-bottom: 24px; }
    .template-section { margin-bottom: 48px; border-bottom: 1px solid #232730; padding-bottom: 32px; }
    .template-title { font-size: 18px; font-weight: 600; margin-bottom: 16px; color: #60a5fa; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
    .card { background: #181a20; border: 1px solid #2a2e39; border-radius: 8px; overflow: hidden; }
    .card img { width: 100%; height: auto; display: block; }
    .card-meta { padding: 8px 12px; font-size: 12px; color: #9ca3af; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <h1>Template Contact Sheet</h1>
  <p>12 Templates × 5 Aspects × 4 Keyframe Intervals (t ∈ {0.1, 0.35, 0.6, 0.85}·total)</p>
  ${BUILTIN_TEMPLATES.map((t) => {
    const items = manifest.filter((m) => m.templateId === t.id);
    if (items.length === 0) return "";
    return `
      <div class="template-section">
        <div class="template-title">${t.name} (${t.id}) - ${t.category}</div>
        <div class="grid">
          ${items
            .map(
              (item) => `
            <div class="card">
              <img src="${item.filePath}" alt="${item.templateName} ${item.aspect} t=${item.tFrac}" loading="lazy">
              <div class="card-meta">
                <span>Aspect: <strong>${item.aspect}</strong></span>
                <span>t = ${(item.tFrac * 100).toFixed(0)}%</span>
              </div>
            </div>
          `,
            )
            .join("")}
        </div>
      </div>
    `;
  }).join("")}
</body>
</html>`;

    fs.writeFileSync(path.join(outDir, "index.html"), html, "utf-8");
    console.log(`\n[Contact Sheet] Complete! Written to ${outDir}/index.html (${manifest.length} frames)`);
  } finally {
    await browser.close();
    server.close();
  }
}

if (process.argv[1] && process.argv[1].includes("contact-sheet")) {
  generateContactSheet().catch((err) => {
    console.error("[Contact Sheet Error]", err);
    process.exit(1);
  });
}
