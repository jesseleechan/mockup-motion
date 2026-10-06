/**
 * Renders the template gallery previews from a production build:
 * `public/templates/<id>.webm` (360p, 24 fps loop) and `public/templates/<id>.webp`
 * (poster, the frame at 35% of the total). Any failure exits non-zero; nothing is
 * ever written as a placeholder.
 *
 *   npm run template-previews
 */
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { ALL_FORMATS, BufferSource, Input } from "mediabunny";
import { build } from "vite";
import { schedule } from "../src/motion";
import { BUILTIN_TEMPLATES, buildTemplatePreviewDoc } from "../src/templates";

const PORT = 3789;
const OUT_DIR = path.resolve("public/templates");
// The build has the lab enabled, so it goes to a scratch directory, never to dist/.
const BUILD_DIR = path.join(os.tmpdir(), "mockupmotion-template-previews");
const WINDOWS_CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const MAX_WEBM_BYTES = 450 * 1024;
const POSTER_TIME_FRACTION = 0.35;
// Posters show until a card is hovered, so they are 2x the video (1280x720) for sharp cards.
const POSTER_RESOLUTION = 720;
const POSTER_WEBP_QUALITY = 82;
const PREVIEW_SETTINGS = {
  resolution: 360,
  fps: 24,
  quality: "web",
  format: "webm",
  supersample: 1,
  motionBlur: false,
} as const;

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".webm": "video/webm",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
};

/** Serves the build; extensionless paths (`/lab`) fall back to index.html like any SPA host. */
function serve(root: string): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
    let filePath = path.join(root, pathname);
    if (!filePath.startsWith(root)) {
      res.writeHead(403).end();
      return;
    }
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      if (path.extname(pathname) !== "") {
        res.writeHead(404, { "Content-Type": "text/plain" }).end(`Not found: ${pathname}`);
        return;
      }
      filePath = path.join(root, "index.html");
    }
    const type = MIME_TYPES[path.extname(filePath).toLowerCase()];
    if (!type) {
      res.writeHead(500, { "Content-Type": "text/plain" }).end(`No MIME type for ${filePath}`);
      return;
    }
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-cache" });
    fs.createReadStream(filePath).pipe(res);
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(PORT, () => resolve(server));
  });
}

interface RenderedTemplate {
  webm: Buffer;
  png: Buffer;
}

interface Row {
  id: string;
  duration: string;
  webmDuration: string;
  webmBytes: number;
  posterBytes: number;
  dimensions: string;
}

/** Reads the encoded file back, so the table reports what was written, not what was asked for. */
async function probeWebm(
  bytes: Buffer,
): Promise<{ width: number; height: number; duration: number }> {
  const input = new Input({ source: new BufferSource(bytes), formats: ALL_FORMATS });
  const track = await input.getPrimaryVideoTrack();
  if (!track) throw new Error("The WebM has no video track");
  return {
    width: track.displayWidth,
    height: track.displayHeight,
    duration: await input.computeDuration(),
  };
}

