import type { ReactNode } from "react";
import { RotateCcw } from "lucide-react";
export function Section({
  title,
  children,
  open = false,
  onReset,
}: {
  title: string;
  children: ReactNode;
  open?: boolean;
  onReset?: () => void;
}) {
  return (
    <details className="setting-section" open={open}>
      <summary>
        <span>{title}</span>
        {onReset && (
          <button
            aria-label={`Reset ${title.toLowerCase()}`}
            title={`Reset ${title}`}
            onClick={(e) => {
              e.preventDefault();
              onReset();
            }}
          >
            <RotateCcw size={13} />
          </button>
        )}
      </summary>
      <div className="section-content">{children}</div>
    </details>
  );
}
export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onChange,
  begin,
  end,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
  begin?: () => void;
  end?: () => void;
}) {
  return (
    <label className="slider-control">
      <span className="control-heading">
        <span>{label}</span>
        <span className="number-wrap">
          <input
            aria-label={`${label} value`}
            type="number"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => {
              if (e.target.value !== "")
                onChange(
                  Math.min(max, Math.max(min, Math.round(Number(e.target.value) / step) * step)),
                );
            }}
          />
          <span>{unit}</span>
        </span>
      </span>
      <input
        aria-label={label}
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        style={
          {
            "--range-progress": `${((value - min) / (max - min)) * 100}%`,
          } as React.CSSProperties
        }
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          begin?.();
        }}
        onPointerUp={end}
        onPointerCancel={end}
        onBlur={end}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
export function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | number;
  options: { value: string | number; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="select-control">
      <span>{label}</span>
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
export function Toggle({
  label,
  checked,
  onChange,
  disabled,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label className={`toggle-control ${disabled ? "disabled" : ""}`}>
        <span>{label}</span>
        <input
          role="switch"
          aria-label={label}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="switch-track" aria-hidden="true" />
      </label>
      {hint && <p className="control-hint">{hint}</p>}
    </div>
  );
}
export function Segments({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="segments" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          aria-pressed={o.value === value}
          className={o.value === value ? "selected" : ""}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
export function TextField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="text-field">
      <span>{label}</span>
      <input
        aria-label={label}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
