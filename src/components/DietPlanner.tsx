import { buildDietWeek } from "../core/dietPlan";
import type { DietDay } from "../core/dietPlan";
import { loadInput } from "../storage/localPlan";

type Language = "en" | "zh";

const copy = {
  en: {
    title: "Diet",
    subtitle: "A one-week template generated from your saved plan.",
    emptyTitle: "No saved plan yet",
    emptyText: "Go to Plan, complete your data, then tap Save plan locally.",
    target: "Target",
    estimate: "Estimated",
    note: "Food values are practical estimates per 100g. Adjust seasoning, sauces, cooking oil, and brands manually.",
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

  if (!savedInput) {
    return (
      <main className="app-shell diet-shell">
        <section className="hero diet-hero">
          <p className="eyebrow">{t.title}</p>
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

  const week = buildDietWeek(savedInput);

  return (
    <main className="app-shell diet-shell">
      <section className="hero diet-hero">
        <p className="eyebrow">{t.title}</p>
        <h1 className="hero-title">Diet</h1>
        <p className="hero-subtitle">{t.subtitle}</p>
      </section>

      <section className="card diet-note-card">
        <p className="small-note no-margin">{t.note}</p>
      </section>

      <div className="diet-week-stack">
        {week.map((day) => (
          <DietDayCard day={day} labels={t} key={day.day} />
        ))}
      </div>
    </main>
  );
}

function DietDayCard({
  day,
  labels
}: {
  day: DietDay;
  labels: typeof copy.en | typeof copy.zh;
}) {
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

      <div className="diet-meal-stack">
        {day.meals.map((meal) => (
          <div className="diet-meal" key={meal.name}>
            <div className="diet-meal-head">
              <strong>{meal.name}</strong>
              <span>{meal.calories} {labels.kcal}</span>
            </div>
            <div className="diet-food-list">
              {meal.items.map((item) => (
                <span key={`${meal.name}-${item.name}`}>{item.name} {item.grams}g</span>
              ))}
            </div>
            <div className="diet-macro-line">
              <span>{labels.protein} {meal.proteinG}g</span>
              <span>{labels.carbs} {meal.carbsG}g</span>
              <span>{labels.fat} {meal.fatG}g</span>
            </div>
          </div>
        ))}
      </div>

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

function loadLanguage(): Language {
  if (typeof window === "undefined") return "en";
  return window.localStorage.getItem("last_chance_language") === "zh" ? "zh" : "en";
}
