import * as THREE from "three";
import { PHONE_ISLAND, PHONE_SCREEN_POINTS } from "../../motion/phone-spec";

/**
 * "9:41" in Inter at weight 600, as an SVG path in em units with the baseline at y = 0 and y
 * pointing down. Taken once from the bundled Inter (SIL OFL) with fontTools, so the status bar
 * needs no font loading and renders the same in every frame.
 */
const TIME_PATH =
  "M0.3052 0.0105Q0.2366 0.0105 0.1836 -0.0165Q0.1306 -0.0435 0.0979 -0.0904Q0.0653 -0.1373 0.0573 -0.1968H0.1861Q0.1957 -0.1546 0.2264 -0.1286Q0.257 -0.1025 0.3052 -0.1025Q0.3557 -0.1025 0.3909 -0.1324Q0.4261 -0.1623 0.4446 -0.218Q0.4631 -0.2737 0.4631 -0.351H0.4579Q0.4405 -0.32 0.4129 -0.2975Q0.3853 -0.275 0.3505 -0.2627Q0.3158 -0.2505 0.2764 -0.2505Q0.2127 -0.2505 0.1613 -0.2811Q0.11 -0.3116 0.0802 -0.3653Q0.0504 -0.4189 0.0504 -0.4875Q0.0504 -0.5593 0.0835 -0.6162Q0.1165 -0.6732 0.1756 -0.7061Q0.2347 -0.7389 0.3133 -0.738Q0.3651 -0.7377 0.4143 -0.7196Q0.4636 -0.7015 0.503 -0.6611Q0.5425 -0.6207 0.5659 -0.553Q0.5894 -0.4853 0.5894 -0.3852Q0.5894 -0.2915 0.5696 -0.2182Q0.5498 -0.1449 0.5125 -0.0938Q0.4753 -0.0428 0.4228 -0.0161Q0.3702 0.0105 0.3052 0.0105ZM0.3112 -0.3505Q0.3404 -0.3505 0.3654 -0.3618Q0.3904 -0.373 0.409 -0.3926Q0.4276 -0.4121 0.4381 -0.4375Q0.4487 -0.4629 0.4487 -0.4916Q0.4487 -0.5292 0.431 -0.5609Q0.4134 -0.5926 0.3829 -0.612Q0.3524 -0.6313 0.3131 -0.6313Q0.2746 -0.6313 0.2439 -0.6126Q0.2132 -0.5938 0.1953 -0.5618Q0.1775 -0.5298 0.1775 -0.4903Q0.1775 -0.4512 0.1949 -0.4194Q0.2123 -0.3877 0.2424 -0.3691Q0.2725 -0.3505 0.3112 -0.3505Z M0.799 0.0083Q0.766 0.0083 0.7433 -0.0143Q0.7206 -0.0368 0.7206 -0.0696Q0.7206 -0.1024 0.7433 -0.1249Q0.766 -0.1475 0.799 -0.1475Q0.832 -0.1475 0.8547 -0.1249Q0.8774 -0.1024 0.8774 -0.0696Q0.8774 -0.0368 0.8547 -0.0143Q0.832 0.0083 0.799 0.0083ZM0.799 -0.3649Q0.766 -0.3649 0.7433 -0.3875Q0.7206 -0.41 0.7206 -0.4428Q0.7206 -0.4756 0.7433 -0.4981Q0.766 -0.5207 0.799 -0.5207Q0.832 -0.5207 0.8547 -0.4981Q0.8774 -0.4756 0.8774 -0.4428Q0.8774 -0.41 0.8547 -0.3875Q0.832 -0.3649 0.799 -0.3649Z M1.0108 -0.1355V-0.2391L1.32 -0.7275H1.4058V-0.5793H1.3533L1.1442 -0.2487V-0.2429H1.5755V-0.1355ZM1.3571 0V-0.1667L1.3592 -0.2138V-0.7275H1.4822V0Z M1.9745 -0.7275V0H1.845V-0.6114H1.8401L1.6703 -0.4893V-0.6135L1.8303 -0.7275Z";
const TIME_ADVANCE_EM = 2.0474;

