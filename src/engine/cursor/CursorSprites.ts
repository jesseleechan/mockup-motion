import * as THREE from "three";

export type CursorStyle = "arrow" | "pointer" | "dot";

function createOffscreen(w: number, h: number): HTMLCanvasElement | OffscreenCanvas | null {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(w, h);
  }
  if (typeof document !== "undefined" && document.createElement) {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    return canvas;
  }
  return null;
}

function createDummyTexture(): THREE.CanvasTexture {
  const tex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  tex.needsUpdate = true;
  return tex as unknown as THREE.CanvasTexture;
}

let arrowTexture: THREE.CanvasTexture | null = null;
let pointerTexture: THREE.CanvasTexture | null = null;
let dotTexture: THREE.CanvasTexture | null = null;
let rippleTexture: THREE.CanvasTexture | null = null;

export function getCursorTexture(style: CursorStyle): THREE.CanvasTexture {
  if (style === "arrow") {
    if (!arrowTexture) {
      const size = 128;
      const canvas = createOffscreen(size, size);
      if (!canvas) {
        arrowTexture = createDummyTexture();
        return arrowTexture;
      }
      const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 4;

      ctx.beginPath();
      // Sleek original vector arrow pointing towards (12, 12)
      ctx.moveTo(14, 14);
      ctx.lineTo(14, 96);
      ctx.lineTo(36, 76);
      ctx.lineTo(54, 114);
      ctx.lineTo(68, 106);
      ctx.lineTo(50, 68);
      ctx.lineTo(82, 68);
      ctx.closePath();

      ctx.fillStyle = "#FFFFFF";
      ctx.fill();

      ctx.lineWidth = 4;
      ctx.strokeStyle = "#111113";
      ctx.stroke();
      ctx.restore();

      arrowTexture = new THREE.CanvasTexture(canvas as unknown as HTMLCanvasElement);
      arrowTexture.colorSpace = THREE.SRGBColorSpace;
      arrowTexture.minFilter = THREE.LinearFilter;
      arrowTexture.magFilter = THREE.LinearFilter;
    }
    return arrowTexture;
  }

  if (style === "pointer") {
    if (!pointerTexture) {
      const size = 128;
      const canvas = createOffscreen(size, size);
      if (!canvas) {
        pointerTexture = createDummyTexture();
        return pointerTexture;
      }
      const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 4;

      // Clean pointing hand with index finger at (20, 16)
      ctx.beginPath();
      ctx.moveTo(28, 18);
      ctx.lineTo(40, 18);
      ctx.lineTo(40, 56);
      ctx.lineTo(54, 56);
      ctx.lineTo(54, 64);
      ctx.lineTo(66, 64);
      ctx.lineTo(66, 72);
      ctx.lineTo(76, 72);
      ctx.lineTo(76, 96);
      ctx.lineTo(48, 112);
      ctx.lineTo(24, 112);
      ctx.lineTo(18, 88);
      ctx.lineTo(18, 62);
      ctx.lineTo(28, 56);
      ctx.closePath();

      ctx.fillStyle = "#FFFFFF";
      ctx.fill();

      ctx.lineWidth = 4;
      ctx.strokeStyle = "#111113";
      ctx.stroke();
      ctx.restore();

      pointerTexture = new THREE.CanvasTexture(canvas as unknown as HTMLCanvasElement);
      pointerTexture.colorSpace = THREE.SRGBColorSpace;
      pointerTexture.minFilter = THREE.LinearFilter;
      pointerTexture.magFilter = THREE.LinearFilter;
    }
    return pointerTexture;
  }

  // Dot style
  if (!dotTexture) {
    const size = 128;
    const canvas = createOffscreen(size, size);
    if (!canvas) {
      dotTexture = createDummyTexture();
      return dotTexture;
    }
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
    ctx.shadowBlur = 6;

    ctx.beginPath();
    ctx.arc(64, 64, 32, 0, Math.PI * 2);
    ctx.fillStyle = "#3b82f6";
    ctx.fill();

    ctx.lineWidth = 4;
    ctx.strokeStyle = "#FFFFFF";
    ctx.stroke();
    ctx.restore();

    dotTexture = new THREE.CanvasTexture(canvas as unknown as HTMLCanvasElement);
    dotTexture.colorSpace = THREE.SRGBColorSpace;
    dotTexture.minFilter = THREE.LinearFilter;
    dotTexture.magFilter = THREE.LinearFilter;
  }
  return dotTexture;
}

export function getRippleTexture(): THREE.CanvasTexture {
  if (!rippleTexture) {
    const size = 128;
    const canvas = createOffscreen(size, size);
    if (!canvas) {
      rippleTexture = createDummyTexture();
      return rippleTexture;
    }
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

    ctx.clearRect(0, 0, size, size);
    ctx.beginPath();
    ctx.arc(64, 64, 56, 0, Math.PI * 2);
    ctx.lineWidth = 8;
    ctx.strokeStyle = "rgba(59, 130, 246, 0.9)";
    ctx.stroke();

    rippleTexture = new THREE.CanvasTexture(canvas as unknown as HTMLCanvasElement);
    rippleTexture.colorSpace = THREE.SRGBColorSpace;
    rippleTexture.minFilter = THREE.LinearFilter;
    rippleTexture.magFilter = THREE.LinearFilter;
  }
  return rippleTexture;
}
