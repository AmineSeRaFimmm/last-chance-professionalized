import { KCAL_PER_KG_FAT } from "./constants";

export interface WeightLogEntry {
  date: string;
  weightKg: number;
  calories?: number;
}

export type ProgressStatus = "insufficient" | "onTrack" | "slow" | "fast" | "gain";

export interface ProgressSummary {
  entryCount: number;
  latestAverageKg?: number;
  earliestDate?: string;
  latestDate?: string;
  days?: number;
  weightChangeKg?: number;
  actualLossPerWeekKg?: number;
  actualTdee?: number;
  status: ProgressStatus;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const TREND_WINDOW_SIZE = 7;

export function normalizeWeightLog(entries: WeightLogEntry[]): WeightLogEntry[] {
  return entries
    .filter((entry) => entry.date && Number.isFinite(entry.weightKg) && entry.weightKg > 0)
    .map((entry) => ({
      date: entry.date,
      weightKg: Number(entry.weightKg),
      calories:
        entry.calories !== undefined && Number.isFinite(entry.calories) && entry.calories > 0
          ? Number(entry.calories)
          : undefined
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function getLatestAverageWeight(entries: WeightLogEntry[], count = TREND_WINDOW_SIZE): number | undefined {
  const normalized = normalizeWeightLog(entries);
  const latest = normalized.slice(-count);

  if (latest.length === 0) return undefined;

  return getAverageWeight(latest);
}

export function calculateProgressSummary(
  entries: WeightLogEntry[],
  plannedDailyCalories: number,
  expectedWeeklyLossKg: number
): ProgressSummary {
  const normalized = normalizeWeightLog(entries);
  const latestAverageKg = getLatestAverageWeight(normalized);

  if (normalized.length < 2) {
    return {
      entryCount: normalized.length,
      latestAverageKg,
      status: "insufficient"
    };
  }

  const trend = getTrendComparison(normalized);

  if (trend.days < 7) {
    return {
      entryCount: normalized.length,
      latestAverageKg,
      earliestDate: trend.earlyDate,
      latestDate: trend.latestDate,
      days: trend.days,
      weightChangeKg: trend.weightChangeKg,
      status: "insufficient"
    };
  }

  const actualLossPerWeekKg = (-trend.weightChangeKg / trend.days) * 7;
  const averageCalories = getAverageLoggedCalories(normalized) ?? plannedDailyCalories;
  const actualTdee = averageCalories - (trend.weightChangeKg * KCAL_PER_KG_FAT) / trend.days;
  const status = classifyProgress(actualLossPerWeekKg, expectedWeeklyLossKg);

  return {
    entryCount: normalized.length,
    latestAverageKg,
    earliestDate: trend.earlyDate,
    latestDate: trend.latestDate,
    days: trend.days,
    weightChangeKg: trend.weightChangeKg,
    actualLossPerWeekKg,
    actualTdee,
    status
  };
}

function getTrendComparison(entries: WeightLogEntry[]) {
  if (entries.length >= TREND_WINDOW_SIZE * 2) {
    const earlyWindow = entries.slice(0, TREND_WINDOW_SIZE);
    const latestWindow = entries.slice(-TREND_WINDOW_SIZE);
    const earlyAverage = getAverageWeight(earlyWindow);
    const latestAverage = getAverageWeight(latestWindow);
    const earlyDate = getWindowMidDate(earlyWindow);
    const latestDate = getWindowMidDate(latestWindow);
    const days = Math.max(1, getDateDistanceDays(earlyDate, latestDate));

    return {
      earlyDate,
      latestDate,
      days,
      weightChangeKg: latestAverage - earlyAverage
    };
  }

  const first = entries[0];
  const last = entries[entries.length - 1];

  return {
    earlyDate: first.date,
    latestDate: last.date,
    days: Math.max(0, getDateDistanceDays(first.date, last.date)),
    weightChangeKg: last.weightKg - first.weightKg
  };
}

function getAverageWeight(entries: WeightLogEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.weightKg, 0) / entries.length;
}

function getWindowMidDate(entries: WeightLogEntry[]): string {
  return entries[Math.floor(entries.length / 2)].date;
}

function getDateDistanceDays(startDate: string, endDate: string): number {
  return Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / MS_PER_DAY);
}

function getAverageLoggedCalories(entries: WeightLogEntry[]): number | undefined {
  const logged = entries.filter((entry) => entry.calories !== undefined) as Array<
    WeightLogEntry & { calories: number }
  >;

  if (logged.length === 0) return undefined;

  return logged.reduce((sum, entry) => sum + entry.calories, 0) / logged.length;
}

function classifyProgress(
  actualLossPerWeekKg: number,
  expectedWeeklyLossKg: number
): ProgressStatus {
  if (actualLossPerWeekKg < -0.1) return "gain";
  if (expectedWeeklyLossKg <= 0) return "insufficient";

  const ratio = actualLossPerWeekKg / expectedWeeklyLossKg;

  if (ratio < 0.5) return "slow";
  if (ratio > 1.35) return "fast";
  return "onTrack";
}
