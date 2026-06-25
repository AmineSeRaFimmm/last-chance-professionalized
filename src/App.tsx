import { useEffect, useMemo, useState } from "react";
import CarbCyclingWeeklyStructure from "./components/CarbCyclingWeeklyStructure";
import { OptionalPlanPickerField, PlanPickerField } from "./components/PlanPickerField";
import type { MacroResult, PlanResult, PlanType, Sex, UserInput } from "./core/types";
import { buildSafeCarbCyclingPlan as buildCarbCyclingPlan } from "./core/carbCyclingSafePlan";
import { ACTIVITY_LEVELS, DEFAULT_INPUTS } from "./core/constants";
import { buildStandardPlan } from "./core/standardPlan";
import { loadInput, saveInput } from "./storage/localPlan";

type Language = "en" | "zh";
type TimelineStatus = "empty" | "maintain" | "safe" | "standard" | "aggressive" | "high" | "blocked";
type SetupStage = "intro" | "form";

const LANGUAGE_KEY = "last_chance_language";
const DEFAULT_TIMELINE_WEEKS = 12;
const MIN_TIMELINE_WEEKS = 1;
const MAX_TIMELINE_WEEKS = 156;
const HARD_TIMELINE_LIMIT_RATE = 0.02;

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

const copy = {
  en: {
    eyebrow: "Evidence-based planner",
    subtitle:
      "A minimal fat-loss planner for calorie deficit, high-protein dieting, and male carb cycling.",
    sex: "Sex",
    male: "Male",
    female: "Female",
    plan: "Plan",
    standard: "Standard",
    carbCycling: "Carb Cycling",
    carbNote:
      "Carb cycling keeps the weekly deficit fixed and shifts carbohydrates toward the hardest resistance-training days.",
    bodyData: "Body data",
    age: "Age",
    height: "Height cm",
    weight: "Weight kg",
    target: "Target kg",
    expectedTimeline: "Expected timeline weeks",
    activity: "Activity",
    trainingDays: "Training days",
    weeklyLoss: "Weekly loss %",
    protein: "Protein g/kg",
    saveLocal: "Save plan locally",
    savedLocal: "Saved locally",
    adjustTimeline: "Adjust timeline first",
    result: "Result",
    calories: "Calories",
    proteinShort: "Protein",
    fat: "Fat",
    carbs: "Carbs",
    high: "High Carb Day",
    medium: "Medium Carb Day",
    low: "Low Carb Day",
    weeklyStructure: "Weekly structure",
    highNote:
      "High-carb days should be assigned to the hardest sessions, not to uncontrolled cheat meals.",
    safety: "Safety notes",
    projection: "Target timeline projection",
    projectionNote:
      "When a target weight is set, this projection follows your expected timeline. If no target is set, it falls back to 12 weeks.",
    week: "Week",
    projectedWeight: "Projected weight",
    expectedLoss: "Expected loss",
    weeklyCheck: "Weekly calorie check",
    targetWeeklyCalories: "Target weekly calories",
    allocatedWeeklyCalories: "Allocated weekly calories",
    difference: "Difference",
    execution: "Execution rules",
    standardRules:
      "Keep calories consistent, hit protein daily, use strength training to preserve lean mass, and adjust only after two weeks of 7-day average weight data.",
    carbRules:
      "Keep weekly calories fixed. Put high-carb days on heavy legs, deadlift, or full-body sessions. Low-carb days are for rest, walking, or light cardio.",
    femaleRules:
      "Use a moderate deficit, do not overreact to premenstrual water-weight changes, and monitor sleep, recovery, menstrual regularity, and hunger.",
    riskSetTarget: "Set target to assess risk",
    riskSetTargetDetail: "Enter a target weight and timeline to calculate the required weekly loss rate.",
    riskNoLossTarget: "Target is not below current weight",
    riskNoLossTargetDetail: "If the target is not fat loss, the app keeps the default weekly loss setting.",
    riskSafe: "Conservative range",
    riskStandard: "Standard range",
    riskAggressive: "Aggressive range",
    riskHigh: "High-risk range",
    riskBlocked: "Timeline too short",
    riskDetail:
      "Requires about {loss} kg/week, equal to {rate}% of body weight per week. Standard recommendation: at least {standardWeeks} weeks; hard minimum: no less than {hardWeeks} weeks.",
    buildFirst: "Build your plan first",
    buildFirstDetail: "Start with the essential data. The app will not show default personal numbers before you save a real plan.",
    startSetup: "Start setup",
    setupHeader: "Plan setup",
    setupSubhead: "Set the core inputs, review the safety status, then save the plan locally.",
    stepBody: "Body data",
    stepGoal: "Goal weight",
    stepTimeline: "Timeline",
    changeData: "Change data",
    close: "Close",
    status: "Status",
    readyTitle: "Your plan is ready",
    readyDetail: "This is your saved local plan. Use Change data when you want to update it.",
    readyBadge: "Saved"
  },
  zh: {
    eyebrow: "证据导向减脂计划",
    subtitle: "极简科学减脂工具：热量缺口、高蛋白饮食，以及男士训练导向碳水循环。",
    sex: "性别",
    male: "男士",
    female: "女士",
    plan: "方案",
    standard: "标准减脂",
    carbCycling: "碳水循环",
    carbNote: "碳水循环保持每周总赤字不变，只把更多碳水分配给最难的力量训练日。",
    bodyData: "身体数据",
    age: "年龄",
    height: "身高 cm",
    weight: "体重 kg",
    target: "目标体重 kg",
    expectedTimeline: "期待完成用时（周）",
    activity: "活动水平",
    trainingDays: "每周训练天数",
    weeklyLoss: "每周下降 %",
    protein: "蛋白 g/kg",
    saveLocal: "保存到本机",
    savedLocal: "已保存",
    adjustTimeline: "先调整目标时间",
    result: "结果",
    calories: "热量",
    proteinShort: "蛋白质",
    fat: "脂肪",
    carbs: "碳水",
    high: "高碳日",
    medium: "中碳日",
    low: "低碳日",
    weeklyStructure: "一周结构",
    highNote: "高碳日应该给最重的训练日，不是用来失控放纵。",
    safety: "安全提示",
    projection: "目标时间预测",
    projectionNote: "设置目标体重后，预测长度会跟随期待完成用时；未设置目标体重时，默认显示 12 周。",
    week: "周数",
    projectedWeight: "预测体重",
    expectedLoss: "预计下降",
    weeklyCheck: "周热量核验",
    targetWeeklyCalories: "目标周热量",
    allocatedWeeklyCalories: "分配周热量",
    difference: "差值",
    execution: "执行规则",
    standardRules: "保持热量稳定，每天打够蛋白，用力量训练保留瘦体重；至少观察两周 7 日平均体重后再调整。",
    carbRules: "保持周热量不变。高碳日给重腿、硬拉、全身大容量训练；低碳日用于休息、步行或轻有氧。",
    femaleRules: "使用温和赤字，不要因经前水重波动误判失败，并持续观察睡眠、恢复、月经规律和饥饿感。",
    riskSetTarget: "设置目标后评估风险",
    riskSetTargetDetail: "输入目标体重和期待完成用时后，系统会计算所需每周下降速度。",
    riskNoLossTarget: "目标体重不低于当前体重",
    riskNoLossTargetDetail: "如果目标不是减重，系统会使用默认每周下降设置。",
    riskSafe: "保守区间",
    riskStandard: "标准区间",
    riskAggressive: "激进区间",
    riskHigh: "高风险区间",
    riskBlocked: "时间过短，不建议生成计划",
    riskDetail:
      "需要约 {loss} kg/周，等于当前体重的 {rate}%/周。标准建议至少 {standardWeeks} 周；硬性最低建议不少于 {hardWeeks} 周。",
    buildFirst: "先建立你的计划",
    buildFirstDetail: "先填写关键数据。保存真实计划之前，App 不展示默认个人数字。",
    startSetup: "开始设置",
    setupHeader: "计划设置",
    setupSubhead: "设置核心输入，检查安全状态，然后保存到本机。",
    stepBody: "身体数据",
    stepGoal: "目标体重",
    stepTimeline: "完成周期",
    changeData: "Change data",
    close: "关闭",
    status: "状态",
    readyTitle: "计划已就绪",
    readyDetail: "这是你已保存的本地计划。需要更新时，点击 Change data。",
    readyBadge: "已保存"
  }
} as const;

