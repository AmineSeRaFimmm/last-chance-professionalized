import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { DietMeal, FoodCategory, FoodWithCategory } from "../core/dietPlan";
import {
  getMealFoodOptions,
  getMealFoodRole,
  optimizeMealFromFoodNames
} from "../core/mealOptimizer";

type Language = "en" | "zh";
type DragSource = "available" | "selected";
type FoodRole = ReturnType<typeof getMealFoodRole>;

interface ActiveDrag {
  source: DragSource;
  foodName: string;
  label: string;
  role: FoodRole;
  startX: number;
  startY: number;
  x: number;
  y: number;
  moved: boolean;
}

interface CardPosition {
  left: string;
  top: string;
  rotate: string;
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
    more: "More",
    protein: "Protein",
    carbs: "Carbs",
    fats: "Fats",
    plants: "Plants",
    balanced: "Balanced",
    adjusted: "Adjusted",
    needsProtein: "Add lean protein",
    needsCarb: "Add primary carb"
  },
  zh: {
    selected: "Meal ingredients",
    outside: "食材选择区",
    apply: "Apply",
    cancel: "Cancel",
    more: "More",
    protein: "Protein",
    carbs: "Carbs",
    fats: "Fats",
    plants: "Plants",
    balanced: "已平衡",
    adjusted: "已调整",
    needsProtein: "添加优质蛋白",
    needsCarb: "添加主碳水"
  }
} as const;

const orbit: CardPosition[] = [
  { left: "2%", top: "4%", rotate: "-5deg" },
  { left: "69%", top: "4%", rotate: "3deg" },
  { left: "8%", top: "15%", rotate: "4deg" },
  { left: "77%", top: "17%", rotate: "-6deg" },
  { left: "31%", top: "7%", rotate: "5deg" },
  { left: "52%", top: "10%", rotate: "-3deg" },
  { left: "3%", top: "34%", rotate: "-3deg" },
  { left: "80%", top: "35%", rotate: "5deg" },
  { left: "4%", top: "57%", rotate: "2deg" },
  { left: "75%", top: "58%", rotate: "-4deg" },
  { left: "10%", top: "75%", rotate: "3deg" },
  { left: "64%", top: "76%", rotate: "-2deg" },
  { left: "34%", top: "84%", rotate: "-6deg" },
  { left: "51%", top: "86%", rotate: "4deg" },
  { left: "2%", top: "87%", rotate: "-4deg" },
  { left: "78%", top: "86%", rotate: "5deg" }
];

