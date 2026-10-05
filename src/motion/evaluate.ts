import type {
  Aspect,
  AssetRef,
  CameraPose,
  Layout,
  ProjectDoc,
  Shot,
  Style,
  Transition,
} from "../doc/types";
import { cameraPose } from "./camera";
import { ease } from "./easing";
import { type LayoutNode, resolveLayout } from "./layouts";
import { scrollPosition } from "./scroll";
import { textFrame, type TextFrame } from "./text-anim";
import { activeLayers, schedule } from "./timeline";

export interface ShotFrame {
  shotId: string;
  localT: number;
  camera: CameraPose;
  nodes: LayoutNode[];
  texts: TextFrame[];
  cursor?: { x: number; y: number; pressed: number; nodeId: string };
  style: Style;
}

export interface FrameState {
  t: number;
  total: number;
  backgroundPhase: number;
  layers: { frame: ShotFrame; weight: number }[];
  transition?: {
    kind: Transition["kind"];
    progress: number;
    direction?: Transition["direction"];
  };
}

interface BaseLayoutCacheEntry {
  sig: string;
  baseNodes: LayoutNode[];
}

// Layout memoization cache: (shot.id + aspect) -> BaseLayoutCacheEntry
const layoutCache = new Map<string, BaseLayoutCacheEntry>();

function getAssetsSignature(assets: AssetRef[]): string {
  let sig = "";
  for (let i = 0; i < assets.length; i++) {
    const a = assets[i];
    sig += `${a.id}:${a.width ?? 0}x${a.height ?? 0};`;
  }
  return sig;
}

/**
 * Clear the layout cache (useful for tests or full document reloads).
 */
export function clearLayoutCache(): void {
  layoutCache.clear();
}

function getBaseLayoutNodes(
  shotId: string,
  layout: Layout,
  aspect: Aspect,
  assets: AssetRef[],
  duration: number,
): LayoutNode[] {
  const assetsSig = getAssetsSignature(assets);
  const cacheKey = `${shotId}:${aspect}`;
  const cached = layoutCache.get(cacheKey);

  if (cached && cached.sig === assetsSig) {
    return cached.baseNodes;
  }

  // Base layout evaluated with entrance 'none' at time 0
  const baseNodes = resolveLayout(layout, aspect, assets, 0, duration, "none");
  layoutCache.set(cacheKey, { sig: assetsSig, baseNodes });
  return baseNodes;
}

const ENTRANCE_DURATION = 0.8;

function evaluateNodes(
  shot: Shot,
  aspect: Aspect,
  assets: AssetRef[],
  localT: number,
): LayoutNode[] {
  const baseNodes = getBaseLayoutNodes(shot.id, shot.layout, aspect, assets, shot.duration);
  const entrance = shot.entrance ?? "none";

  // Compute entrance transform & opacity
  const p = Math.max(0, Math.min(1, localT / ENTRANCE_DURATION));
  const e = ease("expoOut", p);

  return baseNodes.map((base, idx) => {
    let opacity: number;
    const transform = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 1.0 };

    switch (entrance) {
      case "rise":
        opacity = e;
        transform.y = -(1 - e) * 0.03;
        break;
      case "scale":
        opacity = e;
        transform.scale = 0.97 + 0.03 * e;
        break;
      case "stagger": {
        const staggerP = Math.max(0, Math.min(1, (localT - idx * 0.1) / ENTRANCE_DURATION));
        const staggerE = ease("expoOut", staggerP);
        opacity = staggerE;
        transform.y = -(1 - staggerE) * 0.03;
        transform.scale = 0.97 + 0.03 * staggerE;
        break;
      }
      case "none":
      default:
        opacity = 1.0;
        break;
    }

    // Scroll calculation
    let scroll = 0;
    if (shot.scroll?.enabled && base.assetId) {
      const asset = assets.find((a) => a.id === base.assetId);
      let scrollableFrames = 0;
      if (asset?.width && asset?.height && asset.height > 0) {
        const imgAspect = asset.width / asset.height;
        scrollableFrames = Math.max(0, base.screenAspect / imgAspect - 1);
      }
      scroll = scrollPosition(shot.scroll, localT, shot.duration, scrollableFrames);
    }

    return {
      ...base,
      transform,
      opacity,
      scroll,
    };
  });
}

