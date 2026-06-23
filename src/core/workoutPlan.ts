import type { CarbCyclingPlanResult, PlanResult, UserInput } from "./types";
import type { FocusByDay, TrainingFocusKey } from "../storage/weeklyStructurePreferences";

export type WorkoutProgramCategory =
  | "default"
  | "powerlifting"
  | "bodybuilding"
  | "machine"
  | "crossfit"
  | "generalStrength"
  | "home";

export type WorkoutProgramId =
  | "auto"
  | "powerlifting-531"
  | "powerlifting-texas-method"
  | "powerlifting-starting-strength"
  | "bodybuilding-ppl"
  | "bodybuilding-upper-lower"
  | "bodybuilding-full-body"
  | "machine-full-body"
  | "machine-upper-lower"
  | "crossfit-strength-metcon"
  | "crossfit-beginner-wod"
  | "general-strength-fat-loss"
  | "home-minimal-equipment";

export interface WorkoutProgramOption {
  id: WorkoutProgramId;
  category: WorkoutProgramCategory;
  name: string;
  description: string;
  bestFor: string;
}

export interface WorkoutExercise {
  name: string;
  prescription: string;
  note?: string;
}

export interface WorkoutDay {
  day: string;
  title: string;
  carbType?: "High" | "Medium" | "Low";
  focus: TrainingFocusKey;
  intent: string;
  duration: string;
  intensity: string;
  exercises: WorkoutExercise[];
  conditioning?: string;
  recovery?: string;
}

export interface WorkoutPlan {
  title: string;
  subtitle: string;
  program: WorkoutProgramOption;
  days: WorkoutDay[];
  principles: string[];
}

interface FocusSlot {
  focus: TrainingFocusKey;
  carbType?: "High" | "Medium" | "Low";
}

export const WORKOUT_PROGRAM_OPTIONS: WorkoutProgramOption[] = [
  { id: "auto", category: "default", name: "Last Chance Auto", description: "Default fat-loss program matched to saved nutrition and weekly structure.", bestFor: "Most users who want the app to control recovery and adherence." },
  { id: "powerlifting-531", category: "powerlifting", name: "5/3/1 Fat-Loss Strength", description: "Four main-lift days with conservative assistance and recovery-first conditioning.", bestFor: "Intermediate lifters who want strength retention during a cut." },
  { id: "powerlifting-texas-method", category: "powerlifting", name: "Texas Method Cut Variant", description: "Volume / recovery / intensity structure, compressed for calorie deficit recovery.", bestFor: "Experienced barbell trainees who tolerate heavy weekly loading." },
  { id: "powerlifting-starting-strength", category: "powerlifting", name: "Starting Strength Linear", description: "Three full-body barbell sessions built around squat, press, bench, deadlift, and rows.", bestFor: "Novice lifters who can still progress linearly." },
  { id: "bodybuilding-ppl", category: "bodybuilding", name: "Push Pull Legs", description: "Hypertrophy-oriented split with cut-adjusted volume and non-failure execution.", bestFor: "Gym users training 4–6 days per week." },
  { id: "bodybuilding-upper-lower", category: "bodybuilding", name: "Upper / Lower", description: "Balanced four-day split with clear recovery days and repeatable progression.", bestFor: "Most fat-loss users with 3–4 lifting days." },
  { id: "bodybuilding-full-body", category: "bodybuilding", name: "Full Body Hypertrophy", description: "Three full-body sessions emphasizing large patterns and moderate joint stress.", bestFor: "Busy users or beginners who need high consistency." },
  { id: "machine-full-body", category: "machine", name: "Machine Full Body", description: "Stable machine-based plan that reduces technical complexity and injury risk.", bestFor: "Beginners, hotel gyms, or users who prefer guided equipment." },
  { id: "machine-upper-lower", category: "machine", name: "Machine Upper / Lower", description: "Four sessions using machines and cables with controlled fatigue.", bestFor: "Gym users cutting hard but wanting predictable execution." },
  { id: "crossfit-strength-metcon", category: "crossfit", name: "Strength + MetCon", description: "Strength primer plus short conditioning blocks, avoiding excessive cut fatigue.", bestFor: "Conditioning-focused users with solid movement skill." },
  { id: "crossfit-beginner-wod", category: "crossfit", name: "Beginner WOD Structure", description: "Simple mixed-modal training with skill practice, strength, and controlled finishers.", bestFor: "Users who want CrossFit-style variety without advanced Olympic lifting." },
  { id: "general-strength-fat-loss", category: "generalStrength", name: "General Strength Cut", description: "Low-friction strength plan for muscle retention, steps, and recovery.", bestFor: "General fat-loss users who do not need sport specialization." },
  { id: "home-minimal-equipment", category: "home", name: "Home Minimal Equipment", description: "Dumbbells, bands, bodyweight, walking, and simple progressive overload.", bestFor: "Home training or travel weeks." }
];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function buildWorkoutPlan({ input, result, programId, rotationOffset, focusByDay }: {
  input: UserInput;
  result: PlanResult;
  programId: WorkoutProgramId;
  rotationOffset: number;
  focusByDay: FocusByDay;
}): WorkoutPlan {
  const program = resolveProgram(programId, input);
  const slots = buildFocusSlots(input, result, program.id, rotationOffset, focusByDay);
  const days = DAYS.map((day, index) => buildDay(day, slots[index], program.id, input.trainingDaysPerWeek));

  return {
    title: result.kind === "carbCycling" && program.id === "auto" ? "Carb Cycling Workout Week" : program.id === "auto" ? "Standard Fat-Loss Workout Week" : program.name,
    subtitle: buildSubtitle(input, result, program),
    program,
    days,
    principles: getFatLossPrinciples(result.kind)
  };
}

