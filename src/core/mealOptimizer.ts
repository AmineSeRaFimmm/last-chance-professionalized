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
  status: "balanced" | "adjusted" | "needs-protein" | "empty";
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
    ...boundsForFood(food),
    grams: initialGramsForFood(food, foods, target)
  }));

  const optimized = coordinateOptimize(entries, target);
  const meal = makeOptimizedMeal(mealName, optimized);
  const hasProtein = optimized.some((entry) => entry.food.protein * (entry.grams / 100) >= 8);
  const calorieDelta = meal.calories - target.calories;
  const proteinDelta = meal.proteinG - target.proteinG;
  const carbsDelta = meal.carbsG - target.carbsG;
  const fatDelta = meal.fatG - target.fatG;
  const status = !hasProtein
    ? "needs-protein"
    : Math.abs(calorieDelta) <= 30 && Math.abs(proteinDelta) <= 8 && Math.abs(carbsDelta) <= 10 && Math.abs(fatDelta) <= 6
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

function coordinateOptimize(entries: OptimizerEntry[], target: MealTarget): OptimizerEntry[] {
  let current = entries.map((entry) => ({ ...entry, grams: clamp(roundToFive(entry.grams), entry.min, entry.max) }));
  let bestScore = scoreEntries(current, target);

  for (const step of [80, 40, 20, 10, 5]) {
    for (let round = 0; round < 12; round += 1) {
      let improved = false;

      current = current.map((entry, index) => {
        let bestEntry = entry;

        for (const direction of [-1, 1]) {
          const candidate = {
            ...entry,
            grams: clamp(roundToFive(entry.grams + direction * step), entry.min, entry.max)
          };
          const next = current.map((item, itemIndex) => (itemIndex === index ? candidate : item));
          const nextScore = scoreEntries(next, target);

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

function scoreEntries(entries: OptimizerEntry[], target: MealTarget): number {
  const macro = calculateEntries(entries);
  const calorieError = normalize(macro.calories - target.calories, Math.max(250, target.calories));
  const proteinError = normalize(macro.proteinG - target.proteinG, Math.max(15, target.proteinG));
  const carbsError = normalize(macro.carbsG - target.carbsG, Math.max(20, target.carbsG));
  const fatError = normalize(macro.fatG - target.fatG, Math.max(10, target.fatG));
  const gramPenalty = entries.reduce((sum, entry) => sum + Math.pow((entry.grams - initialGramsForCategory(entry.food.category)) / 200, 2), 0);

  return 8 * calorieError ** 2 + 3 * proteinError ** 2 + 2 * carbsError ** 2 + 2 * fatError ** 2 + 0.15 * gramPenalty;
}

function initialGramsForFood(food: FoodWithCategory, allFoods: FoodWithCategory[], target: MealTarget): number {
  const role = getMealFoodRole(food);
  const sameRoleCount = allFoods.filter((item) => getMealFoodRole(item) === role).length || 1;

  if (role === "protein") return gramsFor(food.protein, target.proteinG / sameRoleCount, 80, 280);
  if (role === "carb") return gramsFor(food.carbs, target.carbsG / sameRoleCount, 60, 350);
  if (role === "fat") return gramsFor(food.fat, target.fatG / sameRoleCount, food.name === "Olive oil" ? 3 : 5, food.name === "Olive oil" ? 20 : 35);
  return 170;
}

function initialGramsForCategory(category: FoodCategory): number {
  if (category === "proteins") return 160;
  if (category === "carbs") return 180;
  if (category === "vegetables") return 170;
  if (category === "fruits") return 150;
  if (category === "fats") return 18;
  return 200;
}

function boundsForFood(food: FoodWithCategory): { min: number; max: number } {
  if (food.category === "proteins") return { min: 70, max: 300 };
  if (food.category === "carbs") return { min: 50, max: 360 };
  if (food.category === "vegetables") return { min: 80, max: 260 };
  if (food.category === "fruits") return { min: 60, max: 260 };
  if (food.category === "dairy") return { min: 100, max: 320 };
  if (food.name === "Olive oil") return { min: 3, max: 20 };
  return { min: 5, max: 40 };
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
