import { buildSafeCarbCyclingPlan } from "./carbCyclingSafePlan";
import { buildStandardPlan } from "./standardPlan";
import type { MacroResult, PlanResult, UserInput } from "./types";
import { loadCarbRotationOffset } from "../storage/weeklyStructurePreferences";

export interface FoodItem {
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface DietMealItem {
  name: string;
  grams: number;
}

export interface DietMeal {
  name: string;
  items: DietMealItem[];
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface DietDay {
  day: string;
  type: "Standard" | "High" | "Medium" | "Low";
  target: MacroResult;
  meals: DietMeal[];
  totals: MacroResult;
}

interface DayBalanceEntry {
  mealName: string;
  food: FoodWithCategory;
  grams: number;
  min: number;
  max: number;
}

type CarbDietType = "High" | "Medium" | "Low";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TEMPLATE_CANDIDATE_SEEDS = Array.from({ length: 12 }, (_, index) => index);

const proteins: FoodItem[] = [
  { name: "Chicken breast", kcal: 120, protein: 22.5, carbs: 0, fat: 2.6 },
  { name: "Lean beef", kcal: 176, protein: 20, carbs: 0, fat: 10 },
  { name: "Shrimp", kcal: 85, protein: 20.1, carbs: 0, fat: 0.5 },
  { name: "Tuna", kcal: 109, protein: 24.4, carbs: 0, fat: 0.5 },
  { name: "Egg whites", kcal: 52, protein: 11, carbs: 0.7, fat: 0.2 },
  { name: "Whole eggs", kcal: 143, protein: 13, carbs: 0.7, fat: 9.5 }
];

const carbs: FoodItem[] = [
  { name: "Rice", kcal: 365, protein: 7.1, carbs: 80, fat: 0.7 },
  { name: "Brown rice", kcal: 370, protein: 7.9, carbs: 77.2, fat: 2.9 },
  { name: "Pasta", kcal: 371, protein: 13, carbs: 75, fat: 1.5 },
  { name: "Potato", kcal: 77, protein: 2, carbs: 17, fat: 0.1 },
  { name: "Sweet potato", kcal: 86, protein: 1.6, carbs: 20, fat: 0.1 },
  { name: "Oats", kcal: 389, protein: 16.9, carbs: 66, fat: 6.9 },
  { name: "Whole wheat bread", kcal: 247, protein: 13, carbs: 41, fat: 4.2 },
  { name: "Corn", kcal: 86, protein: 3.2, carbs: 19, fat: 1.2 }
];

const vegetables: FoodItem[] = [
  { name: "Broccoli", kcal: 34, protein: 2.8, carbs: 6.6, fat: 0.4 },
  { name: "Spinach", kcal: 23, protein: 2.9, carbs: 3.6, fat: 0.4 },
  { name: "Zucchini", kcal: 17, protein: 1.2, carbs: 3.1, fat: 0.3 },
  { name: "Mushrooms", kcal: 22, protein: 3.1, carbs: 3.3, fat: 0.3 },
  { name: "Cauliflower", kcal: 25, protein: 1.9, carbs: 5, fat: 0.3 },
  { name: "Carrots", kcal: 41, protein: 0.9, carbs: 10, fat: 0.2 },
  { name: "Cucumber", kcal: 15, protein: 0.7, carbs: 3.6, fat: 0.1 },
  { name: "Tomato", kcal: 18, protein: 0.9, carbs: 3.9, fat: 0.2 }
];

const fruits: FoodItem[] = [
  { name: "Banana", kcal: 89, protein: 1.1, carbs: 23, fat: 0.3 },
  { name: "Apple", kcal: 52, protein: 0.3, carbs: 14, fat: 0.2 },
  { name: "Blueberries", kcal: 57, protein: 0.7, carbs: 14, fat: 0.3 },
  { name: "Orange", kcal: 47, protein: 0.9, carbs: 12, fat: 0.1 },
  { name: "Strawberries", kcal: 32, protein: 0.7, carbs: 7.7, fat: 0.3 },
  { name: "Kiwi", kcal: 61, protein: 1.1, carbs: 15, fat: 0.5 }
];

const fats: FoodItem[] = [
  { name: "Olive oil", kcal: 884, protein: 0, carbs: 0, fat: 100 },
  { name: "Avocado", kcal: 160, protein: 2, carbs: 8.5, fat: 14.7 },
  { name: "Almonds", kcal: 579, protein: 21, carbs: 22, fat: 50 },
  { name: "Peanut butter", kcal: 588, protein: 25, carbs: 20, fat: 50 },
  { name: "Walnuts", kcal: 654, protein: 15, carbs: 14, fat: 65 }
];

const dairy: FoodItem[] = [
  { name: "Greek yogurt", kcal: 73, protein: 10, carbs: 3.9, fat: 1.9 },
  { name: "Skim milk", kcal: 34, protein: 3.4, carbs: 5, fat: 0.1 },
  { name: "Soy milk", kcal: 54, protein: 3.3, carbs: 6, fat: 1.8 }
];

export const FOOD_CATALOG = { proteins, carbs, vegetables, fruits, fats, dairy } as const;
export type FoodCategory = keyof typeof FOOD_CATALOG;
export type FoodWithCategory = FoodItem & { category: FoodCategory };

const foodNameAliases: Record<string, string> = {
  "Cooked rice": "Rice",
  "Cooked brown rice": "Brown rice",
  "Cooked pasta": "Pasta"
};

const customFoodOptions: Partial<Record<FoodCategory, FoodItem[]>> = {
  proteins: [
    { name: "Salmon", kcal: 208, protein: 20.4, carbs: 0, fat: 13.4 },
    { name: "Whey protein", kcal: 400, protein: 80, carbs: 10, fat: 6.7 }
  ],
  vegetables: [
    { name: "Bell pepper", kcal: 31, protein: 1, carbs: 6, fat: 0.3 }
  ],
  fats: [
    { name: "Cashews", kcal: 553, protein: 18.2, carbs: 30.2, fat: 43.9 }
  ],
  dairy: [
    { name: "Milk", kcal: 61, protein: 3.2, carbs: 4.8, fat: 3.3 }
  ]
};

export function getAllFoods(): FoodWithCategory[] {
  const baseFoods = Object.entries(FOOD_CATALOG).flatMap(([category, foods]) =>
    foods.map((food) => ({ ...food, category: category as FoodCategory }))
  );
  const customFoods = Object.entries(customFoodOptions).flatMap(([category, foods]) =>
    (foods ?? []).map((food) => ({ ...food, category: category as FoodCategory }))
  );

  return [...baseFoods, ...customFoods];
}

export function getFoodByName(name: string): FoodWithCategory | null {
  const normalizedName = foodNameAliases[name] ?? name;
  return getAllFoods().find((food) => food.name === normalizedName) ?? null;
}

export function getFoodCategory(name: string): FoodCategory | null {
  return getFoodByName(name)?.category ?? null;
}

export function buildDietWeek(input: UserInput): DietDay[] {
  const result = buildResult(input);

  if (result.kind === "carbCycling") {
    const adjustedSchedule = applyCarbRotation(result.weeklySchedule, loadCarbRotationOffset());
    const templates = buildCarbDietTemplates(result);

    return adjustedSchedule.map((schedule) => cloneDietDay(schedule.day, templates[schedule.type]));
  }

  return DAYS.map((day, index) => buildDietDay(day, "Standard", result.daily, index));
}

function buildResult(input: UserInput): PlanResult {
  if (input.sex === "male" && input.planType === "carbCycling") {
    return buildSafeCarbCyclingPlan(input);
  }

  return buildStandardPlan(input);
}

function applyCarbRotation<T extends { type: CarbDietType }>(schedule: T[], offset: number): T[] {
  if (schedule.length === 0) return schedule;
  const types = schedule.map((row) => row.type);
  const normalizedOffset = ((offset % types.length) + types.length) % types.length;
  return schedule.map((row, index) => ({
    ...row,
    type: types[(index - normalizedOffset + types.length) % types.length]
  }));
}

function buildCarbDietTemplates(result: Extract<PlanResult, { kind: "carbCycling" }>): Record<CarbDietType, DietDay> {
  return {
    High: buildBestDietTemplate("High", result.highDay),
    Medium: buildBestDietTemplate("Medium", result.mediumDay),
    Low: buildBestDietTemplate("Low", result.lowDay)
  };
}

function buildBestDietTemplate(type: CarbDietType, target: MacroResult): DietDay {
  return TEMPLATE_CANDIDATE_SEEDS
    .map((seed) => buildDietDay(type, type, target, seed))
    .reduce((best, candidate) => scoreMacroDistance(candidate.totals, target) < scoreMacroDistance(best.totals, target) ? candidate : best);
}

function cloneDietDay(day: string, template: DietDay): DietDay {
  return {
    day,
    type: template.type,
    target: { ...template.target },
    meals: template.meals.map(cloneMeal),
    totals: { ...template.totals }
  };
}

function cloneMeal(meal: DietMeal): DietMeal {
  return {
    name: meal.name,
    items: meal.items.map((item) => ({ ...item })),
    calories: meal.calories,
    proteinG: meal.proteinG,
    carbsG: meal.carbsG,
    fatG: meal.fatG
  };
}

function scoreMacroDistance(macro: MacroResult, target: MacroResult): number {
  const calorieError = normalize(macro.calories - target.calories, 35);
  const proteinError = normalize(macro.proteinG - target.proteinG, 6);
  const carbsError = normalize(macro.carbsG - target.carbsG, 8);
  const fatError = normalize(macro.fatG - target.fatG, 4);

  return 4 * calorieError ** 2 + 3 * proteinError ** 2 + 2.5 * carbsError ** 2 + 2.5 * fatError ** 2;
}

function getCarbTarget(result: Extract<PlanResult, { kind: "carbCycling" }>, type: CarbDietType): MacroResult {
  if (type === "High") return result.highDay;
  if (type === "Medium") return result.mediumDay;
  return result.lowDay;
}

function buildDietDay(day: string, type: DietDay["type"], target: MacroResult, index: number): DietDay {
  const breakfast = buildMeal("Breakfast", target, index, 0.25, 0.27, 0.22);
  const lunch = buildMeal("Lunch", target, index + 2, 0.35, 0.34, 0.32);
  const dinner = buildMeal("Dinner", target, index + 4, 0.30, 0.29, 0.34);
  const snack = buildSnack(target, index, 0.10, 0.10, 0.12);
  const meals = balanceMealsToTarget([breakfast, lunch, dinner, snack], target);
  const totals = sumMeals(meals);

  return { day, type, target, meals, totals };
}

function buildMeal(
  name: string,
  target: MacroResult,
  seed: number,
  proteinShare: number,
  carbShare: number,
  fatShare: number
): DietMeal {
  const proteinFood = pick(proteins, seed);
  const carbFood = pick(carbs, seed + 1);
  const vegetableFood = pick(vegetables, seed + 2);
  const fatFood = pick(fats, seed + 3);
  const proteinTarget = target.proteinG * proteinShare;
  const carbTarget = target.carbsG * carbShare;
  const fatTarget = target.fatG * fatShare;

  return makeMeal(name, [
    { food: proteinFood, grams: gramsFor(proteinFood.protein, proteinTarget, 80, 260) },
    { food: carbFood, grams: gramsFor(carbFood.carbs, carbTarget, 70, 320) },
    { food: vegetableFood, grams: 180 },
    { food: fatFood, grams: gramsFor(fatFood.fat, fatTarget, 5, 35) }
  ]);
}

function buildSnack(
  target: MacroResult,
  seed: number,
  proteinShare: number,
  carbShare: number,
  fatShare: number
): DietMeal {
  const proteinFood = pick(dairy, seed);
  const fruitFood = pick(fruits, seed + 1);
  const fatFood = pick(fats, seed + 2);
  const proteinTarget = target.proteinG * proteinShare;
  const carbTarget = target.carbsG * carbShare;
  const fatTarget = target.fatG * fatShare;

  return makeMeal("Snack", [
    { food: proteinFood, grams: gramsFor(proteinFood.protein, proteinTarget, 100, 280) },
    { food: fruitFood, grams: gramsFor(fruitFood.carbs, carbTarget, 80, 220) },
    { food: fatFood, grams: gramsFor(fatFood.fat, fatTarget, 5, 25) }
  ]);
}

function balanceMealsToTarget(meals: DietMeal[], target: MacroResult): DietMeal[] {
  let entries = meals.flatMap((meal) =>
    meal.items.map((item) => {
      const food = getFoodByName(item.name);
      if (!food) return null;
      return { mealName: meal.name, food, grams: item.grams, ...boundsForFood(food) };
    })
  ).filter((entry): entry is DayBalanceEntry => Boolean(entry));

  let bestScore = scoreDayEntries(entries, target);

  for (const step of [80, 40, 20, 10, 5]) {
    for (let round = 0; round < 80; round += 1) {
      const next = findBestDayMove(entries, target, step, bestScore);
      if (!next) break;
      entries = next.entries;
      bestScore = next.score;
    }
  }

  return meals.map((meal) => makeMeal(
    meal.name,
    entries
      .filter((entry) => entry.mealName === meal.name)
      .map((entry) => ({ food: entry.food, grams: entry.grams }))
  ));
}

function findBestDayMove(entries: DayBalanceEntry[], target: MacroResult, step: number, currentScore: number): { entries: DayBalanceEntry[]; score: number } | null {
  let bestEntries: DayBalanceEntry[] | null = null;
  let bestScore = currentScore;

  entries.forEach((entry, index) => {
    [-1, 1].forEach((direction) => {
      const grams = clamp(roundToFive(entry.grams + direction * step), entry.min, entry.max);
      if (grams === entry.grams) return;

      const candidate = { ...entry, grams };
      const nextEntries = entries.map((item, itemIndex) => (itemIndex === index ? candidate : item));
      const nextScore = scoreDayEntries(nextEntries, target);

      if (nextScore < bestScore - 1e-9) {
        bestScore = nextScore;
        bestEntries = nextEntries;
      }
    });
  });

  return bestEntries ? { entries: bestEntries, score: bestScore } : null;
}

function scoreDayEntries(entries: DayBalanceEntry[], target: MacroResult): number {
  const macro = calculateEntries(entries);
  const calorieError = normalize(macro.calories - target.calories, 35);
  const proteinError = normalize(macro.proteinG - target.proteinG, 6);
  const carbsError = normalize(macro.carbsG - target.carbsG, 8);
  const fatError = normalize(macro.fatG - target.fatG, 4);
  const gramPenalty = entries.reduce((sum, entry) => sum + Math.pow((entry.grams - defaultGramsForCategory(entry.food.category)) / 260, 2), 0);

  return 4 * calorieError ** 2 + 3 * proteinError ** 2 + 2.5 * carbsError ** 2 + 2.5 * fatError ** 2 + 0.015 * gramPenalty;
}

function calculateEntries(entries: DayBalanceEntry[]): MacroResult {
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

function boundsForFood(food: FoodWithCategory): { min: number; max: number } {
  if (food.category === "proteins") return { min: 40, max: 360 };
  if (food.category === "carbs") return { min: 5, max: 420 };
  if (food.category === "vegetables") return { min: 50, max: 300 };
  if (food.category === "fruits") return { min: 5, max: 280 };
  if (food.category === "dairy") return { min: 60, max: 360 };
  if (food.name === "Olive oil") return { min: 3, max: 25 };
  return { min: 3, max: 55 };
}

function defaultGramsForCategory(category: FoodCategory): number {
  if (category === "proteins") return 160;
  if (category === "carbs") return 180;
  if (category === "vegetables") return 170;
  if (category === "fruits") return 150;
  if (category === "fats") return 18;
  return 200;
}

function makeMeal(name: string, entries: Array<{ food: FoodItem; grams: number }>): DietMeal {
  const items = entries.map((entry) => ({ name: entry.food.name, grams: roundToFive(entry.grams) }));
  const totals = entries.reduce(
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

  return { name, items, ...roundMacro(totals) };
}

function sumMeals(meals: DietMeal[]): MacroResult {
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

function gramsFor(macroPer100g: number, targetMacro: number, min: number, max: number): number {
  if (macroPer100g <= 0 || targetMacro <= 0) return min;
  return Math.min(max, Math.max(min, (targetMacro / macroPer100g) * 100));
}

function pick<T>(items: T[], seed: number): T {
  return items[seed % items.length];
}

function roundToFive(value: number): number {
  return Math.round(value / 5) * 5;
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
