interface PlanPickerFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}

interface OptionalPlanPickerFieldProps extends Omit<PlanPickerFieldProps, "value" | "onChange"> {
  value?: number;
  defaultValue: number;
  setLabel: string;
  clearLabel: string;
  emptyLabel: string;
  onChange: (value: number | undefined) => void;
}

export function PlanPickerField({ label, value, min, max, step = 1, suffix = "", onChange }: PlanPickerFieldProps) {
  const displayValue = formatNumber(value, step);
  const commit = (nextValue: number) => onChange(clampNumber(nextValue, min, max, step));

  return (
    <div className="picker-field">
      <div className="picker-field-head">
        <label>{label}</label>
        <strong>{displayValue}{suffix && <span>{suffix}</span>}</strong>
      </div>
      <input
        className="picker-range"
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => commit(Number(event.target.value))}
      />
      <div className="picker-stepper">
        <button type="button" onClick={() => commit(value - step)}>−</button>
        <input
          type="number"
          value={displayValue}
          min={min}
          max={max}
          step={step}
          onChange={(event) => {
            const nextValue = Number(event.target.value);
            if (Number.isFinite(nextValue)) commit(nextValue);
          }}
        />
        <button type="button" onClick={() => commit(value + step)}>+</button>
      </div>
    </div>
  );
}

export function OptionalPlanPickerField({ value, defaultValue, setLabel, clearLabel, emptyLabel, onChange, ...props }: OptionalPlanPickerFieldProps) {
  if (value === undefined) {
    return (
      <div className="picker-field optional-picker-field empty">
        <div className="picker-field-head">
          <label>{props.label}</label>
          <strong>{emptyLabel}</strong>
        </div>
        <button className="picker-set-button" type="button" onClick={() => onChange(defaultValue)}>{setLabel}</button>
      </div>
    );
  }

  return (
    <div className="optional-picker-field">
      <PlanPickerField {...props} value={value} onChange={onChange} />
      <button className="picker-clear-button" type="button" onClick={() => onChange(undefined)}>{clearLabel}</button>
    </div>
  );
}

function clampNumber(value: number, min: number, max: number, step: number): number {
  const clamped = Math.min(max, Math.max(min, value));
  const decimals = decimalsForStep(step);
  return Number(clamped.toFixed(decimals));
}

function formatNumber(value: number, step: number): string {
  return value.toFixed(decimalsForStep(step));
}

function decimalsForStep(step: number): number {
  const value = String(step);
  return value.includes(".") ? value.split(".")[1].length : 0;
}
