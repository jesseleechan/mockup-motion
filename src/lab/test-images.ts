/** Deterministic pixel fixtures used by the development-only /lab test hooks. */
export const labTestImages = {
  async quadrants(width: number, height: number): Promise<ImageBitmap> {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("2D canvas context unavailable");
    context.fillStyle = "#FF0000";
    context.fillRect(0, 0, width / 2, height / 2);
    context.fillStyle = "#00FF00";
    context.fillRect(width / 2, 0, width / 2, height / 2);
    context.fillStyle = "#0000FF";
    context.fillRect(0, height / 2, width / 2, height / 2);
    context.fillStyle = "#FFFF00";
    context.fillRect(width / 2, height / 2, width / 2, height / 2);
    return createImageBitmap(canvas);
  },
  async bands(width: number, height: number, colors: string[]): Promise<ImageBitmap> {
    if (colors.length === 0) throw new Error("At least one band color is required");
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("2D canvas context unavailable");
    colors.forEach((color, index) => {
      context.fillStyle = color;
      const y0 = Math.floor((height * index) / colors.length);
      const y1 = Math.floor((height * (index + 1)) / colors.length);
      context.fillRect(0, y0, width, y1 - y0);
    });
    return createImageBitmap(canvas);
  },
  async edgeColumns(width: number, height: number): Promise<ImageBitmap> {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("2D canvas context unavailable");
    context.fillStyle = "#FFFFFF";
    context.fillRect(0, 0, width, height);
    context.fillStyle = "#FF00FF";
    context.fillRect(0, 0, 4, height);
    context.fillRect(width - 4, 0, 4, height);
    return createImageBitmap(canvas);
  },
};

const TEST_ID = /^lab-test-(quadrants|bands)-(\d+)x(\d+)((?:-[0-9a-f]{6})*)$/i;

export function labTestQuadrantsId(width: number, height: number): string {
  return `lab-test-quadrants-${width}x${height}`;
}

/** `colors` are `#RRGGBB`, listed top to bottom. */
export function labTestBandsId(width: number, height: number, colors: string[]): string {
  return `lab-test-bands-${width}x${height}-${colors.map((c) => c.replace("#", "")).join("-")}`;
}

export interface LabTestImageSpec {
  kind: "quadrants" | "bands";
  width: number;
  height: number;
  /** `#RRGGBB`, top to bottom; empty for quadrants. */
  colors: string[];
}

/** Parses a `lab-test-*` asset id. Returns null for any other id; throws if it is malformed. */
export function parseLabTestId(assetId: string): LabTestImageSpec | null {
  if (!assetId.startsWith("lab-test-")) return null;
  const match = TEST_ID.exec(assetId);
  if (!match) throw new Error(`Malformed lab test asset id: ${assetId}`);
  const [, kind, width, height, colorList] = match;
  const colors = colorList
    .split("-")
    .filter((c) => c.length > 0)
    .map((c) => `#${c}`);
  if (kind === "bands" && colors.length === 0) {
    throw new Error(`Lab test bands need at least one colour: ${assetId}`);
  }
  return {
    kind: kind === "bands" ? "bands" : "quadrants",
    width: Number(width),
    height: Number(height),
    colors,
  };
}

/**
 * Generates the image behind a `lab-test-*` asset id, so pixel fixtures load through the normal
 * asset path in `/lab?still=1`. Returns null for any other id. Flat fills scale without
 * resampling error, so the image is generated at `maxWidth` instead of being downscaled.
 */
export async function labTestImageFromId(
  assetId: string,
  maxWidth: number,
): Promise<ImageBitmap | null> {
  const spec = parseLabTestId(assetId);
  if (!spec) return null;
  const scale = Math.min(1, maxWidth / spec.width);
  const width = Math.round(spec.width * scale);
  const height = Math.round(spec.height * scale);
  if (spec.kind === "quadrants") return labTestImages.quadrants(width, height);
  return labTestImages.bands(width, height, spec.colors);
}
