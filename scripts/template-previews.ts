import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { BUILTIN_TEMPLATES } from "../src/templates";

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

function startStaticServer(root: string, port = 3789): Promise<http.Server> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const parsed = decodeURI(req.url || "/").split("?")[0];
      let filePath = path.join(root, parsed === "/" ? "index.html" : parsed);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, "index.html");
      }

      if (!fs.existsSync(filePath)) {
        // Fallback for public demo assets
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

export async function generateTemplatePreviews() {
  const outDir = path.resolve("public/templates");
  fs.mkdirSync(outDir, { recursive: true });

  const port = 3789;
  const server = await startStaticServer(path.resolve("dist"), port);
  console.log(`[Template Previews] Server listening on http://localhost:${port}`);

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--use-gl=angle", "--use-angle=swiftshader"],
  });

  try {
    for (const template of BUILTIN_TEMPLATES) {
      console.log(`\nGenerating preview for template: ${template.name} (${template.id})...`);
      const posterPath = path.join(outDir, `${template.id}.webp`);
      const videoPath = path.join(outDir, `${template.id}.webm`);

      const ctx = await browser.newContext({
        viewport: { width: 640, height: 360 },
        deviceScaleFactor: 1,
      });
      const page = await ctx.newPage();

      try {
        await page.goto(`http://localhost:${port}/lab/?fixture=${template.id}&t=1.5`, {
          waitUntil: "domcontentloaded",
        });

        // Wait for __labReady
        await page.waitForFunction(() => window.__labReady === true, { timeout: 10000 });
        await page.waitForTimeout(600);

        // Take snapshot of canvas for poster
        const canvas = page.locator("canvas").first();
        if ((await canvas.count()) > 0) {
          const pngBuffer = await canvas.screenshot();
          await sharp(pngBuffer).webp({ quality: 85 }).toFile(posterPath);
          console.log(`  -> Saved poster: ${template.id}.webp`);
        } else {
          throw new Error(`Canvas missing while generating ${template.id} poster`);
        }

        if (!fs.existsSync(videoPath)) {
          console.info(
            `No video preview produced for ${template.id}; poster generation succeeded.`,
          );
        }
      } catch (err) {
        console.error(`Failed to generate preview for ${template.id}:`, err);
        throw err;
      } finally {
        await ctx.close();
      }
    }

    console.log(
      `\n[Template Previews] All 12 template previews generated successfully in ${outDir}!`,
    );
  } finally {
    await browser.close();
    server.close();
  }
}

// Auto-run if executed directly
if (process.argv[1] && process.argv[1].includes("template-previews")) {
  generateTemplatePreviews().catch((err) => {
    console.error("[Template Previews Error]", err);
    process.exit(1);
  });
}
