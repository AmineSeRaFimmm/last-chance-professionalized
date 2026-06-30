import type { WorkoutDay, WorkoutExercise, WorkoutPlan, WorkoutProgramOption } from "../core/workoutPlan";
import type { FocusByDay, TrainingFocusKey } from "./weeklyStructurePreferences";

export interface CustomWorkoutExercise extends WorkoutExercise {
  sourceId?: string;
  gifUrl: string;
  thumbUrl?: string;
  sourceName: string;
  muscle: string;
}

export interface CustomWorkoutDay {
  day: string;
  exercises: CustomWorkoutExercise[];
}

export interface CustomWorkoutPlanData {
  days: CustomWorkoutDay[];
  updatedAt: string;
}

const CUSTOM_WORKOUT_KEY = "last_chance_custom_workout_plan";
const CUSTOM_PROGRAM: WorkoutProgramOption = {
  id: "auto",
  category: "default",
  name: "Custom Plan",
  description: "User-defined workout week saved from the custom builder.",
  bestFor: "Users who want full control over exercise selection."
};

const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function createEmptyCustomWorkoutPlan(): CustomWorkoutPlanData {
  return {
    updatedAt: new Date().toISOString(),
    days: WEEK_DAYS.map((day) => ({ day, exercises: [] }))
  };
}

export function loadCustomWorkoutPlan(): CustomWorkoutPlanData | null {
  if (typeof window === "undefined") return null;

  try {
    const parsed = JSON.parse(window.localStorage.getItem(CUSTOM_WORKOUT_KEY) ?? "null") as CustomWorkoutPlanData | null;
    if (!parsed || !Array.isArray(parsed.days)) return null;
    return {
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
      days: WEEK_DAYS.map((day) => {
        const savedDay = parsed.days.find((item) => item.day === day);
        return { day, exercises: Array.isArray(savedDay?.exercises) ? savedDay.exercises : [] };
      })
    };
  } catch {
    return null;
  }
}

export function saveCustomWorkoutPlan(plan: CustomWorkoutPlanData): CustomWorkoutPlanData {
  const next = { ...plan, updatedAt: new Date().toISOString() };
  window.localStorage.setItem(CUSTOM_WORKOUT_KEY, JSON.stringify(next));
  return next;
}

export function clearCustomWorkoutPlan(): void {
  window.localStorage.removeItem(CUSTOM_WORKOUT_KEY);
}

export function customWorkoutToWorkoutPlan(plan: CustomWorkoutPlanData, focusByDay: FocusByDay = {}): WorkoutPlan {
  const days: WorkoutDay[] = plan.days.map((day) => {
    const hasExercises = day.exercises.length > 0;
    const focus = focusByDay[day.day] ?? (hasExercises ? "strength" : "rest");
    return {
      day: day.day,
      title: hasExercises ? titleForWeeklyFocus(focus) : "Rest / Build Day",
      focus,
      intent: hasExercises ? "User-defined session" : "Add exercises in Custom Plan.",
      duration: hasExercises ? `${day.exercises.length} exercises` : "Custom",
      intensity: "Custom",
      exercises: day.exercises
    };
  });

  return {
    title: "Custom Workout Week",
    subtitle: "User-defined weekly workout plan.",
    program: CUSTOM_PROGRAM,
    days,
    principles: [
      "Preserve lean mass and strength while cutting.",
      "Use progressive overload, but do not chase personal records during hard deficits.",
      "Steps and low-intensity cardio are the default conditioning tools."
    ]
  };
}

function titleForWeeklyFocus(focus: TrainingFocusKey): string {
  if (focus === "heavyLegs") return "Legs / Lower";
  if (focus === "backDeadlift") return "Back / Deadlift";
  if (focus === "upperBody") return "Upper Body";
  if (focus === "push") return "Push / Chest";
  if (focus === "pull") return "Pull / Back";
  if (focus === "fullBody") return "Full Body";
  if (focus === "strength") return "Strength";
  if (focus === "accessoryCardio") return "Accessory + Cardio";
  if (focus === "lightCardio") return "Light Cardio";
  if (focus === "walkRecovery") return "Walk / Recovery";
  return "Rest";
}
