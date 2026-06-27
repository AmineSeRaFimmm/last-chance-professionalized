import { useEffect, useMemo, useRef, useState } from "react";
import { PlanChoiceCard } from "./components/PlanChoiceCard";
import { TuneNumbersStep } from "./components/TuneNumbersStep";
import { buildSafeCarbCyclingPlan as buildCarbCyclingPlan } from "./core/carbCyclingSafePlan";
import { ACTIVITY_LEVELS, DEFAULT_INPUTS } from "./core/constants";
import { copy, type AppCopy, type Language } from "./core/appCopy";
import { buildStandardPlan } from "./core/standardPlan";
import type { MacroResult, PlanResult, PlanType, Sex, UserInput } from "./core/types";
import { loadInput, saveInput } from "./storage/localPlan";

type TimelineStatus = "empty" | "maintain" | "safe" | "standard" | "aggressive" | "high" | "blocked";
type SetupStage = "intro" | "plan" | "body" | "review";

const LANGUAGE_KEY = "last_chance_language";
const DEFAULT_TIMELINE_WEEKS = 12;
const MIN_TIMELINE_WEEKS = 1;
const MAX_TIMELINE_WEEKS = 156;
const HARD_TIMELINE_LIMIT_RATE = 0.02;
const SAVE_MORPH_MS = 520;

interface TimelineRisk {
  status: TimelineStatus;
  title: string;
  detail: string;
  blocked: boolean;
  planRate?: number;
}

function loadLanguage(): Language {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(LANGUAGE_KEY);
  return stored === "zh" ? "zh" : "en";
}

function buildSetupDefaultTargetKg(currentWeightKg: number): number {
  return Math.max(35, Math.min(170, Number((currentWeightKg - 5).toFixed(1))));
}

function buildSetupRecommendedTimelineWeeks(currentWeightKg: number, targetWeightKg: number): number {
  if (!Number.isFinite(currentWeightKg) || !Number.isFinite(targetWeightKg) || targetWeightKg >= currentWeightKg) return DEFAULT_TIMELINE_WEEKS;
  const totalLossKg = currentWeightKg - targetWeightKg;
  const standardWeeklyRate = currentWeightKg * 0.0075;
  return Math.min(86, Math.max(1, Math.ceil(totalLossKg / standardWeeklyRate)));
}

