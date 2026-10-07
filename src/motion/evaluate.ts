import type {
  Aspect,
  AssetRef,
  CameraPose,
  ProjectDoc,
  Shot,
  Style,
  Transition,
} from "../doc/types";
import { cameraPose } from "./camera";
import { frameDistance } from "./framing";
import { type LayoutNode, resolveLayout } from "./layouts";
import { scrollPosition } from "./scroll";
import { textFrame, type TextFrame } from "./text-anim";
import { activeLayers, schedule } from "./timeline";
import { evaluateCursorMotion } from "./cursor";

export interface ShotFrame {
  shotId: string;
  localT: number;
  camera: CameraPose;
  nodes: LayoutNode[];
  texts: TextFrame[];
  cursor?: {
    x: number;
    y: number;
    pressed: number;
    nodeId: string;
    scale?: number;
    rippleRadius?: number;
    rippleOpacity?: number;
    style?: "arrow" | "pointer" | "dot";
  };
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

/**
 * Clear the layout cache (useful for tests or full document reloads).
 */
export function clearLayoutCache(): void {
  // Modular layouts resolve deterministically
}

function isMarquee(shot: Shot): boolean {
  return (
    shot.layout.kind === "rows" || shot.layout.kind === "columns" || shot.layout.kind === "wall"
  );
}

function evaluateNodes(
  shot: Shot,
  aspect: Aspect,
  assets: AssetRef[],
  localT: number,
  layoutT: number,
  layoutDuration: number,
): LayoutNode[] {
  const nodes = resolveLayout(
    shot.layout,
    aspect,
    assets,
    layoutT,
    layoutDuration,
    shot.entrance ?? "none",
  );

  // Scroll calculation (honoured for single-device layouts)
  if (shot.scroll?.enabled && shot.layout.kind === "single" && nodes.length > 0) {
    const base = nodes[0];
    if (base.assetId) {
      const asset = assets.find((a) => a.id === base.assetId);
      let scrollableFrames = 0;
      if (asset?.width && asset?.height && asset.height > 0) {
        const imgAspect = asset.width / asset.height;
        scrollableFrames = Math.max(0, base.screenAspect / imgAspect - 1);
      }
      base.scroll = scrollPosition(shot.scroll, localT, shot.duration, scrollableFrames);
    }
  }

  return nodes;
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
  const result = evaluateCursorMotion(shot.cursor, localT);
  if (!result) return undefined;

  return {
    x: result.x,
    y: result.y,
    pressed: result.pressed,
    nodeId: firstNodeId,
    scale: result.scale,
    rippleRadius: result.ripple?.radius,
    rippleOpacity: result.ripple?.opacity,
    style: result.style,
  };
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
    const baseCamera = cameraPose(shot.camera, doc.aspect, p, localT, shot.duration);

    // Marquees snap their travel to whole card steps per loop when they can (layouts/marquee.ts).
    // A single looping shot loops after `total`, which is shorter than the shot when it has
    // a wrap crossfade; during that crossfade the incoming strip runs on t − total, so both
    // layers show the cards in the same places and only the screens dissolve.
    const marquee = isMarquee(shot);
    const layoutT = marquee ? (activeShot.wrapT ?? localT) : localT;
    const layoutDuration = marquee && doc.loop && doc.shots.length === 1 ? total : shot.duration;

    // Nodes evaluation with entrance and scroll
    const nodes = evaluateNodes(shot, doc.aspect, doc.assets, localT, layoutT, layoutDuration);

    // Auto-framing: keep safe margins under camera moves for bounded layouts
    let camera = baseCamera;
    const isFullBleed = marquee || shot.layout.kind === "title";
    if (!isFullBleed && nodes.length > 0) {
      const multiplier = frameDistance(nodes, doc.aspect, baseCamera);
      if (multiplier > 1.0) {
        camera = {
          ...baseCamera,
          distance: baseCamera.distance * multiplier,
        };
      }
    }

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
