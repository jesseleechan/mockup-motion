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
import { isSteppedLayout, type LayoutNode, resolveLayout } from "./layouts";
import { pillUrls } from "./page-url";
import { scrollableFramesFor, scrollPosition } from "./scroll";
import { responsiveScreens, responsiveScrollAt } from "./responsive-scroll";
import { activeLayers, schedule } from "./timeline";

export interface ShotFrame {
  shotId: string;
  localT: number;
  camera: CameraPose;
  nodes: LayoutNode[];
  style: Style;
}

export interface FrameState {
  t: number;
  total: number;
  layers: { frame: ShotFrame; weight: number }[];
  transition?: {
    kind: Transition["kind"];
    progress: number;
  };
}

/**
 * Clear the layout cache (useful for tests or full document reloads).
 */
export function clearLayoutCache(): void {
  // Modular layouts resolve deterministically
}

/** Frames: rows or columns lanes (Desktop Frames, Mobile Frames). */
function isFrames(shot: Shot): boolean {
  return shot.layout.kind === "rows" || shot.layout.kind === "columns";
}

function evaluateNodes(
  shot: Shot,
  aspect: Aspect,
  assets: AssetRef[],
  localT: number,
  layoutT: number,
  layoutDuration: number,
): LayoutNode[] {
  const nodes = resolveLayout(shot.layout, aspect, assets, layoutT, layoutDuration);

  // Scroll calculation (honoured for single-device layouts)
  if (shot.scroll?.enabled && shot.layout.kind === "single" && nodes.length > 0) {
    const base = nodes[0];
    if (base.assetId) {
      const asset = assets.find((a) => a.id === base.assetId);
      const scrollableFrames = scrollableFramesFor(base.device, base.screenAspect, asset);
      base.scroll = scrollPosition(shot.scroll, localT, shot.duration, scrollableFrames);
    }
  }

  // Responsive Scroll: both screens stop on the same sections (contracts.md §5)
  if (shot.scroll?.enabled && shot.layout.kind === "responsive" && nodes.length === 2) {
    const screens = responsiveScreens(shot.layout, assets);
    if (screens) {
      const [desktop, mobile] = responsiveScrollAt(shot.scroll, screens, localT);
      nodes[0].scroll = desktop;
      nodes[1].scroll = mobile;
    }
  }

  return nodes;
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

  const layers = active.layers.map((activeShot) => {
    const shot = activeShot.shot;
    const localT = activeShot.localT;

    // Camera pose evaluation
    const p = shot.duration > 0 ? Math.max(0, Math.min(1, localT / shot.duration)) : 0;
    const baseCamera = cameraPose(shot.camera, doc.aspect, p);

    // Frames lanes travel one asset period per loop (layouts/lanes.ts). A single looping shot
    // loops after `total`, which is shorter than the shot when it has a wrap crossfade; during
    // that crossfade the incoming lanes run on t − total, so both layers show the cards in the
    // same places and only the screens dissolve.
    const frames = isFrames(shot);
    const layoutT = frames ? (activeShot.wrapT ?? localT) : localT;
    const layoutDuration = frames && doc.loop && doc.shots.length === 1 ? total : shot.duration;

    // Nodes evaluation with scroll
    const nodes = evaluateNodes(shot, doc.aspect, doc.assets, localT, layoutT, layoutDuration);

    // Auto-framing: keep safe margins under camera moves for bounded layouts. A slider's
    // neighbours and an orbit's side cards may be cropped by the frame on purpose (quality bar
    // §4), so they are full bleed.
    let camera = baseCamera;
    const isFullBleed = frames || isSteppedLayout(shot.layout);
    if (!isFullBleed && nodes.length > 0) {
      const multiplier = frameDistance(nodes, doc.aspect, baseCamera);
      if (multiplier > 1.0) {
        camera = {
          ...baseCamera,
          distance: baseCamera.distance * multiplier,
        };
      }
    }

    // Resolved style
    const style: Style = shot.styleOverrides ? { ...doc.style, ...shot.styleOverrides } : doc.style;

    // A Site Tour's browser shows each page's own URL, faded in step with the slide (§4).
    for (const node of nodes) {
      const urls = pillUrls(shot.layout, node, style.browserUrl, doc.assets);
      if (urls) node.urls = urls;
    }

    const frame: ShotFrame = {
      shotId: shot.id,
      localT,
      camera,
      nodes,
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
    layers,
    transition: active.transition,
  };
}
