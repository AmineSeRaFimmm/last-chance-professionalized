import type { CarbCyclingPlanResult, MacroResult, UserInput } from "./types";
import {
  buildMacroResult,
  calculateCutCalories,
  calculateRMR,
  calculateTDEE
} from "./formulas";
import { buildCarbCycleWarnings } from "./warnings";

type CarbDayType = "high" | "medium" | "low";

const HIGH_DAY_CALORIE_MULTIPLIER = 1.18;
const MEDIUM_DAY_CALORIE_MULTIPLIER = 1.0;
const HIGH_DAY_TDEE_CAP = 0.95;

const FAT_TARGET_G_PER_KG: Record<CarbDayType, number> = {
  high: 0.45,
  medium: 0.6,
  low: 0.7
};

const MIN_FAT_G_PER_KG = 0.3;
const MIN_FAT_G = 20;

function getCarbCycleDayCounts(trainingDays: number) {
  if (trainingDays >= 4) return { high: 2, medium: 2, low: 3 };
  return { high: 2, medium: 1, low: 4 };
}

function buildWeeklySchedule(trainingDays: number) {
  if (trainingDays >= 4) {
    return [
      { day: "Mon", type: "High" as const, note: "Heavy legs" },
      { day: "Tue", type: "Medium" as const, note: "Upper body" },
      { day: "Wed", type: "Low" as const, note: "Walk / recovery" },
      { day: "Thu", type: "High" as const, note: "Back / deadlift" },
      { day: "Fri", type: "Medium" as const, note: "Upper body" },
      { day: "Sat", type: "Low" as const, note: "Light cardio" },
      { day: "Sun", type: "Low" as const, note: "Rest" }
    ];
  }

  return [
    { day: "Mon", type: "High" as const, note: "Hardest strength session" },
    { day: "Tue", type: "Low" as const, note: "Walk / recovery" },
    { day: "Wed", type: "Medium" as const, note: "Strength session" },
    { day: "Thu", type: "Low" as const, note: "Rest" },
    { day: "Fri", type: "High" as const, note: "Second hard session" },
    { day: "Sat", type: "Low" as const, note: "Light cardio" },
    { day: "Sun", type: "Low" as const, note: "Rest" }
  ];
}

function getMinimumFatG(referenceWeight: number): number {
  return Math.max(MIN_FAT_G, MIN_FAT_G_PER_KG * referenceWeight);
}

function getMinimumCarbsG(type: CarbDayType, referenceWeight: number): number {
  if (type === "high") return Math.max(80, 1.0 * referenceWeight);
  if (type === "medium") return Math.max(50, 0.6 * referenceWeight);
  return Math.max(25, 0.35 * referenceWeight);
}

function getMinimumCalories(
  type: CarbDayType,
  proteinG: number,
  referenceWeight: number
): number {
  return proteinG * 4 + getMinimumFatG(referenceWeight) * 9 + getMinimumCarbsG(type, referenceWeight) * 4;
}

