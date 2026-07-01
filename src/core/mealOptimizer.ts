import type { DietMeal, FoodCategory, FoodWithCategory } from "./dietPlan";
import { getAllFoods, getFoodByName } from "./dietPlan";
import type { MacroResult } from "./types";

export type MealFoodRole = "protein" | "carb" | "fat" | "plant";

export interface MealTarget {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface OptimizedMealResult {
  meal: DietMeal;
  status: "balanced" | "adjusted" | "needs-protein" | "needs-carb" | "needs-fat" | "off-target" | "empty";
  calorieDelta: number;
  proteinDelta: number;
  carbsDelta: number;
  fatDelta: number;
}

interface OptimizerEntry {
  food: FoodWithCategory;
  grams: number;
  min: number;
  max: number;
}

type OptimizerFoodRole = "primaryProtein" | "primaryCarb" | "supportCarb" | "fat" | "plant";
type OptimizerMode = "meal" | "prep";

const supportCarbMaxGrams: Record<string, number> = {
  Banana: 150,
  Apple: 200,
  Blueberries: 150,
  Orange: 200,
  Strawberries: 180,
  Kiwi: 150
};

export function getMealFoodOptions(): FoodWithCategory[] {
  return getAllFoods();
}

export function getMealFoodRole(food: Pick<FoodWithCategory, "category">): MealFoodRole {
  if (food.category === "proteins" || food.category === "dairy") return "protein";
  if (food.category === "carbs" || food.category === "fruits") return "carb";
  if (food.category === "fats") return "fat";
  return "plant";
}

export function replaceFoodByRole(currentFoodNames: string[], nextFoodName: string): string[] {
  const nextFood = getFoodByName(nextFoodName);
  if (!nextFood) return currentFoodNames;

  const nextRole = getMealFoodRole(nextFood);
  const preserved = currentFoodNames.filter((name) => {
    const food = getFoodByName(name);
    return !food || getMealFoodRole(food) !== nextRole;
  });

  return [...preserved, nextFoodName];
}

export function optimizeMealFromFoodNames(mealName: string, target: MealTarget, foodNames: string[]): OptimizedMealResult {
  return optimizeFoodNames(mealName, target, foodNames, "meal");
}

export function optimizeMealPrepFromFoodNames(mealName: string, target: MealTarget, foodNames: string[]): OptimizedMealResult {
  return optimizeFoodNames(mealName, target, foodNames, "prep");
}

function optimizeFoodNames(mealName: string, target: MealTarget, foodNames: string[], mode: OptimizerMode): OptimizedMealResult {
  const foods = unique(foodNames)
    .map((name) => getFoodByName(name))
    .filter((food): food is FoodWithCategory => Boolean(food));

  if (foods.length === 0) {
    return {
      meal: { name: mealName, items: [], calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
      status: "empty",
      calorieDelta: -target.calories,
      proteinDelta: -target.proteinG,
      carbsDelta: -target.carbsG,
      fatDelta: -target.fatG
    };
  }

  const entries = foods.map((food) => ({
    food,
    ...boundsForFood(food, mode),
    grams: initialGramsForFood(food, foods, target, mode)
  }));

  const optimized = mode === "prep" ? coordinateOptimizeFromMultipleStarts(entries, target, mode) : coordinateOptimize(entries, target, mode);
  const meal = makeOptimizedMeal(mealName, optimized);
  const hasProtein = optimized.some((entry) => entry.food.protein * (entry.grams / 100) >= 8);
  const hasPrimaryCarb = optimized.some((entry) => getOptimizerFoodRole(entry.food) === "primaryCarb");
  const hasFat = optimized.some((entry) => getOptimizerFoodRole(entry.food) === "fat");
  const calorieDelta = meal.calories - target.calories;
  const proteinDelta = meal.proteinG - target.proteinG;
  const carbsDelta = meal.carbsG - target.carbsG;
  const fatDelta = meal.fatG - target.fatG;
  const status = mode === "prep"
    ? getPrepStatus({ hasProtein, hasPrimaryCarb, hasFat, calorieDelta, proteinDelta, carbsDelta, fatDelta })
    : !hasProtein
    ? "needs-protein"
    : !hasPrimaryCarb && (meal.carbsG <= 1 || (target.carbsG >= 5 && (carbsDelta <= -3 || meal.carbsG < target.carbsG * 0.9)))
      ? "needs-carb"
    : Math.abs(calorieDelta) <= 20 && Math.abs(proteinDelta) <= 5 && Math.abs(carbsDelta) <= 6 && Math.abs(fatDelta) <= 3
      ? "balanced"
      : "adjusted";

  return { meal, status, calorieDelta, proteinDelta, carbsDelta, fatDelta };
}

export function sumDietMeals(meals: DietMeal[]): MacroResult {
  return roundMacro(
    meals.reduce(
      (sum, meal) => ({
        calories: sum.calories + meal.calories,
        proteinG: sum.proteinG + meal.proteinG,
        carbsG: sum.carbsG + meal.carbsG,
        fatG: sum.fatG + meal.fatG
      }),
      { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
    )
  );
}

function coordinateOptimize(entries: OptimizerEntry[], target: MealTarget, mode: OptimizerMode): OptimizerEntry[] {
  let current = entries.map((entry) => ({ ...entry, grams: clamp(roundToFive(entry.grams), entry.min, entry.max) }));
  let bestScore = scoreEntries(current, target, mode);

  for (const step of [80, 40, 20, 10, 5]) {
    for (let round = 0; round < (mode === "prep" ? 70 : 40); round += 1) {
      let improved = false;

      current = current.map((entry, index) => {
        let bestEntry = entry;

        for (const direction of [-1, 1]) {
          const candidate = {
            ...entry,
            grams: clamp(roundToFive(entry.grams + direction * step), entry.min, entry.max)
          };
          const next = current.map((item, itemIndex) => (itemIndex === index ? candidate : item));
          const nextScore = scoreEntries(next, target, mode);

          if (nextScore < bestScore) {
            bestScore = nextScore;
            bestEntry = candidate;
            improved = true;
          }
        }

        return bestEntry;
      });

      if (!improved) break;
    }
  }

  return current;
}

function coordinateOptimizeFromMultipleStarts(entries: OptimizerEntry[], target: MealTarget, mode: OptimizerMode): OptimizerEntry[] {
  const starts = [
    entries,
    entries.map((entry) => ({ ...entry, grams: entry.min })),
    entries.map((entry) => ({ ...entry, grams: entry.max })),
    entries.map((entry) => ({ ...entry, grams: clamp(initialGramsForCategory(entry.food.category), entry.min, entry.max) }))
  ];
  const optimized = starts.map((start) => coordinateOptimize(start, target, mode));

  return optimized.reduce((best, candidate) => (
    scoreEntries(candidate, target, mode) < scoreEntries(best, target, mode) ? candidate : best
  ));
}

function scoreEntries(entries: OptimizerEntry[], target: MealTarget, mode: OptimizerMode): number {
  const macro = calculateEntries(entries);
  const calorieError = normalize(macro.calories - target.calories, mode === "prep" ? 14 : 18);
  const proteinError = normalize(macro.proteinG - target.proteinG, mode === "prep" ? 5 : 4);
  const carbsError = normalize(macro.carbsG - target.carbsG, mode === "prep" ? 5 : 4);
  const fatError = normalize(macro.fatG - target.fatG, mode === "prep" ? 3 : 2.5);
  const gramPenalty = entries.reduce((sum, entry) => sum + Math.pow((entry.grams - initialGramsForCategory(entry.food.category)) / 200, 2), 0);
  const supportCarbPenalty = entries.reduce((sum, entry) => {
    if (getOptimizerFoodRole(entry.food) !== "supportCarb") return sum;
    const softMax = supportCarbMaxGrams[entry.food.name] ?? 180;
    return sum + Math.max(0, entry.grams - softMax) ** 2 / 25;
  }, 0);

  return 4 * calorieError ** 2 + 3 * proteinError ** 2 + 2.5 * carbsError ** 2 + 2.5 * fatError ** 2 + 0.02 * gramPenalty + supportCarbPenalty;
}

function initialGramsForFood(food: FoodWithCategory, allFoods: FoodWithCategory[], target: MealTarget, mode: OptimizerMode): number {
  if (food.name === "Whey protein") return 30;

  const role = getMealFoodRole(food);
  const sameRoleCount = allFoods.filter((item) => getMealFoodRole(item) === role).length || 1;

  if (role === "protein") return gramsFor(food.protein, target.proteinG / sameRoleCount, 50, 320);
  if (role === "carb") return gramsFor(food.carbs, target.carbsG / sameRoleCount, 5, 420);
  if (role === "fat") {
    const bounds = boundsForFood(food, mode);
    return gramsFor(food.fat, target.fatG / sameRoleCount, bounds.min, bounds.max);
  }
  return 120;
}

function initialGramsForCategory(category: FoodCategory): number {
  if (category === "proteins") return 160;
  if (category === "carbs") return 180;
  if (category === "vegetables") return 170;
  if (category === "fruits") return 150;
  if (category === "fats") return 18;
  return 200;
}

function boundsForFood(food: FoodWithCategory, mode: OptimizerMode = "meal"): { min: number; max: number } {
  if (food.name === "Whey protein") return { min: 30, max: 30 };
  if (food.category === "proteins") return { min: 40, max: 360 };
  if (food.category === "carbs") return { min: 5, max: 420 };
  if (food.category === "vegetables") return { min: 50, max: 300 };
  if (food.category === "fruits") return { min: 5, max: supportCarbMaxGrams[food.name] ?? 180 };
  if (food.category === "dairy") return { min: 60, max: 360 };
  if (mode === "prep" && food.name === "Olive oil") return { min: 3, max: 45 };
  if (mode === "prep" && food.name === "Avocado") return { min: 30, max: 180 };
  if (mode === "prep" && food.category === "fats") return { min: 5, max: 80 };
  if (food.name === "Olive oil") return { min: 3, max: 25 };
  return { min: 3, max: 55 };
}

function getPrepStatus({
  hasProtein,
  hasPrimaryCarb,
  hasFat,
  calorieDelta,
  proteinDelta,
  carbsDelta,
  fatDelta
}: {
  hasProtein: boolean;
  hasPrimaryCarb: boolean;
  hasFat: boolean;
  calorieDelta: number;
  proteinDelta: number;
  carbsDelta: number;
  fatDelta: number;
}): OptimizedMealResult["status"] {
  if (!hasProtein) return "needs-protein";
  if (!hasPrimaryCarb) return "needs-carb";
  if (!hasFat) return "needs-fat";
  if (Math.abs(calorieDelta) <= 35 && Math.abs(proteinDelta) <= 8 && Math.abs(carbsDelta) <= 10 && Math.abs(fatDelta) <= 6) return "balanced";
  if (Math.abs(calorieDelta) > 120 || Math.abs(proteinDelta) > 25 || Math.abs(carbsDelta) > 30 || Math.abs(fatDelta) > 18) return "off-target";
  return "adjusted";
}

function getOptimizerFoodRole(food: FoodWithCategory): OptimizerFoodRole {
  if (food.category === "fruits") return "supportCarb";
  if (food.category === "carbs") return "primaryCarb";
  if (food.category === "proteins" || food.category === "dairy") return "primaryProtein";
  if (food.category === "fats") return "fat";
  return "plant";
}

function makeOptimizedMeal(name: string, entries: OptimizerEntry[]): DietMeal {
  const items = entries.map((entry) => ({ name: entry.food.name, grams: roundToFive(entry.grams) }));
  return { name, items, ...roundMacro(calculateEntries(entries)) };
}

function calculateEntries(entries: OptimizerEntry[]): MacroResult {
  return entries.reduce(
    (sum, entry) => {
      const factor = roundToFive(entry.grams) / 100;
      return {
        calories: sum.calories + entry.food.kcal * factor,
        proteinG: sum.proteinG + entry.food.protein * factor,
        carbsG: sum.carbsG + entry.food.carbs * factor,
        fatG: sum.fatG + entry.food.fat * factor
      };
    },
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
  );
}

function gramsFor(macroPer100g: number, targetMacro: number, min: number, max: number): number {
  if (macroPer100g <= 0 || targetMacro <= 0) return min;
  return clamp((targetMacro / macroPer100g) * 100, min, max);
}

function roundMacro(value: MacroResult): MacroResult {
  return {
    calories: Math.round(value.calories),
    proteinG: Math.round(value.proteinG),
    carbsG: Math.round(value.carbsG),
    fatG: Math.round(value.fatG)
  };
}

function normalize(value: number, denominator: number): number {
  return value / denominator;
}

function roundToFive(value: number): number {
  return Math.round(value / 5) * 5;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
