import type { AppCopy, Language } from "../core/appCopy";

interface TimelineRiskView {
  status: "empty" | "maintain" | "safe" | "standard" | "aggressive" | "high" | "blocked";
  title: string;
  detail: string;
  blocked: boolean;
}

interface TuneNumbersStepProps {
  labels: AppCopy;
  language: Language;
  weightKg: number;
  targetWeightKg?: number;
  expectedTimelineWeeks: number;
  age: number;
  heightCm: number;
  trainingDaysPerWeek: number;
  proteinFactor: number;
  timelineRisk: TimelineRiskView;
  onWeightChange: (value: number) => void;
  onTargetWeightChange: (value: number | undefined) => void;
  onExpectedTimelineChange: (value: number) => void;
  onAgeChange: (value: number) => void;
  onHeightChange: (value: number) => void;
  onTrainingDaysChange: (value: number) => void;
  onProteinChange: (value: number) => void;
}

const copy = {
  en: {
    bodyData: "Body data",
    weight: "Weight",
    target: "Target",
    timeline: "Timeline",
    setTarget: "Set target",
    clear: "Clear",
    recommended: "Recommended standard",
    apply: "Apply",
    moreAggressive: "More aggressive",
    moreConservative: "More conservative",
    tooShort: "Timeline too short",
    aggressive: "Aggressive range",
    standard: "Standard range",
    conservative: "Conservative range",
    age: "Age",
    height: "Height",
    training: "Training days",
    protein: "Protein"
  },
  zh: {
    bodyData: "身体数据",
    weight: "体重",
    target: "目标",
    timeline: "周期",
    setTarget: "设置目标",
    clear: "清除",
    recommended: "推荐标准周期",
    apply: "应用",
    moreAggressive: "更激进",
    moreConservative: "更保守",
    tooShort: "时间过短",
    aggressive: "激进区间",
    standard: "标准区间",
    conservative: "保守区间",
    age: "年龄",
    height: "身高",
    training: "训练天数",
    protein: "蛋白"
  }
} as const;

export function TuneNumbersStep({
  labels,
  language,
  weightKg,
  targetWeightKg,
  expectedTimelineWeeks,
  age,
  heightCm,
  trainingDaysPerWeek,
  proteinFactor,
  timelineRisk,
  onWeightChange,
  onTargetWeightChange,
  onExpectedTimelineChange,
  onAgeChange,
  onHeightChange,
  onTrainingDaysChange,
  onProteinChange
}: TuneNumbersStepProps) {
  const t = copy[language];
  const defaultTarget = Math.max(35, Math.min(250, Number((weightKg - 5).toFixed(1))));
  const recommendedTimeline = buildRecommendedStandardTimeline(weightKg, targetWeightKg);
  const targetLabel = targetWeightKg === undefined ? labels.notSet : formatNumber(targetWeightKg, 0.1);

  return (
    <div className="setup-step-pane tune-numbers-pane" key="body-step">
      <div className="setup-step-copy">
        <strong>{labels.stepBodyTitle}</strong>
        <span>{labels.stepBodyDetail}</span>
      </div>

      <section className="tune-numbers-stack" aria-label={t.bodyData}>
        <div className="tune-primary-stack">
          <TunePrimaryCard
            icon="↧"
            title={t.weight}
            value={weightKg}
            suffix="kg"
            min={35}
            max={250}
            step={0.1}
            onChange={onWeightChange}
          />

          <TunePrimaryCard
            icon="◎"
            title={t.target}
            value={targetWeightKg}
            valueLabel={targetLabel}
            suffix="kg"
            min={35}
            max={250}
            step={0.1}
            emptyActionLabel={t.setTarget}
            trailingActionLabel={targetWeightKg === undefined ? undefined : t.clear}
            onEmptyAction={() => onTargetWeightChange(defaultTarget)}
            onTrailingAction={() => onTargetWeightChange(undefined)}
            onChange={onTargetWeightChange}
          />

          <TunePrimaryCard
            icon="□"
            title={t.timeline}
            value={expectedTimelineWeeks}
            suffix="weeks"
            min={1}
            max={156}
            step={1}
            onChange={onExpectedTimelineChange}
            footer={
              <TimelineRiskStrip
                risk={timelineRisk}
                labels={t}
                recommendedTimeline={recommendedTimeline}
                currentTimeline={expectedTimelineWeeks}
                onApplyRecommended={() => onExpectedTimelineChange(recommendedTimeline)}
              />
            }
          />
        </div>

        <div className="tune-secondary-grid" aria-label="Secondary body settings">
          <TuneCompactStepper title={t.age} value={age} suffix="years" min={18} max={80} step={1} onChange={onAgeChange} />
          <TuneCompactStepper title={t.height} value={heightCm} suffix="cm" min={130} max={230} step={1} onChange={onHeightChange} />
          <TuneCompactStepper title={t.training} value={trainingDaysPerWeek} suffix="/wk" min={0} max={6} step={1} onChange={onTrainingDaysChange} />
          <TuneCompactStepper title={t.protein} value={proteinFactor} suffix="g/kg" min={1.4} max={2.4} step={0.1} onChange={onProteinChange} />
        </div>
      </section>
    </div>
  );
}

