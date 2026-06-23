import { useMemo, useState, type DragEvent } from "react";
import type { DietMeal, FoodCategory, FoodWithCategory } from "../core/dietPlan";
import {
  getMealFoodOptions,
  getMealFoodRole,
  optimizeMealFromFoodNames,
  replaceFoodByRole
} from "../core/mealOptimizer";

type Language = "en" | "zh";
type DragSource = "available" | "selected";

interface DragPayload {
  source: DragSource;
  foodName: string;
}

interface MealComposerOverlayProps {
  language: Language;
  dayLabel: string;
  meal: DietMeal;
  baseMeal: DietMeal;
  onApply: (foodNames: string[]) => void;
  onClose: () => void;
}

const copy = {
  en: {
    selected: "Meal ingredients",
    outside: "Ingredient field",
    apply: "Apply",
    cancel: "Cancel",
    protein: "Protein",
    carbs: "Carbs",
    fats: "Fats",
    plants: "Plants"
  },
  zh: {
    selected: "Meal ingredients",
    outside: "食材选择区",
    apply: "Apply",
    cancel: "Cancel",
    protein: "Protein",
    carbs: "Carbs",
    fats: "Fats",
    plants: "Plants"
  }
} as const;

const orbit = [
  { left: "4%", top: "7%", rotate: "-5deg" },
  { left: "37%", top: "4%", rotate: "3deg" },
  { left: "70%", top: "8%", rotate: "-2deg" },
  { left: "6%", top: "23%", rotate: "4deg" },
  { left: "76%", top: "25%", rotate: "-6deg" },
  { left: "2%", top: "44%", rotate: "-3deg" },
  { left: "80%", top: "44%", rotate: "5deg" },
  { left: "8%", top: "68%", rotate: "2deg" },
  { left: "68%", top: "70%", rotate: "-4deg" },
  { left: "39%", top: "84%", rotate: "3deg" },
  { left: "55%", top: "20%", rotate: "5deg" },
  { left: "20%", top: "55%", rotate: "-6deg" },
  { left: "72%", top: "59%", rotate: "2deg" },
  { left: "20%", top: "15%", rotate: "-2deg" }
];

export function MealComposerOverlay({
  language,
  dayLabel,
  meal,
  baseMeal,
  onApply,
  onClose
}: MealComposerOverlayProps) {
  const t = copy[language];
  const [selectedFoodNames, setSelectedFoodNames] = useState(() => meal.items.map((item) => item.name));
  const preview = useMemo(
    () => optimizeMealFromFoodNames(meal.name, baseMeal, selectedFoodNames),
    [baseMeal, meal.name, selectedFoodNames]
  );
  const options = useMemo(
    () => prioritizeFoods(getMealFoodOptions().filter((food) => !selectedFoodNames.includes(food.name)), meal),
    [meal, selectedFoodNames]
  );
  const selectedFoods = selectedFoodNames
    .map((name) => getMealFoodOptions().find((food) => food.name === name))
    .filter((food): food is FoodWithCategory => Boolean(food));
  const applyDisabled = preview.status === "empty" || preview.status === "needs-protein";

  function addFood(foodName: string) {
    setSelectedFoodNames((current) => replaceFoodByRole(current, foodName));
  }

  function removeFood(foodName: string) {
    setSelectedFoodNames((current) => current.filter((name) => name !== foodName));
  }

  function handleSelectedDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    const payload = readDragPayload(event);
    if (payload?.source === "available") addFood(payload.foodName);
  }

  function handleOutsideDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const payload = readDragPayload(event);
    if (payload?.source === "selected") removeFood(payload.foodName);
  }

  return (
    <div className="meal-composer-overlay" role="dialog" aria-modal="true" aria-label={`${dayLabel} ${meal.name} composer`} onDragOver={(event) => event.preventDefault()} onDrop={handleOutsideDrop}>
      <button className="meal-composer-backdrop" type="button" aria-label={t.cancel} onClick={onClose} />

      <div className="ingredient-orbit" aria-label={t.outside}>
        {options.slice(0, orbit.length).map((food, index) => (
          <button
            className={`ingredient-chip ${getMealFoodRole(food)}`}
            draggable
            key={food.name}
            onClick={() => addFood(food.name)}
            onDragStart={(event) => writeDragPayload(event, { source: "available", foodName: food.name })}
            style={{ left: orbit[index].left, top: orbit[index].top, transform: `rotate(${orbit[index].rotate})` }}
            type="button"
          >
            <span>{categoryLabel(food.category, t)}</span>
            <strong>{food.name}</strong>
          </button>
        ))}
      </div>

      <section className="meal-composer-card" onDragOver={(event) => event.preventDefault()} onDrop={handleSelectedDrop}>
        <div className="meal-selected-zone">
          <div className="meal-selected-head">
            <span>{t.selected}</span>
          </div>
          <div className="meal-selected-list">
            {selectedFoods.map((food) => (
              <button
                className={`selected-food-pill ${getMealFoodRole(food)}`}
                draggable
                key={food.name}
                onClick={() => removeFood(food.name)}
                onDragStart={(event) => writeDragPayload(event, { source: "selected", foodName: food.name })}
                type="button"
              >
                <span>{food.name}</span>
                <strong>{preview.meal.items.find((item) => item.name === food.name)?.grams ?? 0}g</strong>
              </button>
            ))}
          </div>
        </div>

        <div className="meal-composer-actions">
          <button className="secondary-button" type="button" onClick={onClose}>{t.cancel}</button>
          <button className="primary-button no-top-margin" disabled={applyDisabled} type="button" onClick={() => onApply(selectedFoodNames)}>{t.apply}</button>
        </div>
      </section>
    </div>
  );
}

function prioritizeFoods(foods: FoodWithCategory[], meal: DietMeal): FoodWithCategory[] {
  const currentRoles = new Set(meal.items.map((item) => getMealFoodOptions().find((food) => food.name === item.name)).filter(Boolean).map((food) => getMealFoodRole(food as FoodWithCategory)));
  return [...foods].sort((first, second) => {
    const firstPreferred = currentRoles.has(getMealFoodRole(first)) ? 0 : 1;
    const secondPreferred = currentRoles.has(getMealFoodRole(second)) ? 0 : 1;
    return firstPreferred - secondPreferred || first.name.localeCompare(second.name);
  });
}

function categoryLabel(category: FoodCategory, labels: typeof copy.en | typeof copy.zh): string {
  if (category === "proteins" || category === "dairy") return labels.protein;
  if (category === "carbs" || category === "fruits") return labels.carbs;
  if (category === "fats") return labels.fats;
  return labels.plants;
}

function writeDragPayload(event: DragEvent<HTMLElement>, payload: DragPayload) {
  event.dataTransfer.setData("application/json", JSON.stringify(payload));
  event.dataTransfer.effectAllowed = payload.source === "available" ? "copy" : "move";
}

function readDragPayload(event: DragEvent<HTMLElement>): DragPayload | null {
  try {
    const raw = event.dataTransfer.getData("application/json");
    if (!raw) return null;
    return JSON.parse(raw) as DragPayload;
  } catch {
    return null;
  }
}
