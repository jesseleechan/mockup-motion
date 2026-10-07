import React from "react";
import clsx from "clsx";

export interface FieldProps {
  label: string;
  children: React.ReactNode;
  /** Current value, shown after the control (or beside a stacked label), e.g. "25%". */
  value?: string;
  /** Puts the label above the control, for wide controls such as grids and text areas. */
  stacked?: boolean;
  /** A short note under the control, e.g. why a setting has no effect here. */
  hint?: React.ReactNode;
  /** Id for the hint, so the control can reference it with aria-describedby. */
  hintId?: string;
  className?: string;
  htmlFor?: string;
}

const labelText = "text-[12px] font-medium text-[var(--color-text-2)] select-none truncate";
const hintText = "text-[11px] leading-4 text-[var(--color-text-3)]";
const valueText =
  "shrink-0 whitespace-nowrap text-right text-[11px] tabular-nums text-[var(--color-text-3)]";

/**
 * A labelled control row. Labels never wrap: the inline label column is 104 px and
 * truncates with an ellipsis (full text in the tooltip). Use `stacked` when a label or
 * control needs the full panel width. The data-field attributes let layout tests check that
 * a label never overlaps its control.
 */
export const Field: React.FC<FieldProps> = ({
  label,
  children,
  value,
  stacked,
  hint,
  hintId,
  className,
}) => {
  const hintLine =
    hint === undefined ? null : (
      <p
        id={hintId}
        // Inline fields indent the hint past the 104 px label column and its 12 px gap.
        className={clsx(hintText, !stacked && "pl-[116px]")}
        data-field-hint=""
      >
        {hint}
      </p>
    );

  if (stacked) {
    return (
      <div className={clsx("flex flex-col gap-1.5 w-full min-w-0", className)} data-field="">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <span className={labelText} title={label} data-field-label="">
            {label}
          </span>
          {value !== undefined && <span className={valueText}>{value}</span>}
        </div>
        <div className="min-w-0" data-field-control="">
          {children}
        </div>
        {hintLine}
      </div>
    );
  }

  const row = (
    <div
      className={clsx("flex items-center gap-3 w-full min-w-0", hintLine === null && className)}
      data-field=""
    >
      <span className={clsx(labelText, "w-[104px] shrink-0")} title={label} data-field-label="">
        {label}
      </span>
      <div className="grow min-w-0" data-field-control="">
        {children}
      </div>
      {value !== undefined && <span className={clsx(valueText, "min-w-8")}>{value}</span>}
    </div>
  );
  if (hintLine === null) return row;

  return (
    <div className={clsx("flex flex-col gap-1 w-full min-w-0", className)}>
      {row}
      {hintLine}
    </div>
  );
};
