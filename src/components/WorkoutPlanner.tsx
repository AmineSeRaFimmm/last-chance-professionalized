import { useMemo, useState } from "react";
import { buildSafeCarbCyclingPlan as buildCarbCyclingPlan } from "../core/carbCyclingSafePlan";
import { buildStandardPlan } from "../core/standardPlan";
import type { PlanResult, UserInput } from "../core/types";
import {
  buildWorkoutPlan,
  WORKOUT_PROGRAM_OPTIONS,
  type WorkoutDay,
  type WorkoutProgramCategory,
  type WorkoutProgramId,
  type WorkoutProgramOption
} from "../core/workoutPlan";
import { loadInput } from "../storage/localPlan";
import {
  loadCarbRotationOffset,
  loadTrainingFocusByDay
} from "../storage/weeklyStructurePreferences";

type Language = "en" | "zh";

const PROGRAM_KEY = "last_chance_workout_program";

const copy = {
  en: {
    eyebrow: "Training system",
    title: "Workout",
    subtitle: "A professional fat-loss training week generated from your saved plan.",
    emptyTitle: "No saved plan yet",
    emptyText: "Go to Plan, complete your data, then tap Save plan locally.",
    changePlan: "Change Plan",
    done: "Done",
    principles: "Principles",
    intent: "Intent",
    conditioning: "Conditioning",
    recovery: "Recovery",
    bestFor: "Best for",
    chooseSystem: "Choose training system",
    categories: {
      default: "Default",
      powerlifting: "Powerlifting",
      bodybuilding: "Bodybuilding",
      machine: "Machine Training",
      crossfit: "CrossFit",
      generalStrength: "General Strength",
      home: "Home"
    }
  },
  zh: {
    eyebrow: "训练系统",
    title: "训练计划",
    subtitle: "根据你保存的减脂方案自动生成专业训练周计划。",
    emptyTitle: "还没有保存计划",
    emptyText: "先进入 Plan，填完数据后点击保存到本机。",
    changePlan: "更换计划",
    done: "完成",
    principles: "执行原则",
    intent: "目标",
    conditioning: "体能",
    recovery: "恢复",
    bestFor: "适合",
    chooseSystem: "选择训练体系",
    categories: {
      default: "默认",
      powerlifting: "力量举",
      bodybuilding: "健美分化",
      machine: "器械训练",
      crossfit: "CrossFit",
      generalStrength: "通用力量",
      home: "居家训练"
    }
  }
} as const;

