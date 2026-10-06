import React, { useState } from "react";
import { HexColorPicker } from "react-colorful";
import clsx from "clsx";
import { Pipette } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./Popover";
import { Icon } from "./Icon";

export interface ColorFieldProps {
  value: string; // e.g. '#6366F1'
  onChange: (hex: string) => void;
  paletteSwatches?: string[];
  brandSwatches?: string[];
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

export const ColorField: React.FC<ColorFieldProps> = ({
  value,
  onChange,
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
  brandSwatches,
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

  return (
    <div
      className={clsx(
        "inline-flex items-center gap-2",
        disabled && "opacity-40 pointer-events-none",
        className,
      )}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label={ariaLabel || "Choose color"}
            className="w-7 h-7 rounded-sm border border-[var(--color-line)] shadow-xs shrink-0 cursor-pointer overflow-hidden p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            style={{ backgroundColor: value }}
          />
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
            <span className="text-[12px] font-mono text-[var(--color-text-3)]">HEX</span>
            <input
              type="text"
              value={hexInput}
              onChange={(e) => {
                setHexInput(e.target.value);
                commitHex(e.target.value);
              }}
              className="grow h-7 px-2 font-mono text-[12px] uppercase bg-[var(--color-raised)] text-[var(--color-text)] border border-[var(--color-line)] rounded-xs outline-none focus:border-[var(--color-accent)]"
              maxLength={7}
            />
            {hasEyeDropper && (
              <button
                type="button"
                onClick={handleEyeDrop}
                title="Sample screen color"
                className="w-7 h-7 flex items-center justify-center rounded-xs border border-[var(--color-line)] hover:bg-[var(--color-hover)] text-[var(--color-text-2)] hover:text-[var(--color-text)]"
              >
                <Icon icon={Pipette} size={14} />
              </button>
            )}
          </div>

          {paletteSwatches && paletteSwatches.length > 0 && (
            <div>
              <div className="text-[11px] font-medium text-[var(--color-text-3)] mb-1.5 uppercase tracking-wider">
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
                    className="w-5 h-5 rounded-xs border border-[var(--color-line)] cursor-pointer hover:scale-110 transition-transform"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>
          )}

          {brandSwatches && brandSwatches.length > 0 && (
            <div>
              <div className="text-[11px] font-medium text-[var(--color-text-3)] mb-1.5 uppercase tracking-wider">
                Brand kit
              </div>
              <div className="flex flex-wrap gap-1.5">
                {brandSwatches.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => {
                      onChange(color);
                      setHexInput(color);
                    }}
                    className="w-5 h-5 rounded-xs border border-[var(--color-line)] cursor-pointer hover:scale-110 transition-transform"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>

      <span className="font-mono text-[12px] uppercase text-[var(--color-text-2)] select-none">
        {value}
      </span>
    </div>
  );
};
