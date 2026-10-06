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

const NO_PROBE_NEEDED: EncoderSupport = { avc: false, vp9: false };

/**
 * Probes the video encoders for the current size, frame rate and quality, then plans the
 * export against them. `plan` is null while the probe for these settings is running.
 */
export function useExportPlan(
  settings: ExportSettings,
  aspect: Aspect,
  duration: number,
  open: boolean,
): { probing: boolean; plan: ExportPlanResult | null } {
  const { width, height } = outputDimensions(aspect, settings.resolution);
  const { fps, quality } = settings;
  const needsProbe = needsEncoderProbe(settings.format);
  const probeKey = `${width}x${height}@${fps}:${quality}`;
  const [probed, setProbed] = useState<{ key: string; support: EncoderSupport } | null>(null);

  useEffect(() => {
    if (!open || !needsProbe) return;
    let cancelled = false;
    probeVideoEncoders({ width, height, fps, quality }).then((res) => {
      if (!cancelled) setProbed({ key: probeKey, support: { avc: res.avc, vp9: res.vp9 } });
    });
    return () => {
      cancelled = true;
    };
  }, [open, needsProbe, probeKey, width, height, fps, quality]);

  const probing = needsProbe && probed?.key !== probeKey;
  const support = needsProbe ? probed?.support : NO_PROBE_NEEDED;
  const plan = useMemo(
    () => (probing || !support ? null : planExport(settings, aspect, duration, support)),
    [probing, support, settings, aspect, duration],
  );
  return { probing, plan };
}
