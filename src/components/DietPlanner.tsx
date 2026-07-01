import { useEffect, useRef, useState, type PointerEvent } from "react";
import { buildDietWeek } from "../core/dietPlan";
import type { DietDay, DietMeal, FoodWithCategory } from "../core/dietPlan";
import { getMealFoodOptions, getMealFoodRole, optimizeMealFromFoodNames, sumDietMeals } from "../core/mealOptimizer";
import { loadInput } from "../storage/localPlan";
import { findDietPrepOverride, findMealOverride, loadDietOverrides, loadDietPrepOverrides, saveDietPrepOverride, saveMealOverride } from "../storage/dietOverrides";
import type { DietMealOverride, DietPrepOverride } from "../storage/dietOverrides";
import { MealComposerOverlay } from "./MealComposerOverlay";

type Language = "en" | "zh";
type CarouselSlot = "prev" | "current" | "next";
type DietTemplate = "meals" | "prep";
const DIET_TEMPLATE_KEY = "last_chance_diet_template";

interface ComposerState {
  dayLabel: string;
  meal: DietMeal;
  baseMeal: DietMeal;
  mode: DietTemplate;
}

interface CarouselDayCard {
  baseDay: DietDay;
  day: DietDay;
  index: number;
  slot: CarouselSlot;
}

type ShoppingRole = "protein" | "carb" | "fat" | "plant";

interface ShoppingIngredient {
  name: string;
  grams: number;
  role: ShoppingRole;
}

interface ShoppingGroup {
  role: ShoppingRole;
  label: string;
  items: ShoppingIngredient[];
}

const copy = {
  en: {
    title: "Diet",
    subtitle: "A one-week template generated from your saved plan.",
    emptyTitle: "No saved plan yet",
    emptyText: "Go to Plan, complete your data, then tap Save plan locally.",
    target: "Target",
    estimate: "Estimated",
    note: "Food values are practical estimates per 100g. Adjust seasoning, sauces, cooking oil, and brands manually.",
    infoTitle: "Nutrition notes",
    infoSubtitle: "The rules that matter most during a cut.",
    infoItems: [
      "Ingredient grams use raw weight for fresh foods and dry weight for rice, pasta, and oats.",
      "Hit protein first, then adjust carbs and fats around training.",
      "Keep meals repeatable; consistency beats perfect daily variety.",
      "Use low-fat protein and high-fiber plants when hunger is high.",
      "Do not let cooking oil, sauces, or snacks erase the deficit."
    ],
    shoppingTitle: "Weekly shopping list",
    shoppingSubtitle: "Auto-summed from all meals in this week.",
    shoppingSummary: "7 days",
    shoppingItems: "items",
    shoppingTotal: "total",
    templateMeals: "Meals",
    templatePrep: "Prep",
    mealPrepTitle: "Meal prep",
    mealPrepSubtitle: "One prep split across the day.",
    mealPrepServings: "4 servings",
    shoppingGroups: {
      protein: "Protein",
      carb: "Carbs",
      fat: "Fats",
      plant: "Plants"
    },
    kcal: "kcal",
    protein: "P",
    carbs: "C",
    fat: "F"
  },
  zh: {
    title: "饮食模板",
    subtitle: "根据你保存的计划自动生成一周饮食模板。",
    emptyTitle: "还没有保存计划",
    emptyText: "先进入 Plan，填完数据后点击保存到本机。",
    target: "目标",
    estimate: "估算",
    note: "食物数据为每 100g 实用估算值。调料、酱料、烹调用油和品牌差异需要自行修正。",
    infoTitle: "饮食注意事项",
    infoSubtitle: "减脂期最关键的执行原则。",
    infoItems: [
      "食材克数按生重计算；米、意面和燕麦按干重计算。",
      "优先保证蛋白质，再根据训练日调整碳水和脂肪。",
      "饮食越可重复，越容易稳定执行；不需要每天追求复杂变化。",
      "饥饿感强时，优先选择低脂蛋白和高纤维蔬菜。",
      "不要让烹调用油、酱料和零食悄悄抵消热量缺口。"
    ],
    shoppingTitle: "一周采购清单",
    shoppingSubtitle: "自动汇总本周所有餐卡食材。",
    shoppingSummary: "7 天",
    shoppingItems: "项",
    shoppingTotal: "合计",
    templateMeals: "分餐",
    templatePrep: "备餐",
    mealPrepTitle: "统一备餐",
    mealPrepSubtitle: "一份备餐，分多次吃。",
    mealPrepServings: "4 份",
    shoppingGroups: {
      protein: "蛋白质",
      carb: "碳水",
      fat: "脂肪",
      plant: "蔬果"
    },
    kcal: "kcal",
    protein: "蛋白",
    carbs: "碳水",
    fat: "脂肪"
  }
} as const;