function resolveProgram(programId: WorkoutProgramId, input: UserInput): WorkoutProgramOption {
  if (programId !== "auto") return WORKOUT_PROGRAM_OPTIONS.find((option) => option.id === programId) ?? WORKOUT_PROGRAM_OPTIONS[0];
  return {
    ...WORKOUT_PROGRAM_OPTIONS[0],
    description: input.planType === "carbCycling" ? "Default workout week aligned to your carb cycling structure." : "Default fat-loss workout week matched to your training frequency."
  };
}

function buildSubtitle(input: UserInput, result: PlanResult, program: WorkoutProgramOption): string {
  if (result.kind === "carbCycling" && program.id === "auto") return "Training stress is matched to high, medium, and low carb days from your saved weekly structure.";
  if (program.id === "auto") return `Built around ${input.trainingDaysPerWeek} training days, progressive overload, steps, and recovery.`;
  return program.description;
}

function buildFocusSlots(input: UserInput, result: PlanResult, programId: WorkoutProgramId, rotationOffset: number, focusByDay: FocusByDay): FocusSlot[] {
  if (result.kind === "carbCycling") return buildCarbFocusSlots(result, rotationOffset, focusByDay);
  return getProgramFocusSequence(programId, input.trainingDaysPerWeek).map((focus) => ({ focus }));
}

function buildCarbFocusSlots(result: CarbCyclingPlanResult, rotationOffset: number, focusByDay: FocusByDay): FocusSlot[] {
  const rotatedTypes = rotateCarbTypes(result.weeklySchedule.map((row) => row.type), rotationOffset);
  return result.weeklySchedule.map((row, index) => ({
    focus: focusByDay[row.day] ?? inferFocus(row.note),
    carbType: rotatedTypes[index]
  }));
}