function TunePrimaryCard({
  icon,
  title,
  value,
  valueLabel,
  suffix,
  min,
  max,
  step,
  emptyActionLabel,
  trailingActionLabel,
  footer,
  onChange,
  onEmptyAction,
  onTrailingAction
}: {
  icon: string;
  title: string;
  value?: number;
  valueLabel?: string;
  suffix: string;
  min: number;
  max: number;
  step: number;
  emptyActionLabel?: string;
  trailingActionLabel?: string;
  footer?: React.ReactNode;
  onChange: (value: number) => void;
  onEmptyAction?: () => void;
  onTrailingAction?: () => void;
}) {
  const isEmpty = value === undefined;
  const displayValue = valueLabel ?? (value === undefined ? "—" : formatNumber(value, step));

  return (
    <article className={`tune-control-card tune-control-card-primary ${isEmpty ? "empty" : ""}`}>
      <div className="tune-card-head">
        <span className="tune-card-icon" aria-hidden="true">{icon}</span>
        <div>
          <span className="tune-card-title">{title}</span>
          <strong className="tune-card-value">{displayValue}{!isEmpty && <em>{suffix}</em>}</strong>
        </div>
        {trailingActionLabel && <button className="tune-clear-pill" type="button" onClick={onTrailingAction}>{trailingActionLabel}</button>}
      </div>

      {isEmpty ? (
        <button className="tune-set-target-button" type="button" onClick={onEmptyAction}>{emptyActionLabel}</button>
      ) : (
        <div className="tune-slider-row">
          <button className="tune-round-stepper" type="button" onClick={() => onChange(clampNumber(value - step, min, max, step))}>−</button>
          <div className="tune-slider-shell">
            <input
              className="tune-premium-range"
              type="range"
              min={min}
              max={max}
              step={step}
              value={value}
              style={{ "--tune-progress": `${progressPercent(value, min, max)}%` } as React.CSSProperties}
              onChange={(event) => onChange(clampNumber(Number(event.target.value), min, max, step))}
            />
            <div className="tune-slider-scale"><span>{formatNumber(min, step)}</span><span>{formatNumber(value, step)}</span><span>{formatNumber(max, step)}</span></div>
          </div>
          <button className="tune-round-stepper" type="button" onClick={() => onChange(clampNumber(value + step, min, max, step))}>+</button>
        </div>
      )}

      {footer}
    </article>
  );
}

function TimelineRiskStrip({
  risk,
  labels,
  recommendedTimeline,
  currentTimeline,
  onApplyRecommended
}: {
  risk: TimelineRiskView;
  labels: typeof copy.en | typeof copy.zh;
  recommendedTimeline: number;
  currentTimeline: number;
  onApplyRecommended: () => void;
}) {
  const riskClass = risk.status === "blocked" ? "blocked" : risk.status === "aggressive" || risk.status === "high" ? "aggressive" : risk.status === "standard" ? "standard" : "safe";
  const shouldShowApply = Number.isFinite(recommendedTimeline) && recommendedTimeline !== currentTimeline;

  return (
    <div className={`tune-risk-strip risk-${riskClass}`}>
      <div className="tune-risk-gradient" aria-hidden="true">
        <span>{labels.tooShort}</span>
        <span>{labels.aggressive}</span>
        <span>{labels.standard}</span>
        <span>{labels.conservative}</span>
        <i />
      </div>
      <div className="tune-risk-copy">
        <div>
          <strong>{risk.title}</strong>
          <span>{risk.detail}</span>
        </div>
        <button className="tune-recommend-pill" type="button" onClick={onApplyRecommended} disabled={!shouldShowApply}>
          {labels.recommended}: {recommendedTimeline}w{shouldShowApply ? ` · ${labels.apply}` : ""}
        </button>
      </div>
    </div>
  );
}

function TuneCompactStepper({ title, value, suffix, min, max, step, onChange }: { title: string; value: number; suffix: string; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return (
    <div className="tune-compact-stepper">
      <span>{title}</span>
      <div className="tune-compact-controls">
        <button type="button" onClick={() => onChange(clampNumber(value - step, min, max, step))}>−</button>
        <strong>{formatNumber(value, step)}<em>{suffix}</em></strong>
        <button type="button" onClick={() => onChange(clampNumber(value + step, min, max, step))}>+</button>
      </div>
    </div>
  );
}

function buildRecommendedStandardTimeline(currentWeightKg: number, targetWeightKg: number | undefined): number {
  if (!Number.isFinite(currentWeightKg) || targetWeightKg === undefined || !Number.isFinite(targetWeightKg) || targetWeightKg >= currentWeightKg) return 12;
  const totalLossKg = currentWeightKg - targetWeightKg;
  const standardWeeklyRate = currentWeightKg * 0.0075;
  return Math.min(156, Math.max(1, Math.ceil(totalLossKg / standardWeeklyRate)));
}

function clampNumber(value: number, min: number, max: number, step: number): number {
  const clamped = Math.min(max, Math.max(min, value));
  return Number(clamped.toFixed(decimalsForStep(step)));
}

function formatNumber(value: number, step: number): string {
  return value.toFixed(decimalsForStep(step));
}

function decimalsForStep(step: number): number {
  const value = String(step);
  return value.includes(".") ? value.split(".")[1].length : 0;
}

function progressPercent(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
}
