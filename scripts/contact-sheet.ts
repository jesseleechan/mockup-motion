/**
 * Renders every built-in template at 3 aspects and 3 times into a contact sheet:
 * `<out>/<template>_<aspect>_t<percent>.webp` (960 px wide, WebP quality 80) and an
 * `index.html` grid with labels. Any failure exits non-zero.
 *
 *   npm run contact-sheet                      # writes ./contact-sheet
 *   npm run contact-sheet -- --out <dir>       # e.g. docs/fix-plan/evidence/F11/contact-sheet
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import type { Aspect } from "../src/doc/types";
import { outputDimensions } from "../src/export/destinations";
import { aspectRatioValue, schedule } from "../src/motion";
import { BUILTIN_TEMPLATES, buildTemplatePreviewDoc } from "../src/templates";
import { buildLab, launchSwiftShader, serveBuild } from "./lab-build";

const PORT = 3790;
const BUILD_DIR = path.join(os.tmpdir(), "mockupmotion-contact-sheet");
const ASPECTS: Aspect[] = ["16:9", "9:16", "1:1"];
const TIME_FRACTIONS = [0.15, 0.5, 0.85];
const WIDTH_PX = 960;
const WEBP_QUALITY = 80;
// The sheet is committed as F11 evidence; keep it reviewable.
const MAX_TOTAL_BYTES = 15 * 1024 * 1024;

interface Frame {
  templateId: string;
  templateName: string;
  aspect: Aspect;
  fraction: number;
  time: number;
  file: string;
  bytes: number;
}

function outDirFromArgs(): string {
  const index = process.argv.indexOf("--out");
  if (index === -1) return path.resolve("contact-sheet");
  const value = process.argv[index + 1];
  if (!value) throw new Error("--out needs a directory");
  return path.resolve(value);
}

/** outputDimensions() takes the short side; this is the short side that makes the frame 960 wide. */
function resolutionFor(aspect: Aspect): number {
  const ratio = aspectRatioValue(aspect);
  return ratio >= 1 ? Math.round(WIDTH_PX / ratio) : WIDTH_PX;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function indexHtml(frames: Frame[]): string {
  const sections = BUILTIN_TEMPLATES.map((template) => {
    const items = frames
      .filter((frame) => frame.templateId === template.id)
      .map(
        (frame) => `
        <figure>
          <a href="${frame.file}"><img src="${frame.file}" alt="${escapeHtml(frame.templateName)}, ${frame.aspect}, ${frame.time.toFixed(2)} s" loading="lazy"></a>
          <figcaption>${frame.aspect} · ${Math.round(frame.fraction * 100)}% · ${frame.time.toFixed(2)} s</figcaption>
        </figure>`,
      )
      .join("");
    return `
    <section>
      <h2>${escapeHtml(template.name)} <span>${template.id}</span></h2>
      <div class="row">${items}
      </div>
    </section>`;
  }).join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Template contact sheet</title>
  <style>
    body { margin: 0; padding: 32px; background: #161618; color: #e8e8ea; font: 14px/1.4 system-ui, sans-serif; }
    h1 { font-size: 20px; font-weight: 600; margin: 0 0 4px; }
    p { margin: 0 0 32px; color: #9a9aa0; }
    section { margin-bottom: 40px; }
    h2 { font-size: 15px; font-weight: 600; margin: 0 0 12px; }
    h2 span { color: #8a8a90; font-weight: 400; margin-left: 8px; }
    .row { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-start; }
    figure { margin: 0; }
    img { display: block; height: 240px; width: auto; border-radius: 4px; background: #000; }
    figcaption { margin-top: 6px; color: #9a9aa0; font-size: 12px; }
  </style>
</head>
<body>
  <h1>Template contact sheet</h1>
  <p>${BUILTIN_TEMPLATES.length} templates × ${ASPECTS.length} aspects × ${TIME_FRACTIONS.length} times (${TIME_FRACTIONS.map((f) => `${Math.round(f * 100)}%`).join(", ")} of each template's length), ${WIDTH_PX} px wide. Click a frame for full size.</p>${sections}
</body>
</html>
`;
}

async function main(): Promise<void> {
  const outDir = outDirFromArgs();
  console.log(`Building the app with the lab enabled into ${BUILD_DIR}`);
  await buildLab(BUILD_DIR);
  const server = await serveBuild(BUILD_DIR, PORT);
  const browser = await launchSwiftShader();
  const frames: Frame[] = [];

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
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

    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });

    for (const template of BUILTIN_TEMPLATES) {
      for (const aspect of ASPECTS) {
        const doc = buildTemplatePreviewDoc(template, aspect);
        const { total } = schedule(doc);
        const times = TIME_FRACTIONS.map((fraction) => fraction * total);
        const resolution = resolutionFor(aspect);
        process.stdout.write(`${template.id} ${aspect}... `);

        const encoded = await page.evaluate(
          async ({ doc, times, resolution }) => {
            const exportFrames = window.__exportFrames;
            const createProvider = window.__createLabAssetProvider;
            if (!exportFrames || !createProvider) throw new Error("Lab export hooks are missing");
            const blobs = await exportFrames(doc, createProvider(), times, resolution, "png");
            // No named helpers in here: tsx wraps them in __name(), which the page lacks.
            const out: string[] = [];
            for (const blob of blobs) {
              const bytes = new Uint8Array(await blob.arrayBuffer());
              let binary = "";
              for (let i = 0; i < bytes.length; i += 0x8000) {
                binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
              }
              out.push(btoa(binary));
            }
            return out;
          },
          { doc, times, resolution },
        );
        if (pageErrors.length > 0) {
          throw new Error(
            `Page errors while rendering ${template.id} ${aspect}:\n${pageErrors.join("\n")}`,
          );
        }

        const expected = outputDimensions(aspect, resolution);
        for (let i = 0; i < times.length; i++) {
          const png = Buffer.from(encoded[i], "base64");
          const meta = await sharp(png).metadata();
          if (meta.width !== WIDTH_PX || meta.height !== expected.height) {
            throw new Error(
              `${template.id} ${aspect}: frame is ${meta.width}x${meta.height}, expected ${WIDTH_PX}x${expected.height}`,
            );
          }
          const webp = await sharp(png).webp({ quality: WEBP_QUALITY }).toBuffer();
          const fraction = TIME_FRACTIONS[i];
          const file = `${template.id}_${aspect.replace(":", "x")}_t${Math.round(fraction * 100)}.webp`;
          fs.writeFileSync(path.join(outDir, file), webp);
          frames.push({
            templateId: template.id,
            templateName: template.name,
            aspect,
            fraction,
            time: times[i],
            file,
            bytes: webp.byteLength,
          });
        }
        console.log("done");
      }
    }
  } finally {
    await browser.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  const frameCount = BUILTIN_TEMPLATES.length * ASPECTS.length * TIME_FRACTIONS.length;
  if (frames.length !== frameCount) {
    throw new Error(`Rendered ${frames.length} frames, expected ${frameCount}`);
  }
  fs.writeFileSync(path.join(outDir, "index.html"), indexHtml(frames), "utf-8");
  const totalBytes = frames.reduce((sum, frame) => sum + frame.bytes, 0);
  console.log(
    `\nWrote ${frames.length} frames (${(totalBytes / 1024 / 1024).toFixed(2)} MB) and index.html to ${outDir}`,
  );
  if (totalBytes > MAX_TOTAL_BYTES) {
    throw new Error(
      `The contact sheet is ${totalBytes} bytes, over the ${MAX_TOTAL_BYTES}-byte limit`,
    );
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
