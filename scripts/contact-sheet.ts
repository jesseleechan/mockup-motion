/**
 * Renders every built-in template at 3 aspects and 3 times into a contact sheet:
 * `<out>/<template>_<aspect>_t<percent>.webp` (960 px wide, WebP quality 80) and an
 * `index.html` grid with labels. Any failure exits non-zero.
 *
 *   npm run contact-sheet                      # writes ./contact-sheet
 *   npm run contact-sheet -- --out <dir>       # e.g. docs/fix-plan/evidence/F11/contact-sheet
 *
 * Optional filters, for a sheet of a few templates:
 *   --templates desktop-slider,frames          # these templates, in this order
 *   --aspects 16:9,9:16,1:1,4:5,4:3            # these aspects (default 16:9, 9:16, 1:1)
 *   --times 3.9,4.5,5.2                        # these times in seconds, not 15/50/85% of each length
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import type { Aspect } from "../src/doc/types";
import { outputDimensions } from "../src/export/destinations";
import { aspectRatioValue, schedule } from "../src/motion";
import { BUILTIN_TEMPLATES, buildTemplatePreviewDoc, type Template } from "../src/templates";
import { buildLab, launchSwiftShader, serveBuild } from "./lab-build";

const PORT = 3790;
const BUILD_DIR = path.join(os.tmpdir(), "mockupmotion-contact-sheet");
const DEFAULT_ASPECTS: Aspect[] = ["16:9", "9:16", "1:1"];
const ALL_ASPECTS: Aspect[] = ["16:9", "9:16", "1:1", "4:5", "4:3"];
const TIME_FRACTIONS = [0.15, 0.5, 0.85];
const WIDTH_PX = 960;
const WEBP_QUALITY = 80;
// The sheet is committed as F11 evidence; keep it reviewable.
const MAX_TOTAL_BYTES = 15 * 1024 * 1024;

interface Frame {
  templateId: string;
  templateName: string;
  aspect: Aspect;
  /** The time as a fraction of the template's length, or null when --times gave seconds. */
  fraction: number | null;
  time: number;
  file: string;
  bytes: number;
}

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${flag} needs a value`);
  return value;
}

function listArg(flag: string): string[] | undefined {
  return argValue(flag)
    ?.split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

interface Options {
  outDir: string;
  templates: Template[];
  aspects: Aspect[];
  /** Times in seconds, or undefined for TIME_FRACTIONS of each template's length. */
  seconds: number[] | undefined;
}

function optionsFromArgs(): Options {
  const out = argValue("--out");
  const ids = listArg("--templates");
  const templates = ids
    ? ids.map((id) => {
        const template = BUILTIN_TEMPLATES.find((t) => t.id === id);
        if (!template) throw new Error(`Unknown template id: ${id}`);
        return template;
      })
    : BUILTIN_TEMPLATES;
  const aspects = (listArg("--aspects") ?? DEFAULT_ASPECTS).map((value) => {
    const aspect = ALL_ASPECTS.find((a) => a === value);
    if (!aspect) throw new Error(`Unknown aspect: ${value}`);
    return aspect;
  });
  const seconds = listArg("--times")?.map((value) => {
    const time = Number(value);
    if (!Number.isFinite(time) || time < 0) throw new Error(`Not a time in seconds: ${value}`);
    return time;
  });
  return { outDir: path.resolve(out ?? "contact-sheet"), templates, aspects, seconds };
}

function timeLabel(frame: Frame): string {
  const time = `${frame.time.toFixed(2)} s`;
  return frame.fraction === null ? time : `${Math.round(frame.fraction * 100)}% · ${time}`;
}

/** outputDimensions() takes the short side; this is the short side that makes the frame 960 wide. */
function resolutionFor(aspect: Aspect): number {
  const ratio = aspectRatioValue(aspect);
  return ratio >= 1 ? Math.round(WIDTH_PX / ratio) : WIDTH_PX;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function indexHtml(frames: Frame[], options: Options): string {
  const sections = options.templates
    .map((template) => {
      const items = frames
        .filter((frame) => frame.templateId === template.id)
        .map(
          (frame) => `
        <figure>
          <a href="${frame.file}"><img src="${frame.file}" alt="${escapeHtml(frame.templateName)}, ${frame.aspect}, ${frame.time.toFixed(2)} s" loading="lazy"></a>
          <figcaption>${frame.aspect} · ${timeLabel(frame)}</figcaption>
        </figure>`,
        )
        .join("");
      return `
    <section>
      <h2>${escapeHtml(template.name)} <span>${template.id}</span></h2>
      <div class="row">${items}
      </div>
    </section>`;
    })
    .join("");

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
  <p>${options.templates.length} templates × ${options.aspects.length} aspects × ${timesSummary(options)}, ${WIDTH_PX} px wide. Click a frame for full size.</p>${sections}
</body>
</html>
`;
}

function timesSummary(options: Options): string {
  return options.seconds
    ? `${options.seconds.length} times (${options.seconds.map((t) => `${t} s`).join(", ")})`
    : `${TIME_FRACTIONS.length} times (${TIME_FRACTIONS.map((f) => `${Math.round(f * 100)}%`).join(", ")} of each template's length)`;
}

async function main(): Promise<void> {
  const options = optionsFromArgs();
  const { outDir } = options;
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

    for (const template of options.templates) {
      for (const aspect of options.aspects) {
        const doc = buildTemplatePreviewDoc(template, aspect);
        const { total } = schedule(doc);
        const times = options.seconds ?? TIME_FRACTIONS.map((fraction) => fraction * total);
        const late = times.filter((time) => time > total);
        if (late.length > 0) {
          throw new Error(
            `${template.id} ${aspect} lasts ${total} s; asked for ${late.join(", ")} s`,
          );
        }
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
          const fraction = options.seconds ? null : TIME_FRACTIONS[i];
          const timeTag =
            fraction === null ? `${times[i].toFixed(2)}s` : `${Math.round(fraction * 100)}`;
          const file = `${template.id}_${aspect.replace(":", "x")}_t${timeTag}.webp`;
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

  const frameCount =
    options.templates.length *
    options.aspects.length *
    (options.seconds?.length ?? TIME_FRACTIONS.length);
  if (frames.length !== frameCount) {
    throw new Error(`Rendered ${frames.length} frames, expected ${frameCount}`);
  }
  fs.writeFileSync(path.join(outDir, "index.html"), indexHtml(frames, options), "utf-8");
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
