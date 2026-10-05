import { strToU8, zipSync } from "fflate";

export interface WebEmbedBundleOptions {
  projectName: string;
  width: number;
  height: number;
  mp4Blob: Blob;
  webmBlob: Blob;
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
): string {
  const codecString =
    webmCodec === "av1" ? "av01.0.08M.08" : "vp09.00.41.08";

  return `<video autoplay muted loop playsinline preload="metadata" poster="${baseName}-poster.webp" width="${width}" height="${height}">
  <source src="${baseName}.webm" type='video/webm; codecs="${codecString}"'>
  <source src="${baseName}.mp4" type='video/mp4'>
</video>
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

  const [mp4Buffer, webmBuffer, posterBuffer] = await Promise.all([
    options.mp4Blob.arrayBuffer(),
    options.webmBlob.arrayBuffer(),
    options.posterBlob.arrayBuffer(),
  ]);

  const embedSnippet = generateEmbedHtml(
    baseName,
    options.width,
    options.height,
    options.webmCodec ?? "vp9",
  );

  const zipFiles: Record<string, Uint8Array> = {
    [`${baseName}.mp4`]: new Uint8Array(mp4Buffer),
    [`${baseName}.webm`]: new Uint8Array(webmBuffer),
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