const orbitPages: CardPosition[][] = [
  orbit,
  [
    { left: "7%", top: "6%", rotate: "3deg" },
    { left: "76%", top: "7%", rotate: "-5deg" },
    { left: "2%", top: "20%", rotate: "-4deg" },
    { left: "66%", top: "21%", rotate: "6deg" },
    { left: "25%", top: "4%", rotate: "-2deg" },
    { left: "54%", top: "16%", rotate: "4deg" },
    { left: "13%", top: "38%", rotate: "5deg" },
    { left: "73%", top: "34%", rotate: "-3deg" },
    { left: "1%", top: "50%", rotate: "-6deg" },
    { left: "80%", top: "54%", rotate: "2deg" },
    { left: "18%", top: "68%", rotate: "-2deg" },
    { left: "58%", top: "71%", rotate: "5deg" },
    { left: "38%", top: "78%", rotate: "3deg" },
    { left: "49%", top: "88%", rotate: "-5deg" },
    { left: "5%", top: "88%", rotate: "4deg" },
    { left: "72%", top: "83%", rotate: "-4deg" }
  ],
  [
    { left: "30%", top: "3%", rotate: "-4deg" },
    { left: "55%", top: "4%", rotate: "5deg" },
    { left: "4%", top: "10%", rotate: "2deg" },
    { left: "78%", top: "13%", rotate: "-3deg" },
    { left: "14%", top: "25%", rotate: "-6deg" },
    { left: "67%", top: "26%", rotate: "4deg" },
    { left: "2%", top: "42%", rotate: "5deg" },
    { left: "82%", top: "43%", rotate: "-5deg" },
    { left: "21%", top: "56%", rotate: "3deg" },
    { left: "59%", top: "57%", rotate: "-2deg" },
    { left: "8%", top: "71%", rotate: "-4deg" },
    { left: "76%", top: "72%", rotate: "6deg" },
    { left: "33%", top: "86%", rotate: "4deg" },
    { left: "54%", top: "82%", rotate: "-6deg" },
    { left: "2%", top: "86%", rotate: "2deg" },
    { left: "80%", top: "88%", rotate: "-3deg" }
  ]
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
  const ingredientOrbitRef = useRef<HTMLDivElement | null>(null);
  const selectedZoneRef = useRef<HTMLDivElement | null>(null);
  const activeDragRef = useRef<ActiveDrag | null>(null);
  const orbitSlotRef = useRef<Record<string, number>>({});
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);
  const [externalPositions, setExternalPositions] = useState<Record<string, CardPosition>>({});
  const [selectedFoodNames, setSelectedFoodNames] = useState(() => meal.items.map((item) => item.name));
  const [foodPage, setFoodPage] = useState(0);
  const preview = useMemo(
    () => optimizeMealFromFoodNames(meal.name, baseMeal, selectedFoodNames),
    [baseMeal, meal.name, selectedFoodNames]
  );
  const options = useMemo(
    () => prioritizeFoods(getMealFoodOptions().filter((food) => !selectedFoodNames.includes(food.name)), meal),
    [meal, selectedFoodNames]
  );
  const foodPages = Math.max(1, Math.ceil(options.length / orbit.length));
  const visibleOptions = options.slice((foodPage % foodPages) * orbit.length, ((foodPage % foodPages) + 1) * orbit.length);
  const selectedFoods = selectedFoodNames
    .map((name) => getMealFoodOptions().find((food) => food.name === name))
    .filter((food): food is FoodWithCategory => Boolean(food));
  const applyDisabled = preview.status === "empty" || preview.status === "needs-protein";

  useEffect(() => {
    activeDragRef.current = activeDrag;
  }, [activeDrag]);

  useEffect(() => {
    if (foodPage >= foodPages) setFoodPage(0);
  }, [foodPage, foodPages]);

  useEffect(() => {
    const bodyOverflow = document.body.style.overflow;
    const bodyTouchAction = document.body.style.touchAction;
    const rootOverscroll = document.documentElement.style.overscrollBehavior;

    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    document.documentElement.style.overscrollBehavior = "none";

    return () => {
      document.body.style.overflow = bodyOverflow;
      document.body.style.touchAction = bodyTouchAction;
      document.documentElement.style.overscrollBehavior = rootOverscroll;
    };
  }, []);

  useEffect(() => {
    if (!activeDrag) return;

    function handlePointerMove(event: PointerEvent) {
      event.preventDefault();
      setActiveDrag((current) => {
        if (!current) return null;
        const moved = current.moved || Math.hypot(event.clientX - current.startX, event.clientY - current.startY) > 5;
        return { ...current, x: event.clientX, y: event.clientY, moved };
      });
    }

    function handlePointerUp(event: PointerEvent) {
      event.preventDefault();
      const current = activeDragRef.current;
      if (!current) return;

      const insideSelectedZone = isInsideElement(event.clientX, event.clientY, selectedZoneRef.current);

      if (!current.moved) {
        if (current.source === "available") addFood(current.foodName);
        if (current.source === "selected") removeFood(current.foodName);
      } else if (current.source === "available") {
        if (insideSelectedZone) {
          addFood(current.foodName);
        } else {
          placeExternalCard(current.foodName, event.clientX, event.clientY);
        }
      } else if (current.source === "selected") {
        if (!insideSelectedZone) {
          placeExternalCard(current.foodName, event.clientX, event.clientY);
          removeFood(current.foodName);
        }
      }

      setActiveDrag(null);
    }

    function handlePointerCancel() {
      setActiveDrag(null);
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerUp, { passive: false });
    window.addEventListener("pointercancel", handlePointerCancel);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
    };
  }, [Boolean(activeDrag)]);

  function addFood(foodName: string) {
    setSelectedFoodNames((current) => current.includes(foodName) ? current : [...current, foodName]);
  }

  function removeFood(foodName: string) {
    setSelectedFoodNames((current) => current.filter((name) => name !== foodName));
  }

  function placeExternalCard(foodName: string, clientX: number, clientY: number) {
    setExternalPositions((current) => ({
      ...current,
      [foodName]: getExternalCardPosition(clientX, clientY, ingredientOrbitRef.current)
    }));
  }

  function getCardPosition(foodName: string, fallbackIndex: number, page: number): CardPosition {
    const movedPosition = externalPositions[foodName];
    if (movedPosition) return movedPosition;

    const assignedSlot = orbitSlotRef.current[foodName];
    if (assignedSlot !== undefined) return getOrbitPosition(assignedSlot, page);

    const usedSlots = new Set(Object.values(orbitSlotRef.current));
    let slot = fallbackIndex % orbit.length;

    for (let offset = 0; offset < orbit.length; offset += 1) {
      const candidate = (fallbackIndex + offset) % orbit.length;
      if (!usedSlots.has(candidate)) {
        slot = candidate;
        break;
      }
    }

    orbitSlotRef.current[foodName] = slot;
    return getOrbitPosition(slot, page);
  }

  function startDrag(event: ReactPointerEvent<HTMLElement>, source: DragSource, food: FoodWithCategory) {
    event.preventDefault();
    event.stopPropagation();
    setActiveDrag({
      source,
      foodName: food.name,
      label: categoryLabel(food.category, t),
      role: getMealFoodRole(food),
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      moved: false
    });
  }

  return (
    <div className="meal-composer-overlay" role="dialog" aria-modal="true" aria-label={`${dayLabel} ${meal.name} composer`}>
      <button className="meal-composer-backdrop" type="button" aria-label={t.cancel} onClick={onClose} />

      <div className="ingredient-orbit" aria-label={t.outside} ref={ingredientOrbitRef}>
        {visibleOptions.map((food, index) => {
          const position = getCardPosition(food.name, index, foodPage);
          return (
            <button
              className={`ingredient-chip ${getMealFoodRole(food)}`}
              key={food.name}
              onPointerDown={(event) => startDrag(event, "available", food)}
              style={{ left: position.left, top: position.top, transform: `rotate(${position.rotate})` }}
              type="button"
            >
              <span>{categoryLabel(food.category, t)}</span>
              <strong>{food.name}</strong>
            </button>
          );
        })}
      </div>

      <section className="meal-composer-card">
        <div className="meal-selected-zone" ref={selectedZoneRef}>
          <div className="meal-selected-head">
            <span>{t.selected}</span>
            <strong className={`meal-balance-status ${preview.status}`}>{balanceStatusLabel(preview.status, t)}</strong>
          </div>
          <div className="meal-selected-list">
            {selectedFoods.map((food) => (
              <button
                className={`selected-food-pill ${getMealFoodRole(food)}`}
                key={food.name}
                onPointerDown={(event) => startDrag(event, "selected", food)}
                type="button"
              >
                <span>{food.name}</span>
                <strong>{preview.meal.items.find((item) => item.name === food.name)?.grams ?? 0}g</strong>
              </button>
            ))}
          </div>
        </div>

        <div className="meal-composer-actions">
          <button className="secondary-button" type="button" onClick={() => setFoodPage((current) => (current + 1) % foodPages)}>{t.more}</button>
          <button className="primary-button no-top-margin" disabled={applyDisabled} type="button" onClick={() => onApply(selectedFoodNames)}>{t.apply}</button>
        </div>
      </section>

      {activeDrag && activeDrag.moved && (
        <div className={`meal-floating-chip ${activeDrag.role}`} style={{ transform: `translate3d(${activeDrag.x}px, ${activeDrag.y}px, 0)` }}>
          <span>{activeDrag.label}</span>
          <strong>{activeDrag.foodName}</strong>
        </div>
      )}
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

function getOrbitPosition(slot: number, page: number): CardPosition {
  const pageOrbit = orbitPages[page % orbitPages.length] ?? orbit;
  return pageOrbit[slot % pageOrbit.length] ?? orbit[slot % orbit.length];
}

function categoryLabel(category: FoodCategory, labels: typeof copy.en | typeof copy.zh): string {
  if (category === "proteins" || category === "dairy") return labels.protein;
  if (category === "carbs" || category === "fruits") return labels.carbs;
  if (category === "fats") return labels.fats;
  return labels.plants;
}

function balanceStatusLabel(status: ReturnType<typeof optimizeMealFromFoodNames>["status"], labels: typeof copy.en | typeof copy.zh): string {
  if (status === "balanced") return labels.balanced;
  if (status === "needs-protein") return labels.needsProtein;
  if (status === "needs-carb") return labels.needsCarb;
  return labels.adjusted;
}

function getExternalCardPosition(clientX: number, clientY: number, container: HTMLElement | null): CardPosition {
  const rect = container?.getBoundingClientRect() ?? { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
  const compact = window.matchMedia("(max-width: 420px)").matches;
  const chipWidth = compact ? 96 : 128;
  const chipHeight = compact ? 50 : 56;
  const left = clamp(clientX - rect.left - chipWidth / 2, 0, Math.max(0, rect.width - chipWidth));
  const top = clamp(clientY - rect.top - chipHeight / 2, 0, Math.max(0, rect.height - chipHeight));

  return { left: `${Math.round(left)}px`, top: `${Math.round(top)}px`, rotate: "0deg" };
}

function isInsideElement(x: number, y: number, element: HTMLElement | null): boolean {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
