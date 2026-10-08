/**
 * Renders the template gallery previews from a production build:
 * `public/templates/<id>.webm` (360p, 24 fps loop) and `public/templates/<id>.webp`
 * (poster, the frame at 35% of the total). Any failure exits non-zero; nothing is
 * ever written as a placeholder.
 *
 *   npm run template-previews
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { ALL_FORMATS, BufferSource, Input } from "mediabunny";
import { calculateBitrate, outputDimensions } from "../src/export/destinations";
import { schedule } from "../src/motion";
import { BUILTIN_TEMPLATES, buildTemplatePreviewDoc } from "../src/templates";
import { buildLab, launchSwiftShader, serveBuild } from "./lab-build";

const PORT = 3789;
const OUT_DIR = path.resolve("public/templates");
// The build has the lab enabled, so it goes to a scratch directory, never to dist/.
const BUILD_DIR = path.join(os.tmpdir(), "mockupmotion-template-previews");
// The encoder targets a fixed bitrate, so size follows length: the 11.3-11.4 s reels (since
// removed) landed at 420-475 KB, and Launch Reel's ambient background used the full bitrate.
const MAX_WEBM_BYTES = 500 * 1024;
// A preview whose web bitrate would pass this (Frames: 18.5 s) gets the bitrate that fits it,
// under the 450 KiB that tests/template-previews.test.ts allows. Shorter previews keep the web
// bitrate, so their files do not change.
const LONG_PREVIEW_BUDGET_BYTES = 440 * 1024;
// VP9 overshoots its target on constant motion (Frames wrote 889 KB at a 700 KiB target), so a
// long preview is re-encoded at a bitrate scaled by budget / written until it fits.
const MAX_BUDGET_ATTEMPTS = 4;
const BUDGET_HEADROOM = 0.97;
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

interface RenderedTemplate {
  webm: Buffer;
  png: Buffer;
}

interface Row {
  id: string;
  kbps: number;
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
  await buildLab(BUILD_DIR);

  const server = await serveBuild(BUILD_DIR, PORT);
  // `npm run template-previews -- scroll-story` regenerates a subset.
  const requested = process.argv.slice(2);
  const unknown = requested.filter((id) => !BUILTIN_TEMPLATES.some((t) => t.id === id));
  if (unknown.length > 0) throw new Error(`Unknown template ids: ${unknown.join(", ")}`);
  const templates =
    requested.length === 0
      ? BUILTIN_TEMPLATES
      : BUILTIN_TEMPLATES.filter((t) => requested.includes(t.id));
  const browser = await launchSwiftShader();

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

      const render = async (videoBitrate: number | null): Promise<RenderedTemplate> => {
        const rendered = await page.evaluate(
          async ({ id, settings, posterTime, posterResolution, videoBitrate }) => {
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
            // quadruples the file (the removed Phone Spotlight: 633 KB with grain, 145 without) and is
            // invisible at card size. The video drops it; the poster keeps the template's look.
            const videoDoc = structuredClone(doc);
            videoDoc.style.grain = 0;
            for (const shot of videoDoc.shots) {
              if (shot.styleOverrides?.grain !== undefined) shot.styleOverrides.grain = 0;
            }
            // The export transfers its bitmaps to the worker, so each render gets its own provider.
            const video = await exportVideo(
              videoDoc,
              createProvider(),
              videoDoc.export,
              undefined,
              undefined,
              videoBitrate === null ? {} : { videoBitrate },
            );
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
            videoBitrate,
          },
        );
        if (pageErrors.length > 0) {
          throw new Error(`Page errors while rendering ${template.id}:\n${pageErrors.join("\n")}`);
        }
        return { webm: Buffer.from(rendered.webm), png: Buffer.from(rendered.png) };
      };

      const { width, height } = outputDimensions(doc.aspect, PREVIEW_SETTINGS.resolution);
      const webBitrate = calculateBitrate(
        PREVIEW_SETTINGS.quality,
        "vp9",
        width,
        height,
        PREVIEW_SETTINGS.fps,
      );
      const long = (webBitrate * total) / 8 > LONG_PREVIEW_BUDGET_BYTES;
      let bitrate = long ? Math.floor((LONG_PREVIEW_BUDGET_BYTES * 8) / total) : webBitrate;
      let result = await render(long ? bitrate : null);
      for (let attempt = 1; long && result.webm.byteLength > LONG_PREVIEW_BUDGET_BYTES; attempt++) {
        if (attempt >= MAX_BUDGET_ATTEMPTS) {
          throw new Error(
            `${template.id}.webm is ${result.webm.byteLength} bytes at ${bitrate} bps after ${attempt} attempts, over the ${LONG_PREVIEW_BUDGET_BYTES}-byte budget`,
          );
        }
        bitrate = Math.floor(
          (bitrate * LONG_PREVIEW_BUDGET_BYTES * BUDGET_HEADROOM) / result.webm.byteLength,
        );
        process.stdout.write(`${result.webm.byteLength} bytes, re-encoding at ${bitrate} bps... `);
        result = await render(bitrate);
      }
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
        kbps: Math.round(bitrate / 1000),
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
    "| id | doc duration (s) | webm duration (s) | video kbps | webm bytes | poster bytes | dimensions |",
  );
  console.log("|---|---|---|---|---|---|---|");
  for (const row of rows) {
    console.log(
      `| ${row.id} | ${row.duration} | ${row.webmDuration} | ${row.kbps} | ${row.webmBytes} | ${row.posterBytes} | ${row.dimensions} |`,
    );
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
