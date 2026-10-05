import type { TextLayer } from "../doc/types";
import { ease } from "./easing";

export interface TextWordFrame {
  index: number;
  opacity: number;
  dy: number; // dy in % frame height
  blur: number;
  clip: number;
}

export interface TextFrame {
  layerId: string;
  words: TextWordFrame[];
  opacity: number;
}

const REVEAL_DURATION = 0.75;
const WORD_STAGGER = 0.08;

/**
 * Computes the animated frame state for a text layer at shot time shotT.
 */
export function textFrame(layer: TextLayer, wordCount: number, shotT: number): TextFrame {
  const count = Math.max(0, wordCount);
  const tRel = shotT - (layer.delay ?? 0);

  if (count === 0) {
    return {
      layerId: layer.id,
      words: [],
      opacity: tRel >= 0 ? 1 : 0,
    };
  }

  if (tRel < 0) {
    const words: TextWordFrame[] = [];
    for (let i = 0; i < count; i++) {
      words.push({ index: i, opacity: 0, dy: 2, blur: 0, clip: 0 });
    }
    return {
      layerId: layer.id,
      words,
      opacity: 0,
    };
  }

  const anim = layer.animation ?? "none";
  const words: TextWordFrame[] = [];

  switch (anim) {
    case "none": {
      for (let i = 0; i < count; i++) {
        words.push({ index: i, opacity: 1, dy: 0, blur: 0, clip: 0 });
      }
      return { layerId: layer.id, words, opacity: 1 };
    }

    case "fadeUp": {
      const p = Math.max(0, Math.min(1, tRel / REVEAL_DURATION));
      const e = ease("expoOut", p);
      for (let i = 0; i < count; i++) {
        words.push({ index: i, opacity: e, dy: (1 - e) * 2.0, blur: 0, clip: 0 });
      }
      return { layerId: layer.id, words, opacity: e };
    }

    case "maskReveal": {
      for (let i = 0; i < count; i++) {
        const rawP = Math.max(0, Math.min(1, (tRel - i * WORD_STAGGER) / REVEAL_DURATION));
        const e = ease("expoOut", rawP);
        words.push({
          index: i,
          opacity: rawP > 0 ? 1 : 0,
          dy: (1 - e) * 3.0,
          blur: 0,
          clip: 1 - e,
        });
      }
      return { layerId: layer.id, words, opacity: 1 };
    }

    case "blurIn": {
      for (let i = 0; i < count; i++) {
        const rawP = Math.max(0, Math.min(1, (tRel - i * WORD_STAGGER) / REVEAL_DURATION));
        const e = ease("expoOut", rawP);
        words.push({
          index: i,
          opacity: e,
          dy: (1 - e) * 1.0,
          blur: (1 - e) * 12,
          clip: 0,
        });
      }
      return { layerId: layer.id, words, opacity: 1 };
    }

    case "wordStagger": {
      for (let i = 0; i < count; i++) {
        const rawP = Math.max(0, Math.min(1, (tRel - i * WORD_STAGGER) / REVEAL_DURATION));
        const e = ease("expoOut", rawP);
        words.push({
          index: i,
          opacity: e,
          dy: (1 - e) * 2.5,
          blur: 0,
          clip: 0,
        });
      }
      return { layerId: layer.id, words, opacity: 1 };
    }

    case "typewriter": {
      for (let i = 0; i < count; i++) {
        const visible = tRel >= (i + 1) * 0.1;
        words.push({
          index: i,
          opacity: visible ? 1 : 0,
          dy: 0,
          blur: 0,
          clip: 0,
        });
      }
      return { layerId: layer.id, words, opacity: 1 };
    }
  }
}