export default function AppRef() {
  const savedInput = typeof window !== "undefined" ? loadInput() : null;
  const setupBodyRef = useRef<HTMLDivElement | null>(null);

  const [language] = useState<Language>(loadLanguage());
  const [sex, setSex] = useState<Sex>(savedInput?.sex ?? "male");
  const [planType, setPlanType] = useState<PlanType>(savedInput?.planType ?? "standard");
  const [age, setAge] = useState(savedInput?.age ?? 30);
  const [heightCm, setHeightCm] = useState(savedInput?.heightCm ?? 175);
  const [weightKg, setWeightKg] = useState(savedInput?.weightKg ?? 80);
  const [targetWeightKg, setTargetWeightKg] = useState<number | undefined>(savedInput?.targetWeightKg);
  const [expectedTimelineWeeks, setExpectedTimelineWeeks] = useState(savedInput?.expectedTimelineWeeks ?? DEFAULT_TIMELINE_WEEKS);
  const [timelineManuallyAdjusted, setTimelineManuallyAdjusted] = useState(Boolean(savedInput?.expectedTimelineWeeks));
  const [activityFactor, setActivityFactor] = useState(savedInput?.activityFactor ?? 1.5);
  const [trainingDaysPerWeek, setTrainingDaysPerWeek] = useState(savedInput?.trainingDaysPerWeek ?? 4);
  const [proteinFactor, setProteinFactor] = useState(savedInput?.proteinFactor ?? DEFAULT_INPUTS.male.proteinFactor);
  const [saved, setSaved] = useState(false);
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [hasSavedPlan, setHasSavedPlan] = useState(Boolean(savedInput));
  const [setupOpen, setSetupOpen] = useState(!savedInput);
  const [setupStage, setSetupStage] = useState<SetupStage>(savedInput ? "plan" : "intro");

  const t = copy[language];
  const effectivePlanType: PlanType = sex === "female" ? "standard" : planType;
  const tuneTargetWeightKg = targetWeightKg ?? buildSetupDefaultTargetKg(weightKg);
  const timelineRisk = useMemo(() => buildTimelineRisk(weightKg, targetWeightKg, expectedTimelineWeeks, t), [weightKg, targetWeightKg, expectedTimelineWeeks, t]);
  const goalRatePctPerWeek = timelineRisk.planRate ?? DEFAULT_INPUTS[sex].goalRatePctPerWeek;

  const input: UserInput = { sex, planType: effectivePlanType, age, heightCm, weightKg, targetWeightKg, expectedTimelineWeeks, activityFactor, trainingDaysPerWeek, goalRatePctPerWeek, proteinFactor };

  const result = useMemo<PlanResult>(() => {
    if (sex === "male" && effectivePlanType === "carbCycling") return buildCarbCyclingPlan(input);
    return buildStandardPlan(input);
  }, [sex, effectivePlanType, age, heightCm, weightKg, targetWeightKg, expectedTimelineWeeks, activityFactor, trainingDaysPerWeek, goalRatePctPerWeek, proteinFactor]);

  const projection = useMemo(() => buildTimelineProjection(weightKg, result.weeklyLossKg, targetWeightKg, expectedTimelineWeeks), [weightKg, result.weeklyLossKg, targetWeightKg, expectedTimelineWeeks]);
  const setupStepIndex = setupStage === "plan" ? 1 : setupStage === "body" ? 2 : setupStage === "review" ? 3 : 0;
  const targetLabel = targetWeightKg === undefined ? t.notSet : `${targetWeightKg.toFixed(1)} kg`;
  const coreCalories = result.kind === "standard" ? `${result.daily.calories} kcal` : `${result.weeklyCalories} kcal/week`;

  useEffect(() => setSaved(false), [result, timelineRisk]);

  useEffect(() => {
    document.body.classList.toggle("plan-setup-lock", setupOpen);
    return () => document.body.classList.remove("plan-setup-lock");
  }, [setupOpen]);

  useEffect(() => {
    if (!setupOpen || setupStage !== "body" || targetWeightKg !== undefined) return;
    setTargetWeightKg(buildSetupDefaultTargetKg(weightKg));
  }, [setupOpen, setupStage, targetWeightKg, weightKg]);

  useEffect(() => {
    if (!setupOpen || setupStage !== "body" || timelineManuallyAdjusted || targetWeightKg === undefined || targetWeightKg >= weightKg) return;
    const recommendedTimelineWeeks = buildSetupRecommendedTimelineWeeks(weightKg, targetWeightKg);
    setExpectedTimelineWeeks((current) => (current === recommendedTimelineWeeks ? current : recommendedTimelineWeeks));
  }, [setupOpen, setupStage, timelineManuallyAdjusted, targetWeightKg, weightKg]);

  useEffect(() => {
    if (!setupOpen || setupStage === "intro") return;

    let outerFrame = 0;
    let innerFrame = 0;

    outerFrame = window.requestAnimationFrame(() => {
      innerFrame = window.requestAnimationFrame(() => {
        const setupBody = setupBodyRef.current;
        if (!setupBody) return;
        setupBody.scrollTo({ top: 0, left: 0, behavior: "auto" });
        setupBody.scrollTop = 0;
        setupBody.scrollLeft = 0;
      });
    });

    return () => {
      window.cancelAnimationFrame(outerFrame);
      if (innerFrame) window.cancelAnimationFrame(innerFrame);
    };
  }, [setupOpen, setupStage]);

  function handleSexChange(nextSex: Sex) {
    setSex(nextSex);
    if (nextSex === "female") {
      setPlanType("standard");
      setProteinFactor(DEFAULT_INPUTS.female.proteinFactor);
    } else {
      setProteinFactor(DEFAULT_INPUTS.male.proteinFactor);
    }
  }

  function handleSave() {
    if (timelineRisk.blocked || isSavingPlan) return;
    saveInput(input);
    setSaved(true);
    setIsSavingPlan(true);
    window.setTimeout(() => {
      setHasSavedPlan(true);
      setSetupStage("plan");
      setSetupOpen(false);
      setIsSavingPlan(false);
    }, SAVE_MORPH_MS);
  }

  function handleTuneTimelineChange(value: number) {
    setTimelineManuallyAdjusted(true);
    setExpectedTimelineWeeks(value);
  }

  function openSetupForm() {
    setSetupStage("plan");
    setSetupOpen(true);
  }

  const setupPlanStep = (
    <div className="setup-step-pane" key="plan-step">
      <div className="setup-step-copy"><strong>{t.stepPlanTitle}</strong><span>{t.stepPlanDetail}</span></div>
      <section className="card plan-settings-card plan-choice-section">
        <div className="card-title">{t.sex}</div>
        <div className="choice-card-grid two">
          <PlanChoiceCard title={t.male} subtitle={t.maleChoice} active={sex === "male"} onSelect={() => handleSexChange("male")} />
          <PlanChoiceCard title={t.female} subtitle={t.femaleChoice} active={sex === "female"} onSelect={() => handleSexChange("female")} />
        </div>
      </section>
      {sex === "male" && (
        <section className="card plan-settings-card plan-choice-section">
          <div className="card-title">{t.plan}</div>
          <div className="choice-card-grid two">
            <PlanChoiceCard title={t.standard} subtitle={t.standardChoice} active={planType === "standard"} onSelect={() => setPlanType("standard")} />
            <PlanChoiceCard title={t.carbCycling} subtitle={t.carbChoice} active={planType === "carbCycling"} onSelect={() => setPlanType("carbCycling")} />
          </div>
          <p className="small-note">{t.carbNote}</p>
        </section>
      )}
      <section className="card plan-settings-card plan-choice-section">
        <div className="card-title">{t.activity}</div>
        <div className="choice-card-grid two">
          {ACTIVITY_LEVELS.map((level) => <PlanChoiceCard key={level.value} title={level.label} subtitle={level.description} active={activityFactor === level.value} onSelect={() => setActivityFactor(level.value)} />)}
        </div>
      </section>
    </div>
  );

  const setupBodyStep = (
    <TuneNumbersStep
      labels={t}
      language={language}
      weightKg={weightKg}
      targetWeightKg={tuneTargetWeightKg}
      expectedTimelineWeeks={expectedTimelineWeeks}
      age={age}
      heightCm={heightCm}
      trainingDaysPerWeek={trainingDaysPerWeek}
      proteinFactor={proteinFactor}
      timelineRisk={timelineRisk}
      onWeightChange={setWeightKg}
      onTargetWeightChange={setTargetWeightKg}
      onExpectedTimelineChange={handleTuneTimelineChange}
      onAgeChange={setAge}
      onHeightChange={setHeightCm}
      onTrainingDaysChange={setTrainingDaysPerWeek}
      onProteinChange={setProteinFactor}
    />
  );

  const setupReviewStep = (
    <div className="setup-step-pane" key="review-step">
      <div className="setup-step-copy"><strong>{t.stepReviewTitle}</strong><span>{t.stepReviewDetail}</span></div>
      <section className="card setup-review-card">
        <div className="card-title">{t.coreTarget}</div>
        <div className="review-hero-row"><strong>{coreCalories}</strong><span>{effectivePlanType === "carbCycling" ? t.carbCycling : t.standard}</span></div>
        <div className="target-insight-grid">
          <div><span>{t.weight}</span><strong>{weightKg.toFixed(1)} kg</strong></div>
          <div><span>{t.target}</span><strong>{targetLabel}</strong></div>
          <div><span>{t.expectedLoss}</span><strong>{result.weeklyLossKg} kg/week</strong></div>
        </div>
      </section>
      <section className="card plan-home-status-card"><div className="card-title">{t.status}</div><TimelineRiskPanel risk={timelineRisk} /></section>
    </div>
  );

  return (
    <main className="app-shell plan-shell">
      <section className="hero">
        <div className="hero-topline">
          <p className="eyebrow">{t.eyebrow}</p>
          {hasSavedPlan && <button className="change-plan-button" onClick={openSetupForm} type="button">{t.changeData}</button>}
        </div>
        <h1 className="hero-title">Last Chance</h1>
        <p className="hero-subtitle">{t.subtitle}</p>
      </section>

      {hasSavedPlan && (
        <div className="plan-dashboard-stack">
          <section className="card accent-card plan-target-card dashboard-reveal reveal-1">
            <div className="plan-result-banner">
              <div>
                <div className="card-title">{t.coreTarget}</div>
                <h2>{coreCalories}</h2>
                <p>{t.readyDetail}</p>
              </div>
              <span>{t.readyBadge}</span>
            </div>
            <div className="target-insight-grid">
              <InsightMetric label={t.planStyle} value={effectivePlanType === "carbCycling" ? t.carbCycling : t.standard} />
              <InsightMetric label={t.proteinShort} value={result.kind === "standard" ? `${result.daily.proteinG} g` : `${result.highDay.proteinG} g`} />
              <InsightMetric label={t.expectedLoss} value={`${result.weeklyLossKg} kg/week`} />
            </div>
          </section>
          <section className="card accent-card plan-result-card dashboard-reveal reveal-2">
            <div className="section-head">
              <div>
                <div className="card-title">{t.result}</div>
                <h2>{result.kind === "standard" ? t.standard : t.carbCycling}</h2>
              </div>
              <span>{result.kind === "standard" ? `${result.daily.calories} kcal` : `${result.weeklyCalories} kcal/week`}</span>
            </div>
            {result.kind === "standard" ? (
              <>
                <MacroGrid data={result.daily} labels={t} />
                <MacroBars data={result.daily} labels={t} />
              </>
            ) : (
              <div className="cycle-stack">
                <MacroBlock title={t.high} data={result.highDay} labels={t} />
                <MacroBlock title={t.medium} data={result.mediumDay} labels={t} />
                <MacroBlock title={t.low} data={result.lowDay} labels={t} />
              </div>
            )}
            <div className="summary-line"><span>RMR {result.rmr} kcal</span><span>TDEE {result.tdee} kcal</span><span>{t.expectedLoss} {result.weeklyLossKg} kg/week</span></div>
          </section>
          <section className="card plan-home-status-card dashboard-reveal reveal-3"><div className="card-title">{t.status}</div><TimelineRiskPanel risk={timelineRisk} /></section>
          <section className="card dashboard-reveal reveal-4">
            <div className="section-head">
              <div>
                <div className="card-title">{t.projection}</div>
                <h2>{targetLabel}</h2>
              </div>
              <span>{expectedTimelineWeeks} wk</span>
            </div>
            <ProjectionPreview rows={projection.slice(0, 8)} />
            <div className="projection-table">{projection.slice(0, 6).map((row) => <div className="projection-row" key={row.week}><span>{t.week} {row.week}</span><strong>{row.weightKg.toFixed(2)} kg</strong></div>)}</div>
            <p className="small-note">{t.projectionNote}</p>
          </section>
          <section className="card dashboard-reveal reveal-5"><div className="card-title">{t.execution}</div><p className="small-note">{sex === "female" ? t.femaleRules : result.kind === "carbCycling" ? t.carbRules : t.standardRules}</p></section>
          {result.warnings.length > 0 && <section className="card dashboard-reveal reveal-6"><div className="card-title">{t.safety}</div>{result.warnings.map((warning) => <div className="warning" key={warning}>{warning}</div>)}</section>}
        </div>
      )}

      {setupOpen && (
        <section className={`plan-sheet-overlay plan-sheet-${setupStage} ${isSavingPlan ? "plan-save-morphing" : ""}`} role="dialog" aria-modal="true" aria-label={setupStage === "intro" ? t.buildFirst : t.setupHeader}>
          {hasSavedPlan && <button className="plan-sheet-backdrop" type="button" aria-label={t.close} onClick={() => setSetupOpen(false)} />}
          <div className="plan-sheet-modal">
            {setupStage === "intro" ? (
              <div className="plan-sheet-intro"><div className="card plan-start-card"><h2>{t.buildFirst}</h2><p>{t.buildFirstDetail}</p><div className="setup-step-grid"><span>{t.stepBody}</span><span>{t.stepGoal}</span><span>{t.stepTimeline}</span></div><button className="primary-button plan-start-button" onClick={() => setSetupStage("plan")} type="button">{t.startSetup}</button></div></div>
            ) : (
              <div className={`plan-sheet-form stage-${setupStage}`}>
                <div className="plan-sheet-head compact"><div><strong>{t.setupHeader}</strong><span>{t.setupSubhead}</span></div>{hasSavedPlan && <button type="button" onClick={() => setSetupOpen(false)}>{t.close}</button>}</div>
                <div className="setup-stage-meter" aria-hidden="true"><span className={setupStepIndex >= 1 ? "active" : ""} /><span className={setupStepIndex >= 2 ? "active" : ""} /><span className={setupStepIndex >= 3 ? "active" : ""} /></div>
                <div className="plan-sheet-body stage-transition-shell" ref={setupBodyRef}>{setupStage === "plan" && setupPlanStep}{setupStage === "body" && setupBodyStep}{setupStage === "review" && setupReviewStep}</div>
                <div className="plan-sheet-footer staged-footer">
                  {setupStage !== "plan" && <button className="setup-secondary-button" type="button" disabled={isSavingPlan} onClick={() => setSetupStage(setupStage === "review" ? "body" : "plan")}>{t.back}</button>}
                  {setupStage === "plan" && <button className="change-plan-button plan-setup-save-button" type="button" onClick={() => setSetupStage("body")}>{t.next}</button>}
                  {setupStage === "body" && <button className="change-plan-button plan-setup-save-button" type="button" onClick={() => setSetupStage("review")}>{t.review}</button>}
                  {setupStage === "review" && <button className={`change-plan-button plan-setup-save-button save-morph-button ${isSavingPlan ? "saving" : ""}`} disabled={timelineRisk.blocked || isSavingPlan} onClick={handleSave} type="button">{isSavingPlan ? t.savedLocal : timelineRisk.blocked ? t.adjustTimeline : saved ? t.savedLocal : t.saveAndView}</button>}
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}

function TimelineRiskPanel({ risk }: { risk: TimelineRisk }) {
  return (
    <div className={`timeline-risk-panel ${risk.status}`}>
      <div className="timeline-risk-head"><i aria-hidden="true" /><strong>{risk.title}</strong></div>
      <span>{risk.detail}</span>
      <div className="timeline-risk-track" aria-hidden="true"><b /></div>
    </div>
  );
}

function InsightMetric({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function Metric({ label, value, unit }: { label: string; value: number; unit: string }) {
  return <div className="metric"><div className="metric-label">{label}</div><div className="metric-value">{value}<span className="metric-unit">{unit}</span></div></div>;
}

function MacroGrid({ data, labels }: { data: MacroResult; labels: AppCopy }) {
  return <div className="metric-grid"><Metric label={labels.calories} value={data.calories} unit="kcal" /><Metric label={labels.proteinShort} value={data.proteinG} unit="g" /><Metric label={labels.fat} value={data.fatG} unit="g" /><Metric label={labels.carbs} value={data.carbsG} unit="g" /></div>;
}

function MacroBlock({ title, data, labels }: { title: string; data: MacroResult; labels: AppCopy }) {
  return <div className="macro-block"><h3>{title}</h3><MacroGrid data={data} labels={labels} /><MacroBars data={data} labels={labels} /></div>;
}

function MacroBars({ data, labels }: { data: MacroResult; labels: AppCopy }) {
  const proteinCalories = data.proteinG * 4;
  const fatCalories = data.fatG * 9;
  const carbCalories = data.carbsG * 4;
  const total = Math.max(1, proteinCalories + fatCalories + carbCalories);
  const bars = [
    { label: labels.proteinShort, value: data.proteinG, unit: "g", color: "protein", percent: (proteinCalories / total) * 100 },
    { label: labels.carbs, value: data.carbsG, unit: "g", color: "carbs", percent: (carbCalories / total) * 100 },
    { label: labels.fat, value: data.fatG, unit: "g", color: "fat", percent: (fatCalories / total) * 100 }
  ];

  return (
    <div className="macro-bars">
      {bars.map((bar) => (
        <div className={`macro-bar ${bar.color}`} key={bar.label}>
          <div><span>{bar.label}</span><strong>{bar.value}{bar.unit}</strong></div>
          <i aria-hidden="true"><b style={{ width: `${bar.percent}%` }} /></i>
        </div>
      ))}
    </div>
  );
}

function ProjectionPreview({ rows }: { rows: Array<{ week: number; weightKg: number }> }) {
  if (rows.length === 0) return null;
  const weights = rows.map((row) => row.weightKg);
  const max = Math.max(...weights);
  const min = Math.min(...weights);
  const range = Math.max(0.1, max - min);

  return (
    <div className="projection-preview" aria-hidden="true">
      {rows.map((row) => {
        const height = 26 + ((row.weightKg - min) / range) * 58;
        return <i key={row.week} style={{ height: `${height}px` }} />;
      })}
    </div>
  );
}

function buildTimelineRisk(currentWeightKg: number, targetWeightKg: number | undefined, expectedTimelineWeeks: number, labels: AppCopy): TimelineRisk {
  if (!Number.isFinite(currentWeightKg) || !Number.isFinite(expectedTimelineWeeks)) return { status: "empty", title: labels.riskSetTarget, detail: labels.riskSetTargetDetail, blocked: false };
  if (targetWeightKg === undefined || !Number.isFinite(targetWeightKg)) return { status: "empty", title: labels.riskSetTarget, detail: labels.riskSetTargetDetail, blocked: false };
  if (targetWeightKg >= currentWeightKg) return { status: "maintain", title: labels.riskNoLossTarget, detail: labels.riskNoLossTargetDetail, blocked: false };

  const weeks = Math.min(MAX_TIMELINE_WEEKS, Math.max(MIN_TIMELINE_WEEKS, Math.round(expectedTimelineWeeks)));
  const totalLossKg = currentWeightKg - targetWeightKg;
  const weeklyLossKg = totalLossKg / weeks;
  const weeklyRate = weeklyLossKg / currentWeightKg;
  const standardWeeks = Math.max(1, Math.ceil(totalLossKg / (currentWeightKg * 0.01)));
  const hardWeeks = Math.max(1, Math.ceil(totalLossKg / (currentWeightKg * HARD_TIMELINE_LIMIT_RATE)));
  const detail = labels.riskDetail.replace("{loss}", weeklyLossKg.toFixed(2)).replace("{rate}", (weeklyRate * 100).toFixed(2)).replace("{standardWeeks}", String(standardWeeks)).replace("{hardWeeks}", String(hardWeeks));
  const planRate = Math.min(HARD_TIMELINE_LIMIT_RATE, Math.max(0.002, weeklyRate));

  if (weeklyRate > HARD_TIMELINE_LIMIT_RATE) return { status: "blocked", title: labels.riskBlocked, detail, blocked: true, planRate };
  if (weeklyRate > 0.015) return { status: "high", title: labels.riskHigh, detail, blocked: false, planRate };
  if (weeklyRate > 0.01) return { status: "aggressive", title: labels.riskAggressive, detail, blocked: false, planRate };
  if (weeklyRate >= 0.005) return { status: "standard", title: labels.riskStandard, detail, blocked: false, planRate };
  return { status: "safe", title: labels.riskSafe, detail, blocked: false, planRate };
}

function buildTimelineProjection(currentWeightKg: number, weeklyLossKg: number, targetWeightKg: number | undefined, expectedTimelineWeeks: number) {
  const hasWeightTarget = Number.isFinite(targetWeightKg) && targetWeightKg !== undefined && targetWeightKg < currentWeightKg;
  const totalWeeks = hasWeightTarget ? Math.min(MAX_TIMELINE_WEEKS, Math.max(MIN_TIMELINE_WEEKS, Math.round(expectedTimelineWeeks))) : DEFAULT_TIMELINE_WEEKS;
  const target = hasWeightTarget ? targetWeightKg : undefined;
  const projectionWeeklyLossKg = target !== undefined ? (currentWeightKg - target) / totalWeeks : weeklyLossKg;

  return Array.from({ length: totalWeeks }, (_, index) => {
    const week = index + 1;
    const rawWeight = currentWeightKg - projectionWeeklyLossKg * week;
    const weightKg = target !== undefined ? Math.max(rawWeight, target) : rawWeight;
    return { week, weightKg };
  });
}
