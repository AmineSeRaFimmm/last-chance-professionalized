export interface DietMealOverride {
  day: string;
  mealName: string;
  foodNames: string[];
}

export interface DietPrepOverride {
  day: string;
  foodNames: string[];
}

const DIET_OVERRIDES_KEY = "last_chance_diet_overrides";
const DIET_PREP_OVERRIDES_KEY = "last_chance_diet_prep_overrides";

export function loadDietOverrides(): DietMealOverride[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(DIET_OVERRIDES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DietMealOverride[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isDietMealOverride);
  } catch {
    return [];
  }
}

export function saveMealOverride(override: DietMealOverride): DietMealOverride[] {
  const next = [
    ...loadDietOverrides().filter((item) => item.day !== override.day || item.mealName !== override.mealName),
    override
  ];
  persistDietOverrides(next);
  return next;
}

export function removeMealOverride(day: string, mealName: string): DietMealOverride[] {
  const next = loadDietOverrides().filter((item) => item.day !== day || item.mealName !== mealName);
  persistDietOverrides(next);
  return next;
}

export function findMealOverride(overrides: DietMealOverride[], day: string, mealName: string): DietMealOverride | null {
  return overrides.find((item) => item.day === day && item.mealName === mealName) ?? null;
}

export function loadDietPrepOverrides(): DietPrepOverride[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(DIET_PREP_OVERRIDES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DietPrepOverride[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isDietPrepOverride);
  } catch {
    return [];
  }
}

export function saveDietPrepOverride(override: DietPrepOverride): DietPrepOverride[] {
  const next = [
    ...loadDietPrepOverrides().filter((item) => item.day !== override.day),
    override
  ];
  persistDietPrepOverrides(next);
  return next;
}

export function findDietPrepOverride(overrides: DietPrepOverride[], day: string): DietPrepOverride | null {
  return overrides.find((item) => item.day === day) ?? null;
}

function persistDietOverrides(overrides: DietMealOverride[]) {
  window.localStorage.setItem(DIET_OVERRIDES_KEY, JSON.stringify(overrides));
}

function persistDietPrepOverrides(overrides: DietPrepOverride[]) {
  window.localStorage.setItem(DIET_PREP_OVERRIDES_KEY, JSON.stringify(overrides));
}

function isDietMealOverride(value: unknown): value is DietMealOverride {
  if (!value || typeof value !== "object") return false;
  const candidate = value as DietMealOverride;
  return typeof candidate.day === "string" && typeof candidate.mealName === "string" && Array.isArray(candidate.foodNames);
}

function isDietPrepOverride(value: unknown): value is DietPrepOverride {
  if (!value || typeof value !== "object") return false;
  const candidate = value as DietPrepOverride;
  return typeof candidate.day === "string" && Array.isArray(candidate.foodNames);
}