function getProgramFocusSequence(programId: WorkoutProgramId, trainingDays: number): TrainingFocusKey[] {
  if (programId === "powerlifting-531") return ["heavyLegs", "upperBody", "walkRecovery", "backDeadlift", "upperBody", "lightCardio", "rest"];
  if (programId === "powerlifting-texas-method") return ["fullBody", "walkRecovery", "fullBody", "walkRecovery", "strength", "lightCardio", "rest"];
  if (programId === "powerlifting-starting-strength") return ["fullBody", "walkRecovery", "fullBody", "walkRecovery", "fullBody", "lightCardio", "rest"];
  if (programId === "bodybuilding-ppl") return ["push", "pull", "heavyLegs", "walkRecovery", "push", "pull", "rest"];
  if (programId === "bodybuilding-upper-lower") return ["upperBody", "heavyLegs", "walkRecovery", "upperBody", "backDeadlift", "lightCardio", "rest"];
  if (programId === "bodybuilding-full-body") return ["fullBody", "walkRecovery", "fullBody", "walkRecovery", "fullBody", "lightCardio", "rest"];
  if (programId === "machine-full-body") return ["fullBody", "walkRecovery", "fullBody", "walkRecovery", "fullBody", "lightCardio", "rest"];
  if (programId === "machine-upper-lower") return ["upperBody", "heavyLegs", "walkRecovery", "upperBody", "backDeadlift", "lightCardio", "rest"];
  if (programId === "crossfit-strength-metcon") return ["strength", "lightCardio", "strength", "walkRecovery", "fullBody", "lightCardio", "rest"];
  if (programId === "crossfit-beginner-wod") return ["fullBody", "walkRecovery", "strength", "walkRecovery", "fullBody", "lightCardio", "rest"];
  if (programId === "home-minimal-equipment") return ["fullBody", "walkRecovery", "upperBody", "walkRecovery", "heavyLegs", "lightCardio", "rest"];
  if (trainingDays <= 2) return ["fullBody", "walkRecovery", "fullBody", "walkRecovery", "lightCardio", "walkRecovery", "rest"];
  if (trainingDays === 3) return ["fullBody", "walkRecovery", "upperBody", "walkRecovery", "fullBody", "lightCardio", "rest"];
  if (trainingDays === 4) return ["heavyLegs", "upperBody", "walkRecovery", "backDeadlift", "upperBody", "lightCardio", "rest"];
  return ["heavyLegs", "push", "pull", "walkRecovery", "fullBody", "lightCardio", "rest"];
}

function buildDay(day: string, slot: FocusSlot, programId: WorkoutProgramId, trainingDays: number): WorkoutDay {
  const { focus, carbType } = slot;
  const recoveryOnly = isRecoveryFocus(focus) || (carbType === "Low" && isRecoveryFocus(focus));
  const exercises = recoveryOnly ? recoveryExercises(focus) : exercisesForFocus(focus, programId, carbType, trainingDays);
  return {
    day,
    title: titleForFocus(focus, programId),
    carbType,
    focus,
    intent: buildIntent(focus, carbType),
    duration: recoveryOnly ? "25–45 min" : focus === "strength" ? "45–60 min" : "50–75 min",
    intensity: intensityFor(focus, carbType),
    exercises,
    conditioning: conditioningFor(focus, carbType, programId),
    recovery: recoveryFor(focus, carbType)
  };
}

