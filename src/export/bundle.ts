import { strToU8, zipSync } from "fflate";

export interface WebEmbedBundleOptions {
  projectName: string;
  width: number;
  height: number;
  /** Omitted when this browser can't encode H.264. */
  mp4Blob?: Blob;
  /** Omitted when this browser can't encode VP9. */
  webmBlob?: Blob;
  posterBlob: Blob;
  webmCodec?: "av1" | "vp9";
}

function sanitizeFileName(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "mockup";
}

/**
 * Generates semantic, accessible HTML video embed snippet.
 */
export function generateEmbedHtml(
  baseName: string,
  width: number,
  height: number,
  webmCodec: "av1" | "vp9" = "vp9",
  sources: { mp4: boolean; webm: boolean } = { mp4: true, webm: true },
): string {
  const codecString = webmCodec === "av1" ? "av01.0.08M.08" : "vp09.00.41.08";

  const sourceTags = [
    sources.webm &&
      `  <source src="${baseName}.webm" type='video/webm; codecs="${codecString}"'>\n`,
    sources.mp4 && `  <source src="${baseName}.mp4" type='video/mp4'>\n`,
  ]
    .filter(Boolean)
    .join("");

  return `<video autoplay muted loop playsinline preload="metadata" poster="${baseName}-poster.webp" width="${width}" height="${height}">
${sourceTags}</video>
<!-- Pause video if user prefers reduced motion (quality-bar & accessibility) -->
<script>
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const v = document.currentScript && document.currentScript.previousElementSibling;
    if (v && v.tagName === 'VIDEO') {
      v.pause();
    }
  }
</script>
`;
}

/**
 * Assembles web embed package into a zip archive via fflate:
 * - name.mp4
 * - name.webm
 * - name-poster.webp
 * - embed.html
 */
export async function createWebEmbedBundle(
  options: WebEmbedBundleOptions,
): Promise<{ zipBlob: Blob; embedSnippet: string }> {
  const baseName = sanitizeFileName(options.projectName);

  const { mp4Blob, webmBlob } = options;
  if (!mp4Blob && !webmBlob) throw new Error("A web bundle needs an MP4 or a WebM video.");
  const [mp4Buffer, webmBuffer, posterBuffer] = await Promise.all([
    mp4Blob?.arrayBuffer(),
    webmBlob?.arrayBuffer(),
    options.posterBlob.arrayBuffer(),
  ]);

  const embedSnippet = generateEmbedHtml(
    baseName,
    options.width,
    options.height,
    options.webmCodec ?? "vp9",
    { mp4: Boolean(mp4Buffer), webm: Boolean(webmBuffer) },
  );

  const zipFiles: Record<string, Uint8Array> = {
    ...(mp4Buffer ? { [`${baseName}.mp4`]: new Uint8Array(mp4Buffer) } : {}),
    ...(webmBuffer ? { [`${baseName}.webm`]: new Uint8Array(webmBuffer) } : {}),
    [`${baseName}-poster.webp`]: new Uint8Array(posterBuffer),
    "embed.html": strToU8(embedSnippet),
  };

  const zippedData = zipSync(zipFiles);
  const zipBlob = new Blob([zippedData.buffer as ArrayBuffer], {
    type: "application/zip",
  });

  return {
    zipBlob,
    embedSnippet,
  };
}