function calculateDayCalories({
  avgCalories,
  dayCounts,
  proteinG,
  referenceWeight,
  tdee,
  weeklyCalories
}: {
  avgCalories: number;
  dayCounts: { high: number; medium: number; low: number };
  proteinG: number;
  referenceWeight: number;
  tdee: number;
  weeklyCalories: number;
}) {
  const highFloor = getMinimumCalories("high", proteinG, referenceWeight);
  const mediumFloor = getMinimumCalories("medium", proteinG, referenceWeight);
  const lowFloor = getMinimumCalories("low", proteinG, referenceWeight);

  const targetHighCalories = Math.max(
    highFloor,
    Math.min(tdee * HIGH_DAY_TDEE_CAP, avgCalories * HIGH_DAY_CALORIE_MULTIPLIER)
  );
  const targetMediumCalories = Math.max(mediumFloor, avgCalories * MEDIUM_DAY_CALORIE_MULTIPLIER);

  const lowProtectedBudget = weeklyCalories - dayCounts.low * lowFloor;
  const highMediumFloorBudget =
    dayCounts.high * highFloor + dayCounts.medium * mediumFloor;

  if (lowProtectedBudget <= highMediumFloorBudget) {
    const highCalories = highFloor;
    const mediumCalories = mediumFloor;
    const lowCalories = Math.max(
      proteinG * 4 + getMinimumFatG(referenceWeight) * 9,
      (weeklyCalories - dayCounts.high * highCalories - dayCounts.medium * mediumCalories) /
        dayCounts.low
    );

    return { highCalories, mediumCalories, lowCalories };
  }

  const targetHighMediumBudget =
    dayCounts.high * targetHighCalories + dayCounts.medium * targetMediumCalories;

  if (targetHighMediumBudget <= lowProtectedBudget) {
    return {
      highCalories: targetHighCalories,
      mediumCalories: targetMediumCalories,
      lowCalories:
        (weeklyCalories -
          dayCounts.high * targetHighCalories -
          dayCounts.medium * targetMediumCalories) /
        dayCounts.low
    };
  }

  const compressionRatio =
    (lowProtectedBudget - highMediumFloorBudget) /
    (targetHighMediumBudget - highMediumFloorBudget);

  const highCalories =
    highFloor + (targetHighCalories - highFloor) * compressionRatio;
  const mediumCalories =
    mediumFloor + (targetMediumCalories - mediumFloor) * compressionRatio;

  return {
    highCalories,
    mediumCalories,
    lowCalories:
      (weeklyCalories - dayCounts.high * highCalories - dayCounts.medium * mediumCalories) /
      dayCounts.low
  };
}

function buildFeasibleMacroResult(
  type: CarbDayType,
  calories: number,
  proteinG: number,
  referenceWeight: number
): MacroResult {
  const targetFatG = FAT_TARGET_G_PER_KG[type] * referenceWeight;
  const minimumFatG = getMinimumFatG(referenceWeight);
  const maximumFatG = Math.max(0, (calories - proteinG * 4) / 9);
  const fatG = Math.max(0, Math.min(targetFatG, Math.max(minimumFatG, maximumFatG)));

  if (calories < proteinG * 4) {
    return buildMacroResult(calories, Math.max(0, calories / 4), 0);
  }

  return buildMacroResult(calories, proteinG, fatG);
}

export function buildCarbCyclingPlan(input: UserInput): CarbCyclingPlanResult {
  const referenceWeight = input.targetWeightKg || input.weightKg;

  const rmr = calculateRMR("male", input.weightKg, input.heightCm, input.age);
  const tdee = calculateTDEE(rmr, input.activityFactor);

  const cut = calculateCutCalories(
    input.weightKg,
    tdee,
    input.goalRatePctPerWeek
  );

  const avgCalories = cut.avgCutCalories;
  const weeklyCalories = avgCalories * 7;
  const dayCounts = getCarbCycleDayCounts(input.trainingDaysPerWeek);
  const proteinG = 2.0 * referenceWeight;
  const { highCalories, mediumCalories, lowCalories } = calculateDayCalories({
    avgCalories,
    dayCounts,
    proteinG,
    referenceWeight,
    tdee,
    weeklyCalories
  });

  const highDay = buildFeasibleMacroResult("high", highCalories, proteinG, referenceWeight);
  const mediumDay = buildFeasibleMacroResult("medium", mediumCalories, proteinG, referenceWeight);
  const lowDay = buildFeasibleMacroResult("low", lowCalories, proteinG, referenceWeight);

  const warnings = buildCarbCycleWarnings(
    input,
    highDay,
    mediumDay,
    lowDay,
    lowCalories
  );

  return {
    kind: "carbCycling",
    rmr: Math.round(rmr),
    tdee: Math.round(tdee),
    dailyDeficitKcal: Math.round(cut.dailyDeficitKcal),
    weeklyLossKg: Number(cut.weeklyLossKg.toFixed(2)),
    weeklyCalories: Math.round(weeklyCalories),
    dayCounts,
    highDay,
    mediumDay,
    lowDay,
    weeklySchedule: buildWeeklySchedule(input.trainingDaysPerWeek),
    warnings
  };
}
