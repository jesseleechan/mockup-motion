import React from "react";
import type { AssetRef, Shot } from "../../../doc/types";
import {
  defaultSectionKeys,
  resolveResponsiveStops,
  responsiveScreens,
  responsiveShownStops,
  sharedSectionKeys,
} from "../../../motion/responsive-scroll";
import { Button, Field, Section, Switch } from "../../../ui";
import { useShotUpdate } from "./useShotUpdate";

interface ResponsiveScrollSectionProps {
  shot: Shot;
  assets: AssetRef[];
}

/** "works-section" → "Works section". */
function sectionLabel(key: string): string {
  const words = key.replace(/^[a-z]+\./, "").replace(/[-_]+/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Responsive Scroll's stops: which sections both screens stop on. The hold at each stop follows
 * the shot's pace (Pace section, quality bar §2.2), and the shot length follows from both.
 */
export const ResponsiveScrollSection: React.FC<ResponsiveScrollSectionProps> = ({
  shot,
  assets,
}) => {
  const update = useShotUpdate(shot.id);
  const { layout, scroll } = shot;
  if (layout.kind !== "responsive" || !scroll?.enabled) return null;

  const screens = responsiveScreens(layout, assets);
  const withSections = screens?.every((s) => s.sections && s.sections.length > 0) ?? false;
  // A section at the top of every page is the first stop already, so it isn't offered.
  const shared =
    screens && withSections
      ? sharedSectionKeys(screens).filter((key) =>
          screens.some((s) => (s.sections?.find((x) => x.id === key)?.top ?? 0) > 0),
        )
      : [];
  const stops = screens ? resolveResponsiveStops(scroll, screens) : null;
  const active = new Set(stops?.sections ?? []);
  const shown = screens ? responsiveShownStops(scroll, screens) : 0;
  const leftOut = stops ? stops.px.length - shown : 0;

  let note: string | undefined;
  if (screens && !withSections) note = "Add the capture's JSON file to stop on sections.";
  else if (screens && shared.length === 0) {
    note = "These pages share no sections, so stops are spaced evenly.";
  }

  const toggle = (key: string, on: boolean) =>
    update(
      (target) => {
        if (!target.scroll || !screens) return;
        const current = new Set(target.scroll.sections ?? defaultSectionKeys(screens));
        if (on) current.add(key);
        else current.delete(key);
        // Page order, so the scroll never goes back (quality bar §2.5).
        target.scroll.sections = shared.filter((k) => current.has(k));
      },
      { label: on ? "Add scroll stop" : "Remove scroll stop" },
    );

  return (
    <Section title="Scroll stops">
      <div className="space-y-3">
        {note && (
          <p
            data-testid="responsive-scroll-note"
            className="text-[11px] text-[var(--color-text-3)]"
          >
            {note}
          </p>
        )}

        {shared.length > 0 && (
          <Field
            label="Stop on"
            stacked
            hint={
              leftOut > 0
                ? `${leftOut} ${leftOut === 1 ? "stop is" : "stops are"} left out to fit 30 s.`
                : "Both screens hold with the section at the top."
            }
          >
            <div className="space-y-1.5">
              {shared.map((key) => (
                <label key={key} className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-[var(--color-text)]">{sectionLabel(key)}</span>
                  <Switch
                    aria-label={`Stop on ${sectionLabel(key)}`}
                    checked={active.has(key)}
                    onCheckedChange={(on) => toggle(key, on)}
                  />
                </label>
              ))}
              {scroll.sections !== undefined && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    update(
                      (target) => {
                        if (target.scroll) delete target.scroll.sections;
                      },
                      { label: "Use default scroll stops" },
                    )
                  }
                >
                  Use default stops
                </Button>
              )}
            </div>
          </Field>
        )}
      </div>
    </Section>
  );
};