function exercisesForFocus(focus: TrainingFocusKey, programId: WorkoutProgramId, carbType: "High" | "Medium" | "Low" | undefined, trainingDays: number): WorkoutExercise[] {
  const volumeNote = carbType === "Low" ? "keep 2–3 reps in reserve" : "stop 1–2 reps before failure";
  if (programId === "powerlifting-531") return powerlifting531Exercises(focus);
  if (programId === "powerlifting-texas-method") return texasMethodExercises(focus);
  if (programId === "powerlifting-starting-strength") return startingStrengthExercises(focus);
  if (programId === "machine-full-body" || programId === "machine-upper-lower") return machineExercises(focus);
  if (programId === "crossfit-strength-metcon" || programId === "crossfit-beginner-wod") return crossfitExercises(focus);
  if (programId === "home-minimal-equipment") return homeExercises(focus);
  if (focus === "heavyLegs") return [
    { name: "Back squat", prescription: "4 × 4–6", note: volumeNote },
    { name: "Romanian deadlift", prescription: "3 × 6–8" },
    { name: "Leg press or split squat", prescription: "3 × 8–10" },
    { name: "Hamstring curl", prescription: "2–3 × 10–12" },
    { name: "Standing calf raise", prescription: "3 × 10–15" }
  ];
  if (focus === "backDeadlift") return [
    { name: "Deadlift", prescription: "3 × 3–5", note: volumeNote },
    { name: "Chest-supported row", prescription: "4 × 6–10" },
    { name: "Lat pulldown or pull-up", prescription: "3 × 8–10" },
    { name: "Hip hinge accessory", prescription: "2 × 8–10" },
    { name: "Loaded carry", prescription: "4 × 30–40 m" }
  ];
  if (focus === "upperBody") return [
    { name: "Bench press", prescription: "4 × 5–8", note: volumeNote },
    { name: "Row", prescription: "4 × 6–10" },
    { name: "Overhead press", prescription: "3 × 6–8" },
    { name: "Pulldown or pull-up", prescription: "3 × 8–10" },
    { name: "Lateral raise + curls", prescription: "2–3 × 12–15" }
  ];
  if (focus === "push") return [
    { name: "Bench press", prescription: "4 × 5–8" },
    { name: "Incline dumbbell press", prescription: "3 × 8–10" },
    { name: "Overhead press", prescription: "3 × 6–8" },
    { name: "Lateral raise", prescription: "3 × 12–15" },
    { name: "Triceps pressdown", prescription: "3 × 10–15" }
  ];
  if (focus === "pull") return [
    { name: "Pull-up or pulldown", prescription: "4 × 6–10" },
    { name: "Barbell or cable row", prescription: "4 × 6–10" },
    { name: "Rear delt raise", prescription: "3 × 12–15" },
    { name: "Back extension", prescription: "2–3 × 10–12" },
    { name: "Curl variation", prescription: "3 × 10–15" }
  ];
  if (focus === "fullBody" || focus === "strength") return [
    { name: "Squat pattern", prescription: trainingDays <= 3 ? "4 × 5" : "3 × 5" },
    { name: "Press pattern", prescription: "3–4 × 5–8" },
    { name: "Pull pattern", prescription: "4 × 6–10" },
    { name: "Hip hinge", prescription: "2–3 × 6–8" },
    { name: "Core anti-extension", prescription: "3 × 30–45 sec" }
  ];
  return recoveryExercises(focus);
}

function powerlifting531Exercises(focus: TrainingFocusKey): WorkoutExercise[] {
  const mainLift = focus === "heavyLegs" ? "Squat" : focus === "backDeadlift" ? "Deadlift" : focus === "upperBody" ? "Bench press" : "Overhead press";
  return [
    { name: `${mainLift} 5/3/1 work`, prescription: "3 main work sets", note: "use training max, no grinders during a cut" },
    { name: `${mainLift} first-set-last`, prescription: "3 × 5" },
    { name: "Opposite pattern assistance", prescription: "3 × 8–12" },
    { name: "Single-leg or row assistance", prescription: "3 × 8–12" },
    { name: "Core or carry", prescription: "3–4 sets" }
  ];
}

function texasMethodExercises(focus: TrainingFocusKey): WorkoutExercise[] {
  if (focus === "strength") return [
    { name: "Squat intensity", prescription: "1 × 5 or 3 × 3" },
    { name: "Bench or press intensity", prescription: "1 × 5 or 3 × 3" },
    { name: "Deadlift", prescription: "1–2 × 5" },
    { name: "Chin-up", prescription: "3 sets" }
  ];
  if (focus === "walkRecovery" || focus === "lightCardio" || focus === "rest") return recoveryExercises(focus);
  return [
    { name: "Squat volume", prescription: "5 × 5", note: "reduce load 5–10% if recovery drops" },
    { name: "Bench or press volume", prescription: "5 × 5" },
    { name: "Row", prescription: "4 × 8" },
    { name: "Back extension", prescription: "3 × 10" }
  ];
}