export function WorkoutPlanner() {
  const language = loadLanguage();
  const t = copy[language];
  const savedInput = loadInput();
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [programId, setProgramId] = useState<WorkoutProgramId>(loadProgramId);
  const result = useMemo(() => (savedInput ? buildResult(savedInput) : null), [savedInput]);
  const plan = useMemo(
    () =>
      savedInput && result
        ? buildWorkoutPlan({
            input: savedInput,
            result,
            programId,
            rotationOffset: loadCarbRotationOffset(),
            focusByDay: loadTrainingFocusByDay()
          })
        : null,
    [programId, savedInput, result]
  );

  function chooseProgram(nextProgramId: WorkoutProgramId) {
    setProgramId(nextProgramId);
    window.localStorage.setItem(PROGRAM_KEY, nextProgramId);
    setSelectorOpen(false);
  }

  if (!savedInput || !result || !plan) {
    return (
      <main className="app-shell workout-shell">
        <section className="hero workout-hero">
          <p className="eyebrow">{t.eyebrow}</p>
          <h1 className="hero-title">Workout</h1>
          <p className="hero-subtitle">{t.subtitle}</p>
        </section>
        <section className="card">
          <div className="card-title">{t.emptyTitle}</div>
          <p className="small-note no-margin">{t.emptyText}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell workout-shell">
      <section className="hero workout-hero">
        <div className="hero-topline">
          <p className="eyebrow">{t.eyebrow}</p>
          <button className="change-plan-button" type="button" onClick={() => setSelectorOpen(true)}>
            {t.changePlan}
          </button>
        </div>
        <h1 className="hero-title">Workout</h1>
        <p className="hero-subtitle">{plan.subtitle}</p>
      </section>

      <section className="card workout-program-card">
        <div>
          <div className="card-title">{plan.title}</div>
          <p className="small-note no-margin">{plan.program.description}</p>
        </div>
        <div className="program-best-for">
          <span>{t.bestFor}</span>
          <strong>{plan.program.bestFor}</strong>
        </div>
      </section>

      <section className="card">
        <div className="card-title">{t.principles}</div>
        <div className="principle-stack">
          {plan.principles.map((principle) => <div className="principle-line" key={principle}>{principle}</div>)}
        </div>
      </section>

      <div className="workout-week-stack">
        {plan.days.map((day) => <WorkoutDayCard day={day} labels={t} key={day.day} />)}
      </div>

      {selectorOpen && (
        <div className="workout-selector-overlay" role="dialog" aria-modal="true" aria-label={t.chooseSystem}>
          <button className="workout-selector-backdrop" type="button" aria-label={t.done} onClick={() => setSelectorOpen(false)} />
          <section className="workout-selector-modal">
            <div className="workout-selector-head">
              <div>
                <strong>{t.chooseSystem}</strong>
                <span>{result.kind === "carbCycling" ? "Carb cycling alignment stays active." : "Default plan follows your saved fat-loss setup."}</span>
              </div>
              <button type="button" onClick={() => setSelectorOpen(false)}>{t.done}</button>
            </div>

            {groupPrograms().map(([category, options]) => (
              <div className="program-category" key={category}>
                <div className="program-category-title">{t.categories[category]}</div>
                {options.map((option) => (
                  <button className={`program-option ${programId === option.id ? "active" : ""}`} type="button" onClick={() => chooseProgram(option.id)} key={option.id}>
                    <strong>{option.name}</strong>
                    <span>{option.description}</span>
                  </button>
                ))}
              </div>
            ))}
          </section>
        </div>
      )}
    </main>
  );
}

function WorkoutDayCard({ day, labels }: { day: WorkoutDay; labels: typeof copy.en | typeof copy.zh }) {
  return (
    <section className="card workout-day-card">
      <div className="workout-day-head">
        <div><div className="card-title no-margin">{day.day}</div><strong>{day.title}</strong></div>
        <div className="workout-day-badges">
          {day.carbType && <span className={`day-type ${day.carbType.toLowerCase()}`}>{day.carbType}</span>}
          <span>{day.duration}</span>
        </div>
      </div>

      <div className="workout-intent-grid">
        <div><span>{labels.intent}</span><strong>{day.intent}</strong></div>
        <div><span>{labels.intensity}</span><strong>{day.intensity}</strong></div>
      </div>

      <div className="exercise-stack">
        {day.exercises.map((exercise) => (
          <div className="exercise-row" key={`${day.day}-${exercise.name}`}>
            <strong>{exercise.name}</strong>
            <span>{exercise.prescription}</span>
            {exercise.note && <em>{exercise.note}</em>}
          </div>
        ))}
      </div>

      {(day.conditioning || day.recovery) && (
        <div className="workout-note-grid">
          {day.conditioning && <div><span>{labels.conditioning}</span><strong>{day.conditioning}</strong></div>}
          {day.recovery && <div><span>{labels.recovery}</span><strong>{day.recovery}</strong></div>}
        </div>
      )}
    </section>
  );
}

function buildResult(input: UserInput): PlanResult {
  if (input.sex === "male" && input.planType === "carbCycling") return buildCarbCyclingPlan(input);
  return buildStandardPlan(input);
}

function loadProgramId(): WorkoutProgramId {
  const stored = window.localStorage.getItem(PROGRAM_KEY) as WorkoutProgramId | null;
  return WORKOUT_PROGRAM_OPTIONS.some((option) => option.id === stored) ? stored : "auto";
}

function groupPrograms(): [WorkoutProgramCategory, WorkoutProgramOption[]][] {
  const categories: WorkoutProgramCategory[] = ["default", "powerlifting", "bodybuilding", "machine", "crossfit", "generalStrength", "home"];
  return categories.map((category) => [category, WORKOUT_PROGRAM_OPTIONS.filter((option) => option.category === category)]);
}

function loadLanguage(): Language {
  if (typeof window === "undefined") return "en";
  return window.localStorage.getItem("last_chance_language") === "zh" ? "zh" : "en";
}
