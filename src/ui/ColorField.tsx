import React, { useState } from "react";
import { HexColorPicker } from "react-colorful";
import clsx from "clsx";
import { Pipette } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./Popover";
import { Icon } from "./Icon";
import { Input } from "./Input";

export interface ColorFieldProps {
  value: string; // e.g. '#6366F1'
  onChange: (hex: string) => void;
  /**
   * Draws Layout Stage's colour row: a 36 px field pill with this label on the left and the
   * swatch and hex on the right. Without it, only the swatch and hex show (for a Field).
   */
  label?: string;
  paletteSwatches?: string[];
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

export const ColorField: React.FC<ColorFieldProps> = ({
  value,
  onChange,
  label,
  paletteSwatches = [
    "#0B0B0D",
    "#121215",
    "#26262C",
    "#EDEDF0",
    "#7C93FF",
    "#10B981",
    "#F59E0B",
    "#EF4444",
  ],
  disabled = false,
  className,
  "aria-label": ariaLabel,
}) => {
  const [open, setOpen] = useState(false);
  const [hexInput, setHexInput] = useState(value);

  const hasEyeDropper = typeof window !== "undefined" && "EyeDropper" in window;

  const handleEyeDrop = async () => {
    if (!hasEyeDropper) return;
    try {
      // @ts-expect-error EyeDropper is experimental
      const eyeDropper = new window.EyeDropper();
      const result = await eyeDropper.open();
      if (result.sRGBHex) {
        onChange(result.sRGBHex);
        setHexInput(result.sRGBHex);
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        console.error("EyeDropper failed:", error);
      }
    }
  };

  const commitHex = (val: string) => {
    let clean = val.trim();
    if (!clean.startsWith("#")) clean = `#${clean}`;
    if (/^#[0-9A-Fa-f]{6}$/.test(clean) || /^#[0-9A-Fa-f]{3}$/.test(clean)) {
      onChange(clean);
    }
  };

  const swatchAndHex = (
    <span className="inline-flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          {/* Layout Stage's swatch: a 28 px paper frame at radius 8 around the colour. */}
          <button
            type="button"
            disabled={disabled}
            aria-label={ariaLabel || label || "Choose color"}
            className={clsx(
              "w-7 h-7 p-[3px] shrink-0 rounded-[8px] bg-paper shadow-lift-sm cursor-pointer",
              "hover:shadow-lift-sm-hover transition-shadow duration-120",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            )}
          >
            <span
              className="block w-full h-full rounded-[5px] shadow-[inset_0_0_0_1px_var(--color-line)]"
              style={{ backgroundColor: value }}
            />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3 flex flex-col gap-3">
          <HexColorPicker
            color={value}
            onChange={(c) => {
              onChange(c);
              setHexInput(c);
            }}
            className="!w-full !h-36"
          />

          <div className="flex items-center gap-2">
            <span className="font-num text-[11px] text-text-2">HEX</span>
            <Input
              numeric
              value={hexInput}
              onChange={(e) => {
                setHexInput(e.target.value);
                commitHex(e.target.value);
              }}
              className="grow uppercase"
              maxLength={7}
            />
            {hasEyeDropper && (
              <button
                type="button"
                onClick={handleEyeDrop}
                title="Sample screen color"
                className="w-8 h-8 shrink-0 grid place-items-center rounded-[9px] text-text-2 hover:text-text hover:bg-field transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <Icon icon={Pipette} size={14} />
              </button>
            )}
          </div>

          {paletteSwatches && paletteSwatches.length > 0 && (
            <div>
              <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-2">
                Palette
              </div>
              <div className="flex flex-wrap gap-1.5">
                {paletteSwatches.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => {
                      onChange(color);
                      setHexInput(color);
                    }}
                    className="w-5 h-5 rounded-[5px] shadow-[inset_0_0_0_1px_var(--color-line)] cursor-pointer hover:scale-110 transition-transform"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>

      <span className="font-num text-[11.5px] uppercase tabular-nums text-text-2 select-none">
        {value}
      </span>
    </span>
  );

  if (label === undefined) {
    return (
      <div
        className={clsx(
          "inline-flex items-center",
          disabled && "opacity-40 pointer-events-none",
          className,
        )}
      >
        {swatchAndHex}
      </div>
    );
  }

  // Layout Stage's .crow. The value sits 11 px from the right, as in the pill slider.
  return (
    <div
      className={clsx(
        "flex items-center justify-between gap-2 w-full min-w-0 h-9 px-[11px] rounded-[10px] bg-field",
        disabled && "opacity-40 pointer-events-none",
        className,
      )}
    >
      <span className="whitespace-nowrap text-[12px] font-medium text-text-2 select-none">
        {label}
      </span>
      {swatchAndHex}
    </div>
  );
};
