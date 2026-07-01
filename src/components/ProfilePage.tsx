import { useEffect, useState } from "react";
import { buildSafeCarbCyclingPlan as buildCarbCyclingPlan } from "../core/carbCyclingSafePlan";
import { DEFAULT_INPUTS } from "../core/constants";
import { buildStandardPlan } from "../core/standardPlan";
import type { PlanResult, UserInput } from "../core/types";
import { loadInput } from "../storage/localPlan";
import { ProgressTracker } from "./ProgressTracker";

type Language = "en" | "zh";

const LANGUAGE_KEY = "last_chance_language";

const copy = {
  en: {
    eyebrow: "Personal dashboard",
    title: "Profile",
    subtitle: "Log weight, check your trend, and keep the plan calibrated.",
    noPlan: "No saved plan yet",
    noPlanText: "Go to Plan, complete your data, then tap Save plan locally.",
    personal: "Personal data",
    savedPlan: "Saved plan",
    bodySummary: "Body summary",
    planDetails: "Plan details",
    sex: "Sex",
    age: "Age",
    height: "Height",
    weight: "Current weight",
    target: "Target weight",
    timeline: "Timeline",
    activity: "Activity factor",
    trainingDays: "Training days",
    planType: "Plan type",
    calories: "Planned calories",
    weeklyLoss: "Expected weekly loss",
    protein: "Protein factor",
    currentPlan: "Current plan"
  },
  zh: {
    eyebrow: "个人主页",
    title: "Profile",
    subtitle: "记录体重、查看趋势，并让计划持续校准。",
    noPlan: "还没有保存计划",
    noPlanText: "先进入 Plan，填完数据后点击保存到本机。",
    personal: "个人信息",
    savedPlan: "保存的计划",
    bodySummary: "身体摘要",
    planDetails: "计划细节",
    sex: "性别",
    age: "年龄",
    height: "身高",
    weight: "当前体重",
    target: "目标体重",
    timeline: "目标周期",
    activity: "活动系数",
    trainingDays: "训练天数",
    planType: "计划类型",
    calories: "计划热量",
    weeklyLoss: "预计周下降",
    protein: "蛋白系数",
    currentPlan: "当前计划"
  }
} as const;

export function ProfilePage() {
  const [language, setLanguage] = useState<Language>(loadLanguage);
  const [source, setSource] = useState(() => buildProfileSource());

  useEffect(() => {
    const refresh = () => setSource(buildProfileSource());
    window.addEventListener("focus", refresh);
    window.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  const t = copy[language];

  function handleLanguageChange(nextLanguage: Language) {
    setLanguage(nextLanguage);
    window.localStorage.setItem(LANGUAGE_KEY, nextLanguage);
  }

  return (
    <main className="app-shell profile-shell">
      <section className="hero profile-hero">
        <div className="hero-topline">
          <p className="eyebrow">{t.eyebrow}</p>
          <div className="language-toggle" aria-label="Language selector">
            <button className={language === "en" ? "active" : ""} onClick={() => handleLanguageChange("en")} type="button">EN</button>
            <button className={language === "zh" ? "active" : ""} onClick={() => handleLanguageChange("zh")} type="button">中文</button>
          </div>
        </div>
        <h1 className="hero-title">Profile</h1>
        <p className="hero-subtitle">{t.subtitle}</p>
      </section>

      {!source.savedInput && (
        <section className="card">
          <div className="card-title">{t.noPlan}</div>
          <p className="small-note no-margin">{t.noPlanText}</p>
        </section>
      )}

      <ProgressTracker
        language={language}
        plannedDailyCalories={source.plannedDailyCalories}
        expectedWeeklyLossKg={source.expectedWeeklyLossKg}
        defaultWeightKg={source.defaultWeightKg}
      />

      {source.savedInput && (
        <section className="card profile-summary-card profile-body-card">
          <div className="profile-section-head">
            <div>
              <div className="card-title">{t.bodySummary}</div>
              <p className="small-note no-margin">{t.currentPlan}</p>
            </div>
          </div>
          <div className="profile-metric-grid profile-priority-grid">
            <ProfileMetric label={t.weight} value={`${source.savedInput.weightKg} kg`} />
            <ProfileMetric label={t.target} value={source.savedInput.targetWeightKg ? `${source.savedInput.targetWeightKg} kg` : "—"} />
            <ProfileMetric label={t.timeline} value={source.savedInput.expectedTimelineWeeks ? `${source.savedInput.expectedTimelineWeeks} weeks` : "—"} />
          </div>
          <details className="profile-details">
            <summary>{t.planDetails}</summary>
            <div className="profile-detail-list">
              <ProfileDetail label={t.sex} value={source.savedInput.sex} />
              <ProfileDetail label={t.age} value={String(source.savedInput.age)} />
              <ProfileDetail label={t.height} value={`${source.savedInput.heightCm} cm`} />
              <ProfileDetail label={t.planType} value={source.savedInput.planType} />
              <ProfileDetail label={t.activity} value={String(source.savedInput.activityFactor)} />
              <ProfileDetail label={t.trainingDays} value={`${source.savedInput.trainingDaysPerWeek}/week`} />
              <ProfileDetail label={t.protein} value={`${source.savedInput.proteinFactor} g/kg`} />
            </div>
          </details>
        </section>
      )}
    </main>
  );
}

function ProfileMetric({ label, value }: { label: string; value: string }) {
  return <div className="profile-metric"><span>{label}</span><strong>{value}</strong></div>;
}

function ProfileDetail({ label, value }: { label: string; value: string }) {
  return <div className="profile-detail"><span>{label}</span><strong>{value}</strong></div>;
}

function buildProfileSource() {
  const savedInput = loadInput();
  const input = savedInput ?? buildDefaultInput();
  const result = buildResult(input);
  const plannedDailyCalories = result.kind === "standard" ? result.daily.calories : Math.round(result.weeklyCalories / 7);
  return { savedInput, plannedDailyCalories, expectedWeeklyLossKg: result.weeklyLossKg, defaultWeightKg: input.weightKg };
}

function buildResult(input: UserInput): PlanResult {
  if (input.sex === "male" && input.planType === "carbCycling") return buildCarbCyclingPlan(input);
  return buildStandardPlan(input);
}

function buildDefaultInput(): UserInput {
  return {
    sex: "male",
    planType: "standard",
    age: 30,
    heightCm: 175,
    weightKg: 80,
    activityFactor: 1.5,
    trainingDaysPerWeek: 4,
    goalRatePctPerWeek: DEFAULT_INPUTS.male.goalRatePctPerWeek,
    proteinFactor: DEFAULT_INPUTS.male.proteinFactor
  };
}

function loadLanguage(): Language {
  if (typeof window === "undefined") return "en";
  return window.localStorage.getItem(LANGUAGE_KEY) === "zh" ? "zh" : "en";
}