function startingStrengthExercises(focus: TrainingFocusKey): WorkoutExercise[] {
  if (isRecoveryFocus(focus)) return recoveryExercises(focus);
  return [
    { name: "Squat", prescription: "3 × 5" },
    { name: "Bench press or overhead press", prescription: "3 × 5", note: "alternate each session" },
    { name: "Deadlift or power clean", prescription: "1 × 5 / 5 × 3", note: "deadlift volume stays low during a cut" },
    { name: "Chin-up or row", prescription: "3 × 6–10" }
  ];
}

function machineExercises(focus: TrainingFocusKey): WorkoutExercise[] {
  if (focus === "heavyLegs" || focus === "backDeadlift") return [
    { name: "Leg press", prescription: "4 × 8–12" },
    { name: "Seated leg curl", prescription: "3 × 10–12" },
    { name: "Leg extension", prescription: "3 × 10–12" },
    { name: "Hip thrust machine", prescription: "3 × 8–12" },
    { name: "Cable core press", prescription: "3 × 10–12/side" }
  ];
  if (focus === "upperBody" || focus === "push" || focus === "pull") return [
    { name: "Chest press machine", prescription: "3–4 × 8–12" },
    { name: "Seated row", prescription: "3–4 × 8–12" },
    { name: "Shoulder press machine", prescription: "3 × 8–10" },
    { name: "Lat pulldown", prescription: "3 × 10–12" },
    { name: "Cable lateral raise + arms", prescription: "2–3 × 12–15" }
  ];
  return recoveryExercises(focus);
}

function crossfitExercises(focus: TrainingFocusKey): WorkoutExercise[] {
  if (isRecoveryFocus(focus)) return recoveryExercises(focus);
  return [
    { name: "Skill practice", prescription: "8–10 min", note: "simple gymnastics, carries, or technique" },
    { name: "Strength primer", prescription: "5 × 3 or 4 × 5", note: "submaximal, crisp reps" },
    { name: "MetCon", prescription: "8–14 min", note: "avoid redline failure during aggressive cuts" },
    { name: "Cooldown walk + breathing", prescription: "8–12 min" }
  ];
}

function homeExercises(focus: TrainingFocusKey): WorkoutExercise[] {
  if (isRecoveryFocus(focus)) return recoveryExercises(focus);
  return [
    { name: "Goblet squat or split squat", prescription: "4 × 8–12" },
    { name: "Push-up or dumbbell press", prescription: "4 × 8–12" },
    { name: "Band row or one-arm row", prescription: "4 × 10–15" },
    { name: "Dumbbell Romanian deadlift", prescription: "3 × 8–12" },
    { name: "Plank or dead bug", prescription: "3 sets" }
  ];
}

function recoveryExercises(focus: TrainingFocusKey): WorkoutExercise[] {
  if (focus === "rest") return [{ name: "Rest day", prescription: "No formal lifting", note: "keep steps easy and sleep high" }];
  if (focus === "lightCardio") return [{ name: "Zone 2 cardio", prescription: "25–40 min", note: "easy nasal-breathing pace" }];
  return [
    { name: "Brisk walk", prescription: "30–45 min" },
    { name: "Mobility circuit", prescription: "8–12 min", note: "hips, T-spine, ankles, shoulders" }
  ];
}