export function DietPlanner() {
  const language = loadLanguage();
  const t = copy[language];
  const savedInput = loadInput();
  const hasSavedInput = Boolean(savedInput);
  const [overrides, setOverrides] = useState<DietMealOverride[]>(loadDietOverrides);
  const [prepOverrides, setPrepOverrides] = useState<DietPrepOverride[]>(loadDietPrepOverrides);
  const [composer, setComposer] = useState<ComposerState | null>(null);
  const [activeDayIndex, setActiveDayIndex] = useState(getTodayWeekIndex);
  const [dietTemplate, setDietTemplate] = useState<DietTemplate>(loadDietTemplate);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const weekStackRef = useRef<HTMLDivElement | null>(null);
  const activeDayCardRef = useRef<HTMLDivElement | null>(null);
  const didAlignInitialDayRef = useRef(false);
  const baseWeek = savedInput ? buildDietWeek(savedInput) : [];
  const mealsWeek = savedInput ? applyOverridesToWeek(baseWeek, overrides) : [];
  const prepWeek = savedInput ? buildPrepWeek(baseWeek, prepOverrides, t.mealPrepTitle) : [];
  const week = dietTemplate === "prep" ? prepWeek : mealsWeek;
  const carouselCards = getCarouselCards(week, baseWeek, activeDayIndex);

  useEffect(() => {
    if (!hasSavedInput) return;
    const stack = weekStackRef.current;
    const activeDayCard = activeDayCardRef.current;
    if (!stack || !activeDayCard) return;

    window.requestAnimationFrame(() => {
      const paddingLeft = parseFloat(window.getComputedStyle(stack).paddingLeft) || 0;
      const behavior: ScrollBehavior = didAlignInitialDayRef.current ? "smooth" : "auto";
      stack.scrollTo({ left: activeDayCard.offsetLeft - stack.offsetLeft - paddingLeft, behavior });
      didAlignInitialDayRef.current = true;
    });
  }, [activeDayIndex, hasSavedInput]);

  if (!savedInput) {
    return (
      <main className="app-shell diet-shell">
        <section className="hero diet-hero">
          <div className="hero-topline">
            <p className="eyebrow">{t.title}</p>
            <DietTemplateToggle labels={t} template={dietTemplate} onChange={handleTemplateChange} />
          </div>
          <h1 className="hero-title">Diet</h1>
          <p className="hero-subtitle">{t.subtitle}</p>
        </section>
        <section className="card">
          <div className="card-title">{t.emptyTitle}</div>
          <p className="small-note no-margin">{t.emptyText}</p>
        </section>
      </main>
    );
  }

  function moveActiveDay(offset: number) {
    if (week.length <= 1) return;
    setActiveDayIndex((index) => normalizeDayIndex(index + offset, week.length));
  }

  function handleCarouselPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    swipeStartRef.current = { x: event.clientX, y: event.clientY };
  }

  function handleCarouselPointerCancel() {
    swipeStartRef.current = null;
  }

  function handleCarouselPointerUp(event: PointerEvent<HTMLDivElement>) {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start || week.length <= 1) return;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    const isHorizontalSwipe = Math.abs(deltaX) > 44 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2;
    if (!isHorizontalSwipe) return;

    moveActiveDay(deltaX < 0 ? 1 : -1);
  }

  function openComposer(day: DietDay, baseMeal: DietMeal, meal: DietMeal, mode: DietTemplate = "meals") {
    setComposer({
      dayLabel: day.day,
      meal,
      baseMeal,
      mode
    });
  }

  function handleTemplateChange(template: DietTemplate) {
    saveDietTemplate(template);
    setDietTemplate(template);
  }

  function handleApply(foodNames: string[]) {
    if (!composer) return;
    if (composer.mode === "prep") {
      const next = saveDietPrepOverride({ day: composer.dayLabel, foodNames });
      setPrepOverrides(next);
    } else {
      const next = saveMealOverride({ day: composer.dayLabel, mealName: composer.baseMeal.name, foodNames });
      setOverrides(next);
    }
    setComposer(null);
  }

  return (
    <main className="app-shell diet-shell">
      <section className="hero diet-hero">
        <div className="hero-topline">
          <p className="eyebrow">{t.title}</p>
          <DietTemplateToggle labels={t} template={dietTemplate} onChange={handleTemplateChange} />
        </div>
        <h1 className="hero-title">Diet</h1>
        <p className="hero-subtitle">{t.subtitle}</p>
      </section>

      <section className="card diet-note-card">
        <p className="small-note no-margin">{t.note}</p>
      </section>

      <div
        className="diet-week-stack"
        onPointerCancel={handleCarouselPointerCancel}
        onPointerDown={handleCarouselPointerDown}
        onPointerLeave={handleCarouselPointerCancel}
        onPointerUp={handleCarouselPointerUp}
        ref={weekStackRef}
      >
        <DietInfoCard labels={t} />
        <DietShoppingListCard groups={buildShoppingGroups(week, t.shoppingGroups)} labels={t} />
        {carouselCards.map(({ baseDay, day, index, slot }) => (
          <div className={`diet-carousel-card diet-carousel-card-${slot} ${index === activeDayIndex ? "is-active" : ""}`} key={`${day.day}-${index}`} ref={index === activeDayIndex ? activeDayCardRef : undefined}>
            <DietDayCard
              baseDay={baseDay}
              day={day}
              labels={t}
              template={dietTemplate}
              onMealOpen={(baseMeal, meal, mode) => openComposer(day, baseMeal, meal, mode)}
            />
          </div>
        ))}
      </div>

      {composer && (
        <MealComposerOverlay
          baseMeal={composer.baseMeal}
          dayLabel={composer.dayLabel}
          language={language}
          meal={composer.meal}
          onApply={handleApply}
          onClose={() => setComposer(null)}
        />
      )}
    </main>
  );
}

