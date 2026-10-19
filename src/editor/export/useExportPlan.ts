import { useEffect, useMemo, useState } from "react";
import type { Aspect, ExportSettings } from "../../doc/types";
import { outputDimensions } from "../../export/destinations";
import {
  needsEncoderProbe,
  planExport,
  type EncoderSupport,
  type ExportPlanResult,
} from "../../export/plan";
import { probeVideoEncoders } from "../../export/probe";
import { afterNextPaint } from "../defer";

const NO_PROBE_NEEDED: EncoderSupport = { avc: false, vp9: false };

/** One file of an export: an aspect and the length of the video at that aspect. */
export interface ExportTarget {
  aspect: Aspect;
  duration: number;
}

export interface PlannedFile {
  aspect: Aspect;
  plan: ExportPlanResult;
}

/**
 * Probes the video encoders at each file's size, frame rate and quality, then plans every
 * file against them. `plans` is null while a probe for these settings is running.
 */
export function useExportPlan(
  settings: ExportSettings,
  targets: readonly ExportTarget[],
  open: boolean,
): { probing: boolean; plans: PlannedFile[] | null } {
  const { resolution, fps, quality } = settings;
  const needsProbe = needsEncoderProbe(settings.format);
  const probes = useMemo(
    () =>
      targets.map((t) => {
        const { width, height } = outputDimensions(t.aspect, resolution);
        return { key: `${width}x${height}@${fps}:${quality}`, width, height };
      }),
    [targets, resolution, fps, quality],
  );
  const [probed, setProbed] = useState<Record<string, EncoderSupport>>({});

  useEffect(() => {
    if (!open || !needsProbe) return;
    let cancelled = false;
    // VideoEncoder.isConfigSupported blocks the main thread (60–500 ms per open, measured
    // locally with SwiftShader), so the dialog paints first, with "Checking encoder…".
    const cancelWait = afterNextPaint(() => {
      for (const { key, width, height } of probes) {
        probeVideoEncoders({ width, height, fps, quality }).then((res) => {
          if (cancelled) return;
          setProbed((p) => (p[key] ? p : { ...p, [key]: { avc: res.avc, vp9: res.vp9 } }));
        });
      }
    });
    return () => {
      cancelled = true;
      cancelWait();
    };
  }, [open, needsProbe, probes, fps, quality]);

  const probing = needsProbe && probes.some((p) => !probed[p.key]);
  const plans = useMemo(
    () =>
      probing
        ? null
        : targets.map((t, i) => ({
            aspect: t.aspect,
            plan: planExport(
              settings,
              t.aspect,
              t.duration,
              needsProbe ? probed[probes[i].key] : NO_PROBE_NEEDED,
            ),
          })),
    [probing, probed, probes, settings, targets, needsProbe],
  );
  return { probing, plans };
}