function evaluateTexts(shot: Shot, localT: number): TextFrame[] {
  if (!shot.texts || shot.texts.length === 0) {
    return [];
  }
  return shot.texts.map((layer) => {
    const wordCount = layer.text ? layer.text.trim().split(/\s+/).filter(Boolean).length : 0;
    return textFrame(layer, wordCount, localT);
  });
}

function evaluateCursor(
  shot: Shot,
  localT: number,
  firstNodeId: string,
): ShotFrame["cursor"] | undefined {
  if (!shot.cursor?.enabled || !shot.cursor.keys || shot.cursor.keys.length === 0) {
    return undefined;
  }

  const keys = shot.cursor.keys;
  let x = keys[0].x;
  let y = keys[0].y;
  let pressed = 0;

  if (localT <= keys[0].t) {
    x = keys[0].x;
    y = keys[0].y;
  } else if (localT >= keys[keys.length - 1].t) {
    const last = keys[keys.length - 1];
    x = last.x;
    y = last.y;
  } else {
    for (let i = 1; i < keys.length; i++) {
      if (localT <= keys[i].t) {
        const prev = keys[i - 1];
        const next = keys[i];
        const dur = next.t - prev.t;
        const p = dur > 0 ? (localT - prev.t) / dur : 1;
        const e = ease("smooth", Math.max(0, Math.min(1, p)));
        x = prev.x + (next.x - prev.x) * e;
        y = prev.y + (next.y - prev.y) * e;
        break;
      }
    }
  }

  // Check clicks for ripple
  for (const k of keys) {
    if (k.click && localT >= k.t && localT < k.t + 0.3) {
      const clickP = (localT - k.t) / 0.3;
      pressed = Math.max(pressed, ease("backOut", 1 - clickP));
    }
  }

  return { x, y, pressed, nodeId: firstNodeId };
}

/**
 * Pure evaluation function converting document model and time into FrameState.
 * Memoizes base layouts per (shot.id, aspect, assetsSignature).
 */
export function evaluate(doc: ProjectDoc, t: number): FrameState {
  const { total } = schedule(doc);

  let normT: number;
  if (doc.loop && total > 0) {
    if (t === total || t % total === 0) {
      normT = 0;
    } else {
      normT = ((t % total) + total) % total;
    }
  } else {
    normT = total > 0 ? Math.max(0, Math.min(total, t)) : 0;
  }

  const active = activeLayers(doc, normT);
  const backgroundPhase = total > 0 ? normT / total : 0;

  const layers = active.layers.map((activeShot) => {
    const shot = activeShot.shot;
    const localT = activeShot.localT;

    // Camera pose evaluation
    const p = shot.duration > 0 ? Math.max(0, Math.min(1, localT / shot.duration)) : 0;
    const camera = cameraPose(shot.camera, doc.aspect, p, localT, shot.duration);

    // Nodes evaluation with entrance and scroll
    const nodes = evaluateNodes(shot, doc.aspect, doc.assets, localT);

    // Text frames
    const texts = evaluateTexts(shot, localT);

    // Cursor
    const cursor = evaluateCursor(shot, localT, nodes[0]?.id ?? "");

    // Resolved style
    const style: Style = shot.styleOverrides ? { ...doc.style, ...shot.styleOverrides } : doc.style;

    const frame: ShotFrame = {
      shotId: shot.id,
      localT,
      camera,
      nodes,
      texts,
      cursor,
      style,
    };

    return {
      frame,
      weight: activeShot.weight,
    };
  });

  return {
    t: normT,
    total,
    backgroundPhase,
    layers,
    transition: active.transition,
  };
}