function DietShoppingListCard({ groups, labels }: { groups: ShoppingGroup[]; labels: typeof copy.en | typeof copy.zh }) {
  const [purchasedItems, setPurchasedItems] = useState<Set<string>>(() => new Set());

  function togglePurchasedItem(name: string) {
    setPurchasedItems((current) => {
      const next = new Set(current);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }

  return (
    <section className="card diet-day-card diet-shopping-card" aria-label={labels.shoppingTitle}>
      <div className="diet-shopping-head">
        <div>
          <div className="card-title no-margin">{labels.shoppingTitle}</div>
          <strong>{labels.shoppingSubtitle}</strong>
        </div>
      </div>

      <div className="diet-shopping-groups">
        {groups.map((group) => (
          <div className="diet-shopping-group" key={group.role}>
            <div className="diet-shopping-group-head">
              <span>{group.label}</span>
              <b>{group.items.length}</b>
            </div>
            <div className="diet-shopping-list">
              {group.items.map((item) => (
                <button className={`diet-shopping-line ${item.role} ${purchasedItems.has(item.name) ? "purchased" : ""}`} key={item.name} type="button" onDoubleClick={() => togglePurchasedItem(item.name)} aria-pressed={purchasedItems.has(item.name)}>
                  <span className="diet-shopping-name">{item.name}</span>
                  <i aria-hidden="true" />
                  <strong>{formatShoppingAmount(item.grams)}</strong>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function DietTemplateToggle({ labels, template, onChange }: { labels: typeof copy.en | typeof copy.zh; template: DietTemplate; onChange: (template: DietTemplate) => void }) {
  return (
    <div className="diet-template-toggle" aria-label={labels.templatePrep}>
      <button className={template === "meals" ? "active" : ""} type="button" onClick={() => onChange("meals")}>{labels.templateMeals}</button>
      <button className={template === "prep" ? "active" : ""} type="button" onClick={() => onChange("prep")}>{labels.templatePrep}</button>
    </div>
  );
}

function DietInfoCard({ labels }: { labels: typeof copy.en | typeof copy.zh }) {
  return (
    <section className="card diet-day-card diet-info-card" aria-label={labels.infoTitle}>
      <div className="diet-day-head">
        <div>
          <div className="card-title no-margin">{labels.infoTitle}</div>
          <strong>{labels.infoSubtitle}</strong>
        </div>
      </div>
      <div className="diet-info-list">
        {labels.infoItems.map((item) => (
          <div className="diet-info-line" key={item}>{item}</div>
        ))}
      </div>
    </section>
  );
}

function DietDayCard({
  day,
  baseDay,
  template,
  labels,
  onMealOpen
}: {
  day: DietDay;
  baseDay: DietDay;
  template: DietTemplate;
  labels: typeof copy.en | typeof copy.zh;
  onMealOpen: (baseMeal: DietMeal, meal: DietMeal, mode?: DietTemplate) => void;
}) {
  const mealPrep = day.meals[0] ?? buildMealPrepMeal(day, labels.mealPrepTitle);
  const baseMealPrep = buildMealPrepMeal(baseDay, labels.mealPrepTitle);

  return (
    <section className="card diet-day-card">
      <div className="diet-day-head">
        <div>
          <div className="card-title no-margin">{day.day}</div>
          <strong>{day.type}</strong>
        </div>
        <div className="diet-day-target">
          <span>{labels.target}</span>
          <strong>{day.target.calories} {labels.kcal}</strong>
        </div>
      </div>

      {template === "prep" ? (
        <DietMealPrepTile
          labels={labels}
          meal={mealPrep}
          onOpen={() => onMealOpen(baseMealPrep, mealPrep, "prep")}
        />
      ) : (
        <div className="diet-meal-stack">
          {day.meals.map((meal, mealIndex) => (
            <DietMealTile
              baseMeal={baseDay.meals[mealIndex]}
              labels={labels}
              meal={meal}
              key={meal.name}
              onOpen={() => onMealOpen(baseDay.meals[mealIndex], meal)}
            />
          ))}
        </div>
      )}

      <div className="diet-total-line">
        <span>{labels.estimate}</span>
        <strong>{day.totals.calories} {labels.kcal}</strong>
        <span>{labels.protein} {day.totals.proteinG}g</span>
        <span>{labels.carbs} {day.totals.carbsG}g</span>
        <span>{labels.fat} {day.totals.fatG}g</span>
      </div>
    </section>
  );
}

function DietMealPrepTile({ meal, labels, onOpen }: { meal: DietMeal; labels: typeof copy.en | typeof copy.zh; onOpen: () => void }) {
  return (
    <div className="diet-meal-prep-card">
      <div className="diet-meal-prep-head">
        <div>
          <strong>{labels.mealPrepTitle}</strong>
          <span>{labels.mealPrepSubtitle}</span>
        </div>
        <button type="button" onClick={onOpen}>{labels.mealPrepServings}</button>
      </div>
      <DietMealTile baseMeal={meal} labels={labels} meal={meal} onOpen={onOpen} />
    </div>
  );
}

function DietMealTile({
  meal,
  labels,
  onOpen
}: {
  baseMeal: DietMeal;
  meal: DietMeal;
  labels: typeof copy.en | typeof copy.zh;
  onOpen: () => void;
}) {
  const timerRef = useRef<number | null>(null);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);

  function clearPress() {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    startPointRef.current = { x: event.clientX, y: event.clientY };
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      onOpen();
    }, 520);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!startPointRef.current) return;
    const deltaX = Math.abs(event.clientX - startPointRef.current.x);
    const deltaY = Math.abs(event.clientY - startPointRef.current.y);
    if (deltaX > 10 || deltaY > 10) clearPress();
  }

  return (
    <div
      className="diet-meal diet-meal-interactive"
      onContextMenu={(event) => event.preventDefault()}
      onDoubleClick={onOpen}
      onPointerCancel={clearPress}
      onPointerDown={handlePointerDown}
      onPointerLeave={clearPress}
      onPointerMove={handlePointerMove}
      onPointerUp={clearPress}
    >
      <div className="diet-meal-head">
        <strong>{meal.name}</strong>
        <span>{meal.calories} {labels.kcal}</span>
      </div>
      <div className="diet-food-list">
        {meal.items.map((item) => (
          <span className={getFoodRoleClass(item.name)} key={`${meal.name}-${item.name}`}>{item.name} {item.grams}g</span>
        ))}
      </div>
      <div className="diet-macro-line">
        <span>{labels.protein} {meal.proteinG}g</span>
        <span>{labels.carbs} {meal.carbsG}g</span>
        <span>{labels.fat} {meal.fatG}g</span>
      </div>
    </div>
  );
}

function getFoodRoleClass(foodName: string): string {
  const food = getMealFoodOptions().find((item) => item.name === foodName);
  return food ? getMealFoodRole(food) : "";
}

function buildShoppingGroups(week: DietDay[], labels: Record<ShoppingRole, string>): ShoppingGroup[] {
  const foodRoleByName = new Map(getMealFoodOptions().map((food) => [food.name, getMealFoodRole(food)]));
  const ingredients = new Map<string, ShoppingIngredient>();

  for (const day of week) {
    for (const meal of day.meals) {
      for (const item of meal.items) {
        const role = foodRoleByName.get(item.name) ?? "plant";
        const current = ingredients.get(item.name);
        if (current) {
          current.grams += item.grams;
        } else {
          ingredients.set(item.name, { name: item.name, grams: item.grams, role });
        }
      }
    }
  }

  const orderedRoles: ShoppingRole[] = ["protein", "carb", "fat", "plant"];
  return orderedRoles
    .map((role) => ({
      role,
      label: labels[role],
      items: [...ingredients.values()]
        .filter((item) => item.role === role)
        .sort((a, b) => b.grams - a.grams || a.name.localeCompare(b.name))
    }))
    .filter((group) => group.items.length > 0);
}

function formatShoppingAmount(grams: number): string {
  if (grams >= 1000) {
    const kilograms = grams / 1000;
    return `${Number.isInteger(kilograms) ? kilograms.toFixed(0) : kilograms.toFixed(1)}kg`;
  }
  return `${Math.round(grams)}g`;
}

function buildMealPrepMeal(day: DietDay, name: string): DietMeal {
  const itemGrams = new Map<string, number>();

  for (const meal of day.meals) {
    for (const item of meal.items) {
      itemGrams.set(item.name, (itemGrams.get(item.name) ?? 0) + item.grams);
    }
  }

  const foodByName = new Map(getMealFoodOptions().map((food) => [food.name, food]));
  const candidates = [...itemGrams.entries()]
    .map(([itemName, grams]) => {
      const food = foodByName.get(itemName);
      return food ? { food, grams } : null;
    })
    .filter((candidate): candidate is { food: FoodWithCategory; grams: number } => Boolean(candidate));
  const prepFoodNames = selectMealPrepFoodNames(candidates);

  return optimizeMealFromFoodNames(name, day.target, prepFoodNames).meal;
}

function selectMealPrepFoodNames(candidates: Array<{ food: FoodWithCategory; grams: number }>): string[] {
  const selected: string[] = [];

  addBestCandidate(selected, candidates, (food) => food.category === "proteins", (food, grams) => food.protein * grams);
  addBestCandidate(selected, candidates, (food) => food.category === "carbs", (food, grams) => food.carbs * grams);
  addBestCandidate(selected, candidates, (food) => food.category === "vegetables", (_food, grams) => grams);
  addBestCandidate(selected, candidates, (food) => food.category === "dairy", (food, grams) => food.protein * grams);
  addBestCandidate(selected, candidates, (food, grams) => food.category === "fruits" && grams >= 40, (food, grams) => food.carbs * grams);

  if (selected.length < 4) {
    addBestCandidate(selected, candidates, (food) => food.category === "fats", (food, grams) => food.fat * grams);
  }

  return selected.length > 0 ? selected : candidates.slice(0, 5).map((candidate) => candidate.food.name);
}

function addBestCandidate(
  selected: string[],
  candidates: Array<{ food: FoodWithCategory; grams: number }>,
  predicate: (food: FoodWithCategory, grams: number) => boolean,
  score: (food: FoodWithCategory, grams: number) => number
) {
  const candidate = candidates
    .filter((item) => predicate(item.food, item.grams) && !selected.includes(item.food.name))
    .sort((a, b) => score(b.food, b.grams) - score(a.food, a.grams) || a.food.name.localeCompare(b.food.name))[0];

  if (candidate && selected.length < 5) selected.push(candidate.food.name);
}

function buildPrepWeek(baseWeek: DietDay[], overrides: DietPrepOverride[], mealName: string): DietDay[] {
  return baseWeek.map((day) => {
    const basePrepMeal = buildMealPrepMeal(day, mealName);
    const override = findDietPrepOverride(overrides, day.day);
    const prepMeal = override ? optimizeMealFromFoodNames(mealName, day.target, override.foodNames).meal : basePrepMeal;

    return {
      ...day,
      meals: [prepMeal],
      totals: sumDietMeals([prepMeal])
    };
  });
}

function applyOverridesToWeek(baseWeek: DietDay[], overrides: DietMealOverride[]): DietDay[] {
  return baseWeek.map((day) => {
    const meals = day.meals.map((meal) => {
      const override = findMealOverride(overrides, day.day, meal.name);
      return override ? optimizeMealFromFoodNames(meal.name, meal, override.foodNames).meal : meal;
    });

    return { ...day, meals, totals: sumDietMeals(meals) };
  });
}

function getCarouselCards(week: DietDay[], baseWeek: DietDay[], activeIndex: number): CarouselDayCard[] {
  void activeIndex;
  return week.map((day, index) => ({ baseDay: baseWeek[index], day, index, slot: "current" }));
}

function getTodayWeekIndex(): number {
  if (typeof Date === "undefined") return 0;
  const day = new Date().getDay();
  return day === 0 ? 6 : day - 1;
}

function normalizeDayIndex(index: number, length: number): number {
  return ((index % length) + length) % length;
}

function loadLanguage(): Language {
  if (typeof window === "undefined") return "en";
  return window.localStorage.getItem("last_chance_language") === "zh" ? "zh" : "en";
}

function loadDietTemplate(): DietTemplate {
  if (typeof window === "undefined") return "meals";
  return window.localStorage.getItem(DIET_TEMPLATE_KEY) === "prep" ? "prep" : "meals";
}

function saveDietTemplate(template: DietTemplate): void {
  window.localStorage.setItem(DIET_TEMPLATE_KEY, template);
}
