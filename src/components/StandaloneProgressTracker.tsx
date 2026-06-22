import { useEffect, useState } from "react";
import { buildCarbCyclingPlan } from "../core/carbCyclingPlan";
import { DEFAULT_INPUTS } from "../core/constants";
import { buildStandardPlan } from "../core/standardPlan";
import type { PlanResult, UserInput } from "../core/types";
import { loadInput } from "../storage/localPlan";
import { ProgressTracker } from "./ProgressTracker";

type Language = "en" | "zh";

interface TrackerPlanSource {
  language: Language;
  plannedDailyCalories: number;
  expectedWeeklyLossKg: number;
  defaultWeightKg: number;
}

export function StandaloneProgressTracker() {
  const [source, setSource] = useState<TrackerPlanSource>(() => buildTrackerPlanSource());

  useEffect(() => {
    const refresh = () => setSource(buildTrackerPlanSource());
    window.addEventListener("focus", refresh);
    window.addEventListener("visibilitychange", refresh);

    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  return (
    <main className="app-shell progress-shell">
      <ProgressTracker
        language={source.language}
        plannedDailyCalories={source.plannedDailyCalories}
        expectedWeeklyLossKg={source.expectedWeeklyLossKg}
        defaultWeightKg={source.defaultWeightKg}
      />
    </main>
  );
}

function buildTrackerPlanSource(): TrackerPlanSource {
  const language = loadLanguage();
  const input = loadInput() ?? buildDefaultInput();
  const result = buildResult(input);
  const plannedDailyCalories =
    result.kind === "standard" ? result.daily.calories : Math.round(result.weeklyCalories / 7);

  return {
    language,
    plannedDailyCalories,
    expectedWeeklyLossKg: result.weeklyLossKg,
    defaultWeightKg: input.weightKg
  };
}

function buildResult(input: UserInput): PlanResult {
  if (input.sex === "male" && input.planType === "carbCycling") {
    return buildCarbCyclingPlan(input);
  }

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
  const stored = window.localStorage.getItem("last_chance_language");
  return stored === "zh" ? "zh" : "en";
}