function titleForFocus(focus: TrainingFocusKey, programId: WorkoutProgramId): string {
  if (focus === "heavyLegs") return "Lower Strength";
  if (focus === "backDeadlift") return "Posterior Chain";
  if (focus === "upperBody") return "Upper Strength";
  if (focus === "push") return "Push";
  if (focus === "pull") return "Pull";
  if (focus === "fullBody") return programId.includes("crossfit") ? "Full-Body WOD" : "Full Body";
  if (focus === "strength") return "Strength + Conditioning";
  if (focus === "accessoryCardio") return "Accessory + Cardio";
  if (focus === "lightCardio") return "Zone 2";
  if (focus === "walkRecovery") return "Recovery";
  return "Rest";
}

function buildIntent(focus: TrainingFocusKey, carbType?: "High" | "Medium" | "Low"): string {
  if (carbType === "High") return "Push performance on the heaviest work while avoiding failure reps.";
  if (carbType === "Medium") return "Accumulate quality work with moderate fatigue.";
  if (carbType === "Low") return "Protect recovery and maintain movement quality.";
  if (isRecoveryFocus(focus)) return "Recover, maintain steps, and lower fatigue.";
  return "Preserve lean mass and strength while cutting.";
}

function intensityFor(focus: TrainingFocusKey, carbType?: "High" | "Medium" | "Low"): string {
  if (isRecoveryFocus(focus)) return "Easy";
  if (carbType === "High") return "RPE 7–9";
  if (carbType === "Low") return "RPE 6–7";
  return "RPE 7–8";
}

function conditioningFor(focus: TrainingFocusKey, carbType: "High" | "Medium" | "Low" | undefined, programId: WorkoutProgramId): string | undefined {
  if (programId.includes("crossfit")) return "MetCon stays short enough that technique does not degrade.";
  if (focus === "lightCardio") return "Zone 2 only.";
  if (focus === "walkRecovery" || focus === "rest") return undefined;
  if (carbType === "High") return "Optional 8–10 min easy cooldown only.";
  return "10–20 min incline walk or bike after lifting if recovery is good.";
}

function recoveryFor(focus: TrainingFocusKey, carbType?: "High" | "Medium" | "Low"): string {
  if (carbType === "Low" || isRecoveryFocus(focus)) return "Prioritize steps, sleep, hydration, and no failure training.";
  return "Progress load only when bar speed and form stay consistent.";
}

function isRecoveryFocus(focus: TrainingFocusKey): boolean {
  return focus === "walkRecovery" || focus === "lightCardio" || focus === "rest";
}

function inferFocus(note: string): TrainingFocusKey {
  const normalized = note.toLowerCase();
  if (normalized.includes("deadlift") || normalized.includes("back")) return "backDeadlift";
  if (normalized.includes("legs")) return "heavyLegs";
  if (normalized.includes("upper")) return "upperBody";
  if (normalized.includes("full")) return "fullBody";
  if (normalized.includes("accessory")) return "accessoryCardio";
  if (normalized.includes("light cardio")) return "lightCardio";
  if (normalized.includes("walk") || normalized.includes("recovery")) return "walkRecovery";
  if (normalized.includes("rest")) return "rest";
  return "strength";
}

function rotateCarbTypes(types: ("High" | "Medium" | "Low")[], offset: number): ("High" | "Medium" | "Low")[] {
  if (types.length === 0) return types;
  const normalizedOffset = ((offset % types.length) + types.length) % types.length;
  return types.map((_, index) => types[(index - normalizedOffset + types.length) % types.length]);
}

function getFatLossPrinciples(kind: PlanResult["kind"]): string[] {
  if (kind === "carbCycling") return [
    "High-carb days carry the hardest strength work; low-carb days protect recovery.",
    "Keep 1–3 reps in reserve on most sets during aggressive cuts.",
    "Conditioning should support fat loss without stealing recovery from heavy sessions."
  ];
  return [
    "Train each major pattern at least twice weekly when possible.",
    "Use progressive overload, but do not chase personal records during hard deficits.",
    "Steps and low-intensity cardio are the default conditioning tools."
  ];
}