export default function App() {
  const savedInput = typeof window !== "undefined" ? loadInput() : null;

  const [language] = useState<Language>(loadLanguage());
  const [sex, setSex] = useState<Sex>(savedInput?.sex ?? "male");
  const [planType, setPlanType] = useState<PlanType>(savedInput?.planType ?? "standard");
  const [age, setAge] = useState(savedInput?.age ?? 30);
  const [heightCm, setHeightCm] = useState(savedInput?.heightCm ?? 175);
  const [weightKg, setWeightKg] = useState(savedInput?.weightKg ?? 80);
  const [targetWeightKg, setTargetWeightKg] = useState<number | undefined>(savedInput?.targetWeightKg);
  const [expectedTimelineWeeks, setExpectedTimelineWeeks] = useState(savedInput?.expectedTimelineWeeks ?? DEFAULT_TIMELINE_WEEKS);
  const [activityFactor, setActivityFactor] = useState(savedInput?.activityFactor ?? 1.5);
  const [trainingDaysPerWeek, setTrainingDaysPerWeek] = useState(savedInput?.trainingDaysPerWeek ?? 4);
  const [proteinFactor, setProteinFactor] = useState(savedInput?.proteinFactor ?? DEFAULT_INPUTS.male.proteinFactor);
  const [saved, setSaved] = useState(false);
  const [hasSavedPlan, setHasSavedPlan] = useState(Boolean(savedInput));
  const [setupOpen, setSetupOpen] = useState(!savedInput);
  const [setupStage, setSetupStage] = useState<SetupStage>(savedInput ? "form" : "intro");

  const t = copy[language];
  const effectivePlanType: PlanType = sex === "female" ? "standard" : planType;
  const timelineRisk = useMemo(() => buildTimelineRisk(weightKg, targetWeightKg, expectedTimelineWeeks, t), [weightKg, targetWeightKg, expectedTimelineWeeks, t]);
  const goalRatePctPerWeek = timelineRisk.planRate ?? DEFAULT_INPUTS[sex].goalRatePctPerWeek;

  const input: UserInput = {
    sex,
    planType: effectivePlanType,
    age,
    heightCm,
    weightKg,
    targetWeightKg,
    expectedTimelineWeeks,
    activityFactor,
    trainingDaysPerWeek,
    goalRatePctPerWeek,
    proteinFactor
  };

  const result = useMemo<PlanResult>(() => {
    if (sex === "male" && effectivePlanType === "carbCycling") return buildCarbCyclingPlan(input);
    return buildStandardPlan(input);
  }, [sex, effectivePlanType, age, heightCm, weightKg, targetWeightKg, expectedTimelineWeeks, activityFactor, trainingDaysPerWeek, goalRatePctPerWeek, proteinFactor]);

  const projection = useMemo(() => buildTimelineProjection(weightKg, result.weeklyLossKg, targetWeightKg, expectedTimelineWeeks), [weightKg, result.weeklyLossKg, targetWeightKg, expectedTimelineWeeks]);

  useEffect(() => setSaved(false), [result, timelineRisk]);

  useEffect(() => {
    document.body.classList.toggle("plan-setup-lock", setupOpen);
    return () => document.body.classList.remove("plan-setup-lock");
  }, [setupOpen]);

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
    if (timelineRisk.blocked) return;
    saveInput(input);
    setSaved(true);
    setHasSavedPlan(true);
    setSetupStage("form");
    setSetupOpen(false);
  }

  function openSetupForm() {
    setSetupStage("form");
    setSetupOpen(true);
  }

  const setupForm = (
    <>
      <section className="card plan-settings-card">
        <div className="card-title">{t.sex}</div>
        <div className="segmented two">
          <button className={sex === "male" ? "active" : ""} onClick={() => handleSexChange("male")} type="button">{t.male}</button>
          <button className={sex === "female" ? "active" : ""} onClick={() => handleSexChange("female")} type="button">{t.female}</button>
        </div>
      </section>

      {sex === "male" && (
        <section className="card plan-settings-card">
          <div className="card-title">{t.plan}</div>
          <div className="segmented two">
            <button className={planType === "standard" ? "active" : ""} onClick={() => setPlanType("standard")} type="button">{t.standard}</button>
            <button className={planType === "carbCycling" ? "active" : ""} onClick={() => setPlanType("carbCycling")} type="button">{t.carbCycling}</button>
          </div>
          <p className="small-note">{t.carbNote}</p>
        </section>
      )}

      <section className="card plan-body-data-card plan-settings-card">
        <div className="card-title">{t.bodyData}</div>
        <div className="picker-grid">
          <PlanPickerField label={t.age} value={age} min={18} max={80} onChange={setAge} />
          <PlanPickerField label={t.height} value={heightCm} min={130} max={230} suffix="cm" onChange={setHeightCm} />
          <PlanPickerField label={t.weight} value={weightKg} min={35} max={250} step={0.1} suffix="kg" onChange={setWeightKg} />
          <OptionalPlanPickerField label={t.target} value={targetWeightKg} defaultValue={Math.max(35, Math.min(250, Number((weightKg - 5).toFixed(1))))} min={35} max={250} step={0.1} suffix="kg" setLabel={language === "zh" ? "设置目标" : "Set target"} clearLabel={language === "zh" ? "清除" : "Clear"} emptyLabel={language === "zh" ? "未设置" : "Not set"} onChange={setTargetWeightKg} />
          <PlanPickerField label={t.expectedTimeline} value={expectedTimelineWeeks} min={MIN_TIMELINE_WEEKS} max={MAX_TIMELINE_WEEKS} suffix="wk" onChange={setExpectedTimelineWeeks} />
          <div className="field">
            <label>{t.activity}</label>
            <select value={activityFactor} onChange={(event) => setActivityFactor(Number(event.target.value))}>
              {ACTIVITY_LEVELS.map((level) => (
                <option key={level.value} value={level.value}>{level.label} · {level.description}</option>
              ))}
            </select>
          </div>
          <PlanPickerField label={t.trainingDays} value={trainingDaysPerWeek} min={0} max={6} suffix="/wk" onChange={setTrainingDaysPerWeek} />
          <PlanPickerField label={t.protein} value={proteinFactor} min={1.4} max={2.4} step={0.1} suffix="g/kg" onChange={setProteinFactor} />
        </div>
        <TimelineRiskPanel risk={timelineRisk} />
      </section>
    </>
  );

  return (
    <main className="app-shell plan-shell">
      <section className="hero">
        <div className="hero-topline">
          <p className="eyebrow">{t.eyebrow}</p>
          {hasSavedPlan && (
            <button className="change-plan-button" onClick={openSetupForm} type="button">
              {t.changeData}
            </button>
          )}
        </div>
        <h1 className="hero-title">Last Chance</h1>
        <p className="hero-subtitle">{t.subtitle}</p>
      </section>

      {hasSavedPlan && (
        <>
          <section className="card accent-card plan-result-card">
            <div className="plan-result-banner">
              <div>
                <div className="card-title">{t.result}</div>
                <h2>{t.readyTitle}</h2>
                <p>{t.readyDetail}</p>
              </div>
              <span>{t.readyBadge}</span>
            </div>
            {result.kind === "standard" ? (
              <MacroGrid data={result.daily} labels={t} />
            ) : (
              <div className="cycle-stack">
                <MacroBlock title={t.high} data={result.highDay} labels={t} />
                <MacroBlock title={t.medium} data={result.mediumDay} labels={t} />
                <MacroBlock title={t.low} data={result.lowDay} labels={t} />
              </div>
            )}
            <div className="summary-line">
              <span>RMR {result.rmr} kcal</span>
              <span>TDEE {result.tdee} kcal</span>
              <span>{t.expectedLoss} {result.weeklyLossKg} kg/week</span>
            </div>
          </section>

          <section className="card plan-home-status-card">
            <div className="card-title">{t.status}</div>
            <TimelineRiskPanel risk={timelineRisk} />
          </section>

          <section className="card">
            <div className="card-title">{t.projection}</div>
            <div className="projection-table">
              {projection.map((row) => (
                <div className="projection-row" key={row.week}>
                  <span>{t.week} {row.week}</span>
                  <strong>{row.weightKg.toFixed(2)} kg</strong>
                </div>
              ))}
            </div>
            <p className="small-note">{t.projectionNote}</p>
          </section>

          <section className="card">
            <div className="card-title">{t.execution}</div>
            <p className="small-note">{sex === "female" ? t.femaleRules : result.kind === "carbCycling" ? t.carbRules : t.standardRules}</p>
          </section>

          {result.warnings.length > 0 && (
            <section className="card">
              <div className="card-title">{t.safety}</div>
              {result.warnings.map((warning) => <div className="warning" key={warning}>{warning}</div>)}
            </section>
          )}
        </>
      )}

      {setupOpen && (
        <section className={`plan-sheet-overlay plan-sheet-${setupStage}`} role="dialog" aria-modal="true" aria-label={setupStage === "intro" ? t.buildFirst : t.setupHeader}>
          {hasSavedPlan && <button className="plan-sheet-backdrop" type="button" aria-label={t.close} onClick={() => setSetupOpen(false)} />}
          <div className="plan-sheet-modal">
            {setupStage === "intro" ? (
              <div className="plan-sheet-intro">
                <div className="card plan-start-card">
                  <div className="card-title">{t.result}</div>
                  <h2>{t.buildFirst}</h2>
                  <p>{t.buildFirstDetail}</p>
                  <div className="setup-step-grid">
                    <span>{t.stepBody}</span>
                    <span>{t.stepGoal}</span>
                    <span>{t.stepTimeline}</span>
                  </div>
                  <button className="primary-button plan-start-button" onClick={() => setSetupStage("form")} type="button">{t.startSetup}</button>
                </div>
              </div>
            ) : (
              <div className="plan-sheet-form">
                <div className="plan-sheet-head">
                  <div>
                    <div className="card-title">{t.setupHeader}</div>
                    <strong>{t.setupHeader}</strong>
                    <span>{t.setupSubhead}</span>
                  </div>
                  {hasSavedPlan && <button type="button" onClick={() => setSetupOpen(false)}>{t.close}</button>}
                </div>
                <div className="plan-setup-progress" aria-hidden="true">
                  <span>{t.sex}</span>
                  <span>{t.plan}</span>
                  <span>{t.bodyData}</span>
                </div>
                <div className="plan-sheet-body">
                  {setupForm}
                </div>
                <div className="plan-sheet-footer">
                  <button className="change-plan-button plan-setup-save-button" disabled={timelineRisk.blocked} onClick={handleSave} type="button">
                    {timelineRisk.blocked ? t.adjustTimeline : saved ? t.savedLocal : t.saveLocal}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}

function NumberField({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input type="number" value={value} min={min} max={max} step={step} onChange={(event) => {
        const nextValue = Number(event.target.value);
        if (Number.isFinite(nextValue)) onChange(nextValue);
      }} />
    </div>
  );
}

function OptionalNumberField({ label, value, min, max, step = 1, onChange }: { label: string; value?: number; min: number; max: number; step?: number; onChange: (value: number | undefined) => void }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input type="number" value={value ?? ""} min={min} max={max} step={step} placeholder="Optional" onChange={(event) => {
        const rawValue = event.target.value.trim();
        if (rawValue === "") {
          onChange(undefined);
          return;
        }
        const nextValue = Number(rawValue);
        if (Number.isFinite(nextValue)) onChange(nextValue);
      }} />
    </div>
  );
}

function TimelineRiskPanel({ risk }: { risk: TimelineRisk }) {
  return (
    <div className={`timeline-risk-panel ${risk.status}`}>
      <strong>{risk.title}</strong>
      <span>{risk.detail}</span>
    </div>
  );
}

function Metric({ label, value, unit }: { label: string; value: number; unit: string }) {
  return <div className="metric"><div className="metric-label">{label}</div><div className="metric-value">{value}<span className="metric-unit">{unit}</span></div></div>;
}

function MacroGrid({ data, labels }: { data: MacroResult; labels: typeof copy.en | typeof copy.zh }) {
  return (
    <div className="metric-grid">
      <Metric label={labels.calories} value={data.calories} unit="kcal" />
      <Metric label={labels.proteinShort} value={data.proteinG} unit="g" />
      <Metric label={labels.fat} value={data.fatG} unit="g" />
      <Metric label={labels.carbs} value={data.carbsG} unit="g" />
    </div>
  );
}

function MacroBlock({ title, data, labels }: { title: string; data: MacroResult; labels: typeof copy.en | typeof copy.zh }) {
  return <div className="macro-block"><h3>{title}</h3><MacroGrid data={data} labels={labels} /></div>;
}

function WeeklyCalorieCheck({ result, labels }: { result: Extract<PlanResult, { kind: "carbCycling" }>; labels: typeof copy.en | typeof copy.zh }) {
  const allocated = result.highDay.calories * result.dayCounts.high + result.mediumDay.calories * result.dayCounts.medium + result.lowDay.calories * result.dayCounts.low;
  const difference = allocated - result.weeklyCalories;

  return (
    <div className="check-grid">
      <div><span>{labels.targetWeeklyCalories}</span><strong>{result.weeklyCalories} kcal</strong></div>
      <div><span>{labels.allocatedWeeklyCalories}</span><strong>{allocated} kcal</strong></div>
      <div><span>{labels.difference}</span><strong>{difference > 0 ? "+" : ""}{difference} kcal</strong></div>
    </div>
  );
}

function buildTimelineRisk(currentWeightKg: number, targetWeightKg: number | undefined, expectedTimelineWeeks: number, labels: typeof copy.en | typeof copy.zh): TimelineRisk {
  if (!Number.isFinite(currentWeightKg) || !Number.isFinite(expectedTimelineWeeks)) return { status: "empty", title: labels.riskSetTarget, detail: labels.riskSetTargetDetail, blocked: false };
  if (targetWeightKg === undefined || !Number.isFinite(targetWeightKg)) return { status: "empty", title: labels.riskSetTarget, detail: labels.riskSetTargetDetail, blocked: false };
  if (targetWeightKg >= currentWeightKg) return { status: "maintain", title: labels.riskNoLossTarget, detail: labels.riskNoLossTargetDetail, blocked: false };

  const weeks = Math.min(MAX_TIMELINE_WEEKS, Math.max(MIN_TIMELINE_WEEKS, Math.round(expectedTimelineWeeks)));
  const totalLossKg = currentWeightKg - targetWeightKg;
  const weeklyLossKg = totalLossKg / weeks;
  const weeklyRate = weeklyLossKg / currentWeightKg;
  const standardWeeks = Math.max(1, Math.ceil(totalLossKg / (currentWeightKg * 0.01)));
  const hardWeeks = Math.max(1, Math.ceil(totalLossKg / (currentWeightKg * HARD_TIMELINE_LIMIT_RATE)));
  const detail = labels.riskDetail
    .replace("{loss}", weeklyLossKg.toFixed(2))
    .replace("{rate}", (weeklyRate * 100).toFixed(2))
    .replace("{standardWeeks}", String(standardWeeks))
    .replace("{hardWeeks}", String(hardWeeks));
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
