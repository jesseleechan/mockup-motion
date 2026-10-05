import type { Composition, UploadedImage } from "../types";
import { canScroll, chooseImages, contentProgress, imageRect, motionProgress } from "./geometry";
type Context = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
export interface SceneOptions {
  ctx: Context;
  width: number;
  height: number;
  time: number;
  composition: Composition;
  images: UploadedImage[];
}
const FINISHES = {
  titanium: "#5a606a",
  midnight: "#22232a",
  silver: "#cbd0d8",
  gold: "#b99a65",
};
const round = (ctx: Context, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
};
function drawImage(
  ctx: Context,
  image: UploadedImage | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
  c: Composition,
  crop: number,
) {
  ctx.fillStyle = c.frame.appearance === "light" ? "#f3f1ee" : "#151821";
  ctx.fillRect(x, y, w, h);
  if (image?.imageElement?.width) {
    const rect = imageRect(image.width, image.height, w, h, c.image.fit, crop);
    ctx.drawImage(image.imageElement, x + rect.x, y + rect.y, rect.width, rect.height);
  } else {
    ctx.fillStyle = "#b2b0bb";
    ctx.textAlign = "center";
    ctx.font = "500 16px Arial, sans-serif";
    ctx.fillText("Add a screenshot", x + w / 2, y + h / 2);
  }
}
function background(ctx: Context, w: number, h: number, c: Composition, images: UploadedImage[]) {
  const b = c.background;
  ctx.fillStyle = b.color;
  ctx.fillRect(0, 0, w, h);
  if (b.type === "image") {
    const image = images.find((i) => i.id === b.imageId);
    if (image?.imageElement) {
      const rect = imageRect(image.width, image.height, w, h, "cover", 0.5);
      ctx.drawImage(image.imageElement, rect.x, rect.y, rect.width, rect.height);
    }
  } else if (b.type === "gradient") {
    const a = ((b.angle - 90) * Math.PI) / 180,
      length = Math.abs(w * Math.cos(a)) + Math.abs(h * Math.sin(a));
    const dx = (Math.cos(a) * length) / 2,
      dy = (Math.sin(a) * length) / 2;
    const g = ctx.createLinearGradient(w / 2 - dx, h / 2 - dy, w / 2 + dx, h / 2 + dy);
    g.addColorStop(0, b.color);
    g.addColorStop(1, b.secondColor);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  } else if (b.type === "spotlight") {
    const g = ctx.createRadialGradient(
      w * 0.5,
      h * 0.4,
      0,
      w * 0.5,
      h * 0.4,
      Math.max(w, h) * 0.75,
    );
    g.addColorStop(0, b.secondColor);
    g.addColorStop(1, b.color);
    ctx.globalAlpha = b.intensity / 100;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }
}
function frame(
  ctx: Context,
  x: number,
  y: number,
  w: number,
  h: number,
  image: UploadedImage | undefined,
  c: Composition,
  time: number,
  scroll: boolean,
  type = c.frame.type,
) {
  ctx.save();
  ctx.translate(x, y);
  const phone = type === "phone",
    browser = type === "browser",
    light = c.frame.appearance === "light";
  const radius = phone ? w * 0.145 : type === "none" ? 0 : c.frame.radius;
  if (c.effects.shadow > 0) {
    ctx.save();
    ctx.shadowColor = `rgba(22, 18, 38, ${(c.effects.shadow / 100) * 0.65})`;
    ctx.shadowBlur = c.effects.blur;
    ctx.shadowOffsetY = c.effects.offset;
    ctx.fillStyle = light ? "#ffffff" : "#20222a";
    round(ctx, -w / 2, -h / 2, w, h, radius);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = phone ? FINISHES[c.frame.finish] : light ? "#ffffff" : "#272931";
  round(ctx, -w / 2, -h / 2, w, h, radius);
  ctx.fill();
  if (c.frame.border > 0 && type !== "none") {
    ctx.lineWidth = c.frame.border;
    ctx.strokeStyle = phone ? "#ffffff40" : light ? "#ffffffb3" : "#ffffff1a";
    ctx.stroke();
  }
  const pad = phone ? w * 0.027 : type === "none" ? 0 : Math.min(8, w * 0.012);
  const bar = browser ? Math.max(16, w * 0.037) : 0;
  const sx = -w / 2 + pad,
    sy = -h / 2 + pad + bar,
    sw = w - pad * 2,
    sh = h - pad * 2 - bar;
  ctx.save();
  round(ctx, sx, sy, sw, sh, Math.max(0, radius - pad));
  ctx.clip();
  drawImage(
    ctx,
    image,
    sx,
    sy,
    sw,
    sh,
    c,
    scroll ? contentProgress(time, c) : (image?.crop ?? c.image.crop) / 100,
  );
  if (c.effects.reflection > 0) {
    const g = ctx.createLinearGradient(sx, sy, sx + sw, sy + sh);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.5, "#ffffff00");
    g.addColorStop(1, "#ffffff20");
    ctx.globalAlpha = (c.effects.reflection / 100) * 0.35;
    ctx.fillStyle = g;
    ctx.fillRect(sx, sy, sw, sh);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  if (browser) {
    ["#ef7772", "#e9c15a", "#6bc293"].forEach((color, i) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(
        -w / 2 + pad + 11 + i * 12,
        -h / 2 + pad + bar / 2,
        Math.max(2, w * 0.004),
        0,
        Math.PI * 2,
      );
      ctx.fill();
    });
    if (c.frame.title && w > 160) {
      ctx.fillStyle = light ? "#8a8791" : "#9995a5";
      ctx.font = `${Math.max(8, w * 0.016)}px Arial, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(c.frame.title, 0, -h / 2 + pad + bar * 0.65, w * 0.6);
    }
  }
  if (phone) {
    ctx.fillStyle = "#121217";
    round(ctx, -sw * 0.14, -h / 2 + w * 0.055, sw * 0.28, w * 0.064, w * 0.04);
    ctx.fill();
    round(ctx, -sw * 0.16, h / 2 - w * 0.06, sw * 0.32, w * 0.012, w * 0.006);
    ctx.fill();
    if (c.frame.status) {
      ctx.fillStyle = light ? "#222222" : "#eeeeee";
      ctx.font = `600 ${w * 0.033}px Arial`;
      ctx.textAlign = "left";
      ctx.fillText("9:41", sx + w * 0.06, -h / 2 + w * 0.105);
    }
  }
  ctx.restore();
}
function branding(ctx: Context, w: number, h: number, c: Composition, images: UploadedImage[]) {
  const b = c.brand,
    y = b.position === "top" ? 52 : h - 48;
  ctx.save();
  ctx.fillStyle = b.color;
  ctx.textAlign = "center";
  ctx.font = `600 ${b.size}px Arial, sans-serif`;
  if (b.title) ctx.fillText(b.title, w / 2, y, w * 0.82);
  if (b.subtitle) {
    ctx.font = `${b.size * 0.48}px Arial, sans-serif`;
    ctx.globalAlpha = 0.75;
    ctx.fillText(b.subtitle, w / 2, y + b.size * 0.7, w * 0.82);
    ctx.globalAlpha = 1;
  }
  const logo = images.find((i) => i.id === b.logoId);
  if (logo?.imageElement) {
    const lw = 52 * logo.aspectRatio;
    ctx.drawImage(logo.imageElement, 32, b.position === "top" ? 28 : h - 80, lw, 52);
  }
  ctx.restore();
}
export function renderScene({ ctx, width, height, time, composition: c, images }: SceneOptions) {
  const logicalW = width >= height ? 1280 : 720,
    factor = width / logicalW,
    w = logicalW,
    h = height / factor;
  ctx.save();
  ctx.setTransform(factor, 0, 0, factor, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  background(ctx, w, h, c, images);
  const p = motionProgress(time, c),
    amount = c.motion.amount / 100,
    sign = c.motion.direction === "forward" ? 1 : -1;
  const visibleImages = images.filter(
    (i) =>
      (c.background.type !== "image" || i.id !== c.background.imageId) && i.id !== c.brand.logoId,
  );
  const selected = chooseImages(c, visibleImages);
  const pool =
    c.frame.type === "phone"
      ? visibleImages.filter((i) => i.category === "mobile")
      : visibleImages.filter((i) => i.category !== "mobile");
  const source = pool.length ? pool : visibleImages;
  const get = (i: number) => source[((i % source.length) + source.length) % source.length];
  ctx.save();
  ctx.translate(
    w / 2 + (c.alignment === "left" ? -w * 0.07 : c.alignment === "right" ? w * 0.07 : 0),
    h / 2,
  );
  if (c.motion.type === "zoom") {
    const zoom = 1 + p * amount * 0.2 * sign;
    ctx.scale(zoom, zoom);
  }
  if (c.motion.type === "drift")
    ctx.translate(p * amount * w * 0.12 * sign, -p * amount * h * 0.08 * sign);
  ctx.rotate((c.rotation * Math.PI) / 180);
  const scale = c.scale / 100;
  if (c.layout === "hero") {
    const ratio = c.frame.type === "phone" ? 0.48 : 1.6;
    const fw = Math.min(w * scale, h * scale * ratio),
      fh = fw / ratio;
    const dx = c.motion.type === "glide" ? p * amount * w * 0.18 * sign : 0;
    frame(
      ctx,
      dx,
      0,
      fw,
      fh,
      selected.primary,
      c,
      time,
      c.contentMotion.enabled && canScroll(c, visibleImages),
    );
  } else if (c.layout === "pair") {
    if (w >= h) {
      const fw = Math.min(w * scale * 0.8, h * scale * 1.6),
        ph = h * scale * 0.92;
      frame(ctx, -w * 0.05, 0, fw, fw / 1.6, selected.primary, c, time, false, "browser");
      frame(ctx, fw * 0.44, ph * 0.12, ph * 0.48, ph, selected.mobile, c, time, false, "phone");
    } else {
      const fw = w * scale;
      frame(ctx, 0, -h * 0.15, fw, fw / 1.6, selected.primary, c, time, false, "browser");
      const ph = Math.min(h * scale * 0.43, w * 1.3);
      frame(ctx, fw * 0.15, h * 0.23, ph * 0.48, ph, selected.mobile, c, time, false, "phone");
    }
  } else if (c.layout === "grid") {
    const n = Math.max(1, Math.min(9, source.length)),
      cols = Math.min(c.count, n),
      rows = Math.ceil(n / cols);
    const ratio = c.frame.type === "phone" ? 0.48 : 1.6;
    const fw = Math.min(
      (w * scale - (cols - 1) * c.spacing) / cols,
      ((h * scale - (rows - 1) * c.spacing) / rows) * ratio,
    );
    const fh = fw / ratio;
    for (let i = 0; i < n; i++)
      frame(
        ctx,
        ((i % cols) - (cols - 1) / 2) * (fw + c.spacing),
        (Math.floor(i / cols) - (rows - 1) / 2) * (fh + c.spacing),
        fw,
        fh,
        get(i),
        c,
        time,
        false,
      );
  } else if (c.layout === "columns") {
    const count = Math.min(4, c.count),
      fw = Math.min((w * scale) / (count + 0.4), h * 0.68 * 0.48),
      fh = fw / 0.48,
      stride = fh + c.spacing;
    for (let col = 0; col < count; col++) {
      const shift =
        c.motion.type === "glide" ? p * stride * amount * 1.5 * (col % 2 ? -1 : 1) * sign : 0;
      const number = Math.ceil(h / stride) + 2;
      for (let row = -number; row <= number; row++)
        frame(
          ctx,
          (col - (count - 1) / 2) * (fw + c.spacing),
          row * stride + shift,
          fw,
          fh,
          get(row + col),
          c,
          time,
          false,
          "phone",
        );
    }
  } else {
    const count = c.count,
      fw = (w * (w < h ? 0.88 : 0.46) * scale) / 0.85,
      ratio = c.frame.type === "phone" ? 0.48 : 1.6,
      fh = fw / ratio;
    const stride = fw + c.spacing,
      number = Math.ceil(w / stride) + 2;
    for (let row = 0; row < count; row++) {
      const shift =
        c.motion.type === "glide" ? p * stride * amount * 1.5 * (row % 2 ? -1 : 1) * sign : 0;
      for (let col = -number; col <= number; col++)
        frame(
          ctx,
          col * stride + shift,
          (row - (count - 1) / 2) * (fh + c.spacing),
          fw,
          fh,
          get(col + row),
          c,
          time,
          false,
        );
    }
  }
  ctx.restore();
  branding(ctx, w, h, c, images);
  ctx.restore();
}
