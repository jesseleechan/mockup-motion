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
