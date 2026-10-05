declare module "gifenc" {
  export interface QuantizeOptions {
    format?: "rgb565" | "rgb444" | "rgba4444";
    clearAlpha?: boolean;
    clearAlphaColor?: number;
    clearAlphaThreshold?: number;
    oneBitAlpha?: boolean;
    useSqrt?: boolean;
  }

  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    opts?: QuantizeOptions,
  ): number[][];

  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: number[][],
    format?: "rgb565" | "rgb444" | "rgba4444",
  ): Uint8Array;

  export interface WriteFrameOptions {
    palette?: number[][];
    delay?: number;
    repeat?: number;
    transparent?: boolean;
    transparentIndex?: number;
    dispose?: number;
  }

  export interface GIFEncoderInstance {
    writeFrame: (
      index: Uint8Array,
      width: number,
      height: number,
      opts?: WriteFrameOptions,
    ) => void;
    finish: () => void;
    bytes: () => Uint8Array;
    stream: () => unknown;
  }

  export function GIFEncoder(opts?: { auto?: boolean }): GIFEncoderInstance;
}