// Sizes in points of the 402 pt wide screen, measured from iOS's status bar.
const TIME_FONT_PT = 17;
const TIME_CENTER_X_PT = 72;
const ICONS_CENTER_X_PT = 330;
// The icons and the time centre on the Dynamic Island's centre line.
const CENTER_Y_PT = (PHONE_ISLAND.top + PHONE_ISLAND.height / 2) * PHONE_SCREEN_POINTS.width;

export type StatusBarTone = "light" | "dark";

/** The glyph tone iOS picks over a background: dark glyphs on a light page, light on a dark one. */
export function statusBarTone(rgb: readonly [number, number, number]): StatusBarTone {
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
  return luminance > 0.4 ? "dark" : "light";
}

function roundedRect(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Signal bars, Wi-Fi and battery, 71 pt wide, centred on (cx, cy) in points. */
function drawIcons(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  cx: number,
  cy: number,
): void {
  let x = cx - 35.5;
  // Cellular: four bars, bottom-aligned.
  const barHeights = [4, 6.3, 8.6, 11];
  const bottom = cy + 5.5;
  for (const h of barHeights) {
    roundedRect(ctx, x, bottom - h, 3, h, 1);
    ctx.fill();
    x += 4.6;
  }
  x += 3.6;

  // Wi-Fi: a dot and two arcs fanning up from one point.
  const wifiX = x + 7.75;
  const wifiY = bottom;
  const spread = Math.PI / 4;
  const bands: [number, number][] = [
    [11.4, 8.9],
    [7.7, 5.2],
  ];
  for (const [outer, inner] of bands) {
    ctx.beginPath();
    ctx.arc(wifiX, wifiY, outer, -Math.PI / 2 - spread, -Math.PI / 2 + spread);
    ctx.arc(wifiX, wifiY, inner, -Math.PI / 2 + spread, -Math.PI / 2 - spread, true);
    ctx.closePath();
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(wifiX, wifiY);
  ctx.arc(wifiX, wifiY, 3.6, -Math.PI / 2 - spread, -Math.PI / 2 + spread);
  ctx.closePath();
  ctx.fill();
  x += 15.5 + 5.5;

  // Battery: a faint outline, a full charge and a faint cap.
  const top = cy - 6;
  ctx.save();
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 1;
  roundedRect(ctx, x + 0.5, top + 0.5, 24, 12, 3.8);
  ctx.stroke();
  roundedRect(ctx, x + 25.8, cy - 2, 1.4, 4, 0.7);
  ctx.fill();
  ctx.restore();
  roundedRect(ctx, x + 2.5, top + 2.5, 20, 8, 2);
  ctx.fill();
}

/**
 * The status bar's time and icons on a transparent canvas `widthPx` wide and `heightPx` tall
 * (the bar's size on the screen render target). Row 0 is the top, like every image texture.
 */
export function createStatusBarTexture(
  widthPx: number,
  heightPx: number,
  tone: StatusBarTone,
): THREE.Texture | null {
  const width = Math.max(1, Math.round(widthPx));
  const height = Math.max(1, Math.round(heightPx));
  const canvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(width, height)
      : typeof document !== "undefined"
        ? Object.assign(document.createElement("canvas"), { width, height })
        : null;
  if (!canvas) return null;
  const ctx = canvas.getContext("2d") as
    CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!ctx) return null;

  const scale = width / PHONE_SCREEN_POINTS.width;
  ctx.scale(scale, scale);
  const color = tone === "dark" ? "#000000" : "#FFFFFF";
  ctx.fillStyle = color;
  ctx.strokeStyle = color;

  // The time, its digits centred vertically on the island's centre line.
  ctx.save();
  const timeWidth = TIME_ADVANCE_EM * TIME_FONT_PT;
  ctx.translate(TIME_CENTER_X_PT - timeWidth / 2, CENTER_Y_PT + 0.364 * TIME_FONT_PT);
  ctx.scale(TIME_FONT_PT, TIME_FONT_PT);
  ctx.fill(new Path2D(TIME_PATH));
  ctx.restore();

  drawIcons(ctx, ICONS_CENTER_X_PT, CENTER_Y_PT);

  const texture = new THREE.CanvasTexture(canvas);
  texture.flipY = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