async function main(): Promise<void> {
  console.log(`Building the app with the lab enabled into ${BUILD_DIR}`);
  process.env.VITE_LAB = "1";
  await build({ logLevel: "warn", build: { outDir: BUILD_DIR, emptyOutDir: true } });

  const server = await serve(BUILD_DIR);
  // `npm run template-previews -- quiet-hero` regenerates a subset.
  const requested = process.argv.slice(2);
  const unknown = requested.filter((id) => !BUILTIN_TEMPLATES.some((t) => t.id === id));
  if (unknown.length > 0) throw new Error(`Unknown template ids: ${unknown.join(", ")}`);
  const templates =
    requested.length === 0
      ? BUILTIN_TEMPLATES
      : BUILTIN_TEMPLATES.filter((t) => requested.includes(t.id));
  // Same browser choice as playwright.config.ts: an explicit executable, else installed
  // Chrome on Windows, else Playwright's Chromium.
  const executablePath = process.env.PW_CHROMIUM_EXECUTABLE;
  const useChrome = process.platform === "win32" && fs.existsSync(WINDOWS_CHROME);
  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : useChrome ? { channel: "chrome" } : {}),
    args: [
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--ignore-gpu-blocklist",
    ],
  });

  const rows: Row[] = [];
  try {
    const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") pageErrors.push(msg.text());
    });

    await page.goto(`http://localhost:${PORT}/lab?fixture=card-hero`);
    await page.waitForFunction(() => window.__labReady === true || Boolean(window.__labError), {
      timeout: 60_000,
    });
    const labError = await page.evaluate(() => window.__labError);
    if (labError) throw new Error(`The lab failed to start: ${labError}`);

    fs.mkdirSync(OUT_DIR, { recursive: true });
    for (const template of templates) {
      const doc = buildTemplatePreviewDoc(template);
      const { total } = schedule(doc);
      const started = Date.now();
      process.stdout.write(`Rendering ${template.id} (${total.toFixed(2)} s)... `);

      const rendered = await page.evaluate(
        async ({ id, settings, posterTime, posterResolution }) => {
          const fixture = window.__fixtures?.[id];
          const exportVideo = window.__exportWithEngine;
          const exportFrame = window.__exportCurrentFrame;
          const createProvider = window.__createLabAssetProvider;
          if (!fixture || !exportVideo || !exportFrame || !createProvider) {
            throw new Error(`Lab hooks are missing for ${id}`);
          }
          const doc = structuredClone(fixture);
          doc.export = { ...doc.export, ...settings };
          // Grain is new noise every frame, which VP9 cannot compress: at 360p it more than
          // quadruples the file (phone-spotlight: 633 KB with grain, 145 KB without) and is
          // invisible at card size. The video drops it; the poster keeps the template's look.
          const videoDoc = structuredClone(doc);
          videoDoc.style.grain = 0;
          for (const shot of videoDoc.shots) {
            if (shot.styleOverrides?.grain !== undefined) shot.styleOverrides.grain = 0;
          }
          // The export transfers its bitmaps to the worker, so each render gets its own provider.
          const video = await exportVideo(videoDoc, createProvider(), videoDoc.export);
          if (video.mime !== "video/webm")
            throw new Error(`Expected video/webm, got ${video.mime}`);
          if (video.warnings && video.warnings.length > 0) {
            throw new Error(`Export warnings: ${video.warnings.join("; ")}`);
          }
          const poster = await exportFrame(
            doc,
            createProvider(),
            posterTime,
            posterResolution,
            "png",
          );
          // No named helpers in here: tsx wraps them in __name(), which the page lacks.
          return {
            webm: Array.from(new Uint8Array(await video.blob.arrayBuffer())),
            png: Array.from(new Uint8Array(await poster.arrayBuffer())),
          };
        },
        {
          id: template.id,
          settings: PREVIEW_SETTINGS,
          posterTime: total * POSTER_TIME_FRACTION,
          posterResolution: POSTER_RESOLUTION,
        },
      );
      if (pageErrors.length > 0) {
        throw new Error(`Page errors while rendering ${template.id}:\n${pageErrors.join("\n")}`);
      }

      const result: RenderedTemplate = {
        webm: Buffer.from(rendered.webm),
        png: Buffer.from(rendered.png),
      };
      if (result.webm.byteLength > MAX_WEBM_BYTES) {
        throw new Error(
          `${template.id}.webm is ${result.webm.byteLength} bytes, over the ${MAX_WEBM_BYTES}-byte limit`,
        );
      }
      const probe = await probeWebm(result.webm);
      const frame = 1 / PREVIEW_SETTINGS.fps;
      if (Math.abs(probe.duration - total) > frame + 1e-6) {
        throw new Error(
          `${template.id}.webm lasts ${probe.duration} s; the document lasts ${total} s`,
        );
      }
      const poster = await sharp(result.png).webp({ quality: POSTER_WEBP_QUALITY }).toBuffer();
      const posterMeta = await sharp(poster).metadata();
      const scale = POSTER_RESOLUTION / PREVIEW_SETTINGS.resolution;
      if (posterMeta.width !== probe.width * scale || posterMeta.height !== probe.height * scale) {
        throw new Error(
          `${template.id}: poster is ${posterMeta.width}x${posterMeta.height}, video is ${probe.width}x${probe.height}`,
        );
      }
      fs.writeFileSync(path.join(OUT_DIR, `${template.id}.webm`), result.webm);
      fs.writeFileSync(path.join(OUT_DIR, `${template.id}.webp`), poster);

      rows.push({
        id: template.id,
        duration: total.toFixed(2),
        webmDuration: probe.duration.toFixed(3),
        webmBytes: result.webm.byteLength,
        posterBytes: poster.byteLength,
        dimensions: `${probe.width}x${probe.height} (poster ${posterMeta.width}x${posterMeta.height})`,
      });
      console.log(`done in ${((Date.now() - started) / 1000).toFixed(1)} s`);
    }
  } finally {
    await browser.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  console.log("");
  console.log(
    "| id | doc duration (s) | webm duration (s) | webm bytes | poster bytes | dimensions |",
  );
  console.log("|---|---|---|---|---|---|");
  for (const row of rows) {
    console.log(
      `| ${row.id} | ${row.duration} | ${row.webmDuration} | ${row.webmBytes} | ${row.posterBytes} | ${row.dimensions} |`,
    );
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
