import type { CSSProperties } from "react";

type Option<Value extends string> = { value: Value; label: string; ariaLabel?: string };

type Props<Value extends string> = {
  label: string;
  options: readonly Option<Value>[];
  value: Value;
  onChange: (value: Value) => void;
  compact?: boolean;
};

// Controlled buttons keep selection in the parent; CSS moves one shared pill.
export function SegmentedControl<Value extends string>({ label, options, value, onChange, compact = false }: Props<Value>) {
  return <div className={`segmented-control${compact ? " segmented-control-compact" : ""}`} role="group" aria-label={label}
    style={{ "--segment-count": options.length, "--selected-index": options.findIndex((option) => option.value === value) } as CSSProperties}>
    {options.map((option) => <button key={option.value} type="button" aria-label={option.ariaLabel} aria-pressed={option.value === value} onClick={() => onChange(option.value)}>{option.label}</button>)}
  </div>;
}
