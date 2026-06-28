import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { CustomWorkoutBuilderOverlay } from "./CustomWorkoutBuilderOverlay";
import { buildSafeCarbCyclingPlan as buildCarbCyclingPlan } from "../core/carbCyclingSafePlan";
import { getExerciseGifMatch, getExerciseGifUrl, getExerciseThumbUrl } from "../core/exerciseGifMap";
import { markImageCached, preloadImage, warmImageCache } from "../core/imageCache";
import { buildStandardPlan } from "../core/standardPlan";
import type { PlanResult, UserInput } from "../core/types";
import {
  buildWorkoutPlan,
  WORKOUT_PROGRAM_OPTIONS,
  type WorkoutDay,
  type WorkoutExercise,
  type WorkoutProgramCategory,
  type WorkoutProgramId,
  type WorkoutProgramOption
} from "../core/workoutPlan";
import { loadInput } from "../storage/localPlan";
import {
  clearCustomWorkoutPlan,
  customWorkoutToWorkoutPlan,
  loadCustomWorkoutPlan,
  saveCustomWorkoutPlan,
  type CustomWorkoutPlanData
} from "../storage/customWorkoutPlan";
import {
  loadCarbRotationOffset,
  loadTrainingFocusByDay
} from "../storage/weeklyStructurePreferences";

type Language = "en" | "zh";

interface SelectedWorkoutGif {
  title: string;
  prescription: string;
  sourceName: string;
  gifUrl: string;
  thumbUrl: string;
}

interface WorkoutExerciseMedia {
  gifUrl?: string;
  thumbUrl?: string;
  sourceName: string;
}

const PROGRAM_KEY = "last_chance_workout_program";

const zhText: Record<string, string> = {
  "Default fat-loss program matched to saved nutrition and weekly structure.": "根据保存的饮食方案和一周结构自动匹配的默认减脂训练。",
  "Default workout week aligned to your carb cycling structure.": "默认训练周会对齐你的碳水循环结构。",
  "Default fat-loss workout week matched to your training frequency.": "默认训练周会匹配你的训练频率和减脂目标。",
  "Training stress is matched to high, medium, and low carb days from your saved weekly structure.": "训练压力会根据你保存的一周结构匹配高碳日、中碳日和低碳日。",
  "Four main-lift days with conservative assistance and recovery-first conditioning.": "四个主项训练日，辅助量保守，体能训练优先服从恢复。",
  "Volume / recovery / intensity structure, compressed for calorie deficit recovery.": "保留容量 / 恢复 / 强度结构，但针对热量缺口压缩训练压力。",
  "Three full-body barbell sessions built around squat, press, bench, deadlift, and rows.": "三个全身杠铃训练日，围绕深蹲、推举、卧推、硬拉和划船。",
  "Hypertrophy-oriented split with cut-adjusted volume and non-failure execution.": "偏增肌的分化训练，但训练量按减脂期恢复能力下调，避免力竭。",
  "Balanced four-day split with clear recovery days and repeatable progression.": "均衡四日分化，恢复日清晰，便于稳定进步。",
  "Three full-body sessions emphasizing large patterns and moderate joint stress.": "三个全身训练日，强调大动作模式和适中的关节压力。",
  "Stable machine-based plan that reduces technical complexity and injury risk.": "以稳定器械为主，降低技术复杂度和受伤风险。",
  "Four sessions using machines and cables with controlled fatigue.": "四个器械 / 绳索训练日，疲劳更可控。",
  "Strength primer plus short conditioning blocks, avoiding excessive cut fatigue.": "力量启动训练加短体能模块，避免减脂期疲劳过度。",
  "Simple mixed-modal training with skill practice, strength, and controlled finishers.": "简化混合训练，包含技术练习、力量和可控收尾体能。",
  "Low-friction strength plan for muscle retention, steps, and recovery.": "低门槛力量计划，重点是保肌肉、步数和恢复。",
  "Dumbbells, bands, bodyweight, walking, and simple progressive overload.": "哑铃、弹力带、自重、步行和简单渐进超负荷。",
  "Most users who want the app to control recovery and adherence.": "大多数希望由 App 控制恢复和执行难度的用户。",
  "Intermediate lifters who want strength retention during a cut.": "减脂期想保留力量的中级训练者。",
  "Experienced barbell trainees who tolerate heavy weekly loading.": "能承受较高周负荷的有经验杠铃训练者。",
  "Novice lifters who can still progress linearly.": "仍能线性进步的新手力量训练者。",
  "Gym users training 4–6 days per week.": "每周训练 4–6 天的健身房用户。",
  "Most fat-loss users with 3–4 lifting days.": "多数每周 3–4 次力量训练的减脂用户。",
  "Busy users or beginners who need high consistency.": "时间紧或需要稳定执行的新手用户。",
  "Beginners, hotel gyms, or users who prefer guided equipment.": "新手、酒店健身房用户，或偏好固定器械的人。",
  "Gym users cutting hard but wanting predictable execution.": "减脂较激进但希望动作执行稳定的健身房用户。",
  "Conditioning-focused users with solid movement skill.": "动作基础扎实、偏体能训练的用户。",
  "Users who want CrossFit-style variety without advanced Olympic lifting.": "想要 CrossFit 风格变化，但不需要高级奥举动作的用户。",
  "General fat-loss users who do not need sport specialization.": "不需要专项竞技化训练的普通减脂用户。",
  "Home training or travel weeks.": "居家训练或旅行周。",
  "High-carb days carry the hardest strength work; low-carb days protect recovery.": "高碳日承接最重的力量训练；低碳日优先保护恢复。",
  "Keep 1–3 reps in reserve on most sets during aggressive cuts.": "减脂较激进时，大多数训练组保留 1–3 次余力。",
  "Conditioning should support fat loss without stealing recovery from heavy sessions.": "体能训练应服务减脂，但不能抢走重训练日的恢复资源。",
  "Train each major pattern at least twice weekly when possible.": "条件允许时，每个主要动作模式每周至少训练两次。",
  "Use progressive overload, but do not chase personal records during hard deficits.": "使用渐进超负荷，但热量缺口较大时不要追求 PR。",
  "Steps and low-intensity cardio are the default conditioning tools.": "步数和低强度有氧是默认体能工具。",
  "Push performance on the heaviest work while avoiding failure reps.": "在最重训练中提高表现，但避免力竭次数。",
  "Accumulate quality work with moderate fatigue.": "累积高质量训练量，同时控制疲劳。",
  "Protect recovery and maintain movement quality.": "保护恢复，保持动作质量。",
  "Recover, maintain steps, and lower fatigue.": "恢复、保持步数，并降低疲劳。",
  "Preserve lean mass and strength while cutting.": "减脂期保留瘦体重和力量。",
  "Optional 8–10 min easy cooldown only.": "只建议 8–10 分钟轻松冷身，可选。",
  "10–20 min incline walk or bike after lifting if recovery is good.": "恢复良好时，力量后可做 10–20 分钟坡走或单车。",
  "MetCon stays short enough that technique does not degrade.": "MetCon 保持足够短，避免技术动作变形。",
  "Zone 2 only.": "仅做 Zone 2。",
  "Prioritize steps, sleep, hydration, and no failure training.": "优先保证步数、睡眠、补水，不做力竭训练。",
  "Progress load only when bar speed and form stay consistent.": "只有杠速和动作质量稳定时才增加重量。",
  "Carb cycling alignment stays active.": "仍会跟随你的碳水循环结构进行训练日匹配。",
  "Default plan follows your saved fat-loss setup.": "默认训练会跟随你保存的减脂设置。",
  "User-defined workout week saved from the custom builder.": "通过自定义编辑器保存的一周训练计划。",
  "Users who want full control over exercise selection.": "希望完全控制动作选择的用户。",
  "User-defined weekly workout plan.": "用户自定义一周训练计划。",
  "User-defined session": "用户自定义训练日",
  "Add exercises in Custom Plan.": "在自定义计划中添加动作。",
  "keep 2–3 reps in reserve": "保留 2–3 次余力",
  "stop 1–2 reps before failure": "距离力竭保留 1–2 次",
  "use training max, no grinders during a cut": "使用 training max，减脂期不要硬磨极限次数",
  "reduce load 5–10% if recovery drops": "恢复下降时重量降低 5–10%",
  "alternate each session": "每次训练交替安排",
  "deadlift volume stays low during a cut": "减脂期硬拉训练量保持偏低",
  "simple gymnastics, carries, or technique": "简单体操、负重行走或技术练习",
  "submaximal, crisp reps": "次最大强度，动作干净利落",
  "avoid redline failure during aggressive cuts": "激进减脂期避免冲到崩溃强度",
  "easy nasal-breathing pace": "轻松到能鼻呼吸的强度",
  "hips, T-spine, ankles, shoulders": "髋、胸椎、踝、肩"
};

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
    intensity: "Intensity",
    conditioning: "Conditioning",
    recovery: "Recovery",
    bestFor: "Best for",
    chooseSystem: "Choose training system",
    close: "Close",
    viewExercise: "View exercise animation",
    customPlan: "Custom Plan",
    customPlanDescription: "Create your own professional weekly training plan",
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
    intensity: "强度",
    conditioning: "体能",
    recovery: "恢复",
    bestFor: "适合",
    chooseSystem: "选择训练体系",
    close: "关闭",
    viewExercise: "查看动作动图",
    customPlan: "自定义计划",
    customPlanDescription: "创建自己的专业周训练计划",
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
  const [customBuilderOpen, setCustomBuilderOpen] = useState(false);
  const [customPlan, setCustomPlan] = useState<CustomWorkoutPlanData | null>(loadCustomWorkoutPlan);
  const [selectedGif, setSelectedGif] = useState<SelectedWorkoutGif | null>(null);
  const [programId, setProgramId] = useState<WorkoutProgramId>(loadProgramId);
  const [activeWorkoutCardIndex, setActiveWorkoutCardIndex] = useState(getTodayWorkoutCardIndex);
  const workoutStackRef = useRef<HTMLDivElement | null>(null);
  const activeWorkoutCardRef = useRef<HTMLDivElement | null>(null);
  const didAlignInitialWorkoutCardRef = useRef(false);
  const workoutSwipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const result = useMemo(() => (savedInput ? buildResult(savedInput) : null), [savedInput]);
  const plan = useMemo(() => {
    if (customPlan) return customWorkoutToWorkoutPlan(customPlan);
    return savedInput && result
      ? buildWorkoutPlan({
          input: savedInput,
          result,
          programId,
          rotationOffset: loadCarbRotationOffset(),
          focusByDay: loadTrainingFocusByDay()
        })
      : null;
  }, [customPlan, programId, savedInput, result]);

  useEffect(() => {
    if (!plan) return;
    warmImageCache(plan.days.flatMap((day) => day.exercises.map((exercise) => getWorkoutExerciseMedia(exercise).thumbUrl)), 24);
  }, [plan]);

  useEffect(() => {
    if (!plan) return;
    const stack = workoutStackRef.current;
    const activeCard = activeWorkoutCardRef.current;
    if (!stack || !activeCard) return;

    window.requestAnimationFrame(() => {
      const paddingLeft = parseFloat(window.getComputedStyle(stack).paddingLeft) || 0;
      const behavior: ScrollBehavior = didAlignInitialWorkoutCardRef.current ? "smooth" : "auto";
      stack.scrollTo({ left: activeCard.offsetLeft - stack.offsetLeft - paddingLeft, behavior });
      didAlignInitialWorkoutCardRef.current = true;
    });
  }, [activeWorkoutCardIndex, plan]);

  function chooseProgram(nextProgramId: WorkoutProgramId) {
    clearCustomWorkoutPlan();
    setCustomPlan(null);
    setProgramId(nextProgramId);
    window.localStorage.setItem(PROGRAM_KEY, nextProgramId);
    setSelectorOpen(false);
  }

  function saveCustomPlan(nextPlan: CustomWorkoutPlanData) {
    const savedPlan = saveCustomWorkoutPlan(nextPlan);
    setCustomPlan(savedPlan);
    setCustomBuilderOpen(false);
    setSelectorOpen(false);
  }

  function moveActiveWorkoutCard(offset: number) {
    if (!plan) return;
    setActiveWorkoutCardIndex((index) => normalizeCarouselIndex(index + offset, plan.days.length + 1));
  }

  function handleWorkoutCarouselPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    workoutSwipeStartRef.current = { x: event.clientX, y: event.clientY };
  }

  function handleWorkoutCarouselPointerCancel() {
    workoutSwipeStartRef.current = null;
  }

  function handleWorkoutCarouselPointerUp(event: PointerEvent<HTMLDivElement>) {
    const start = workoutSwipeStartRef.current;
    workoutSwipeStartRef.current = null;
    if (!start || !plan) return;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    const isHorizontalSwipe = Math.abs(deltaX) > 44 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2;
    if (!isHorizontalSwipe) return;

    moveActiveWorkoutCard(deltaX < 0 ? 1 : -1);
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
        <p className="hero-subtitle">{tr(plan.subtitle, language)}</p>
      </section>

      <div
        className="workout-week-stack workout-carousel-stack"
        onPointerCancel={handleWorkoutCarouselPointerCancel}
        onPointerDown={handleWorkoutCarouselPointerDown}
        onPointerLeave={handleWorkoutCarouselPointerCancel}
        onPointerUp={handleWorkoutCarouselPointerUp}
        ref={workoutStackRef}
      >
        <div className="workout-carousel-card workout-info-carousel-card" ref={activeWorkoutCardIndex === 0 ? activeWorkoutCardRef : undefined}>
          <WorkoutInfoCard labels={t} language={language} plan={plan} />
        </div>
        {plan.days.map((day, index) => (
          <div className="workout-carousel-card" ref={activeWorkoutCardIndex === index + 1 ? activeWorkoutCardRef : undefined} key={day.day}>
            <WorkoutDayCard day={day} labels={t} language={language} onOpenGif={setSelectedGif} hideIntentIntensity={Boolean(customPlan)} />
          </div>
        ))}
      </div>

      {selectorOpen && (
        <div className="workout-selector-overlay" role="dialog" aria-modal="true" aria-label={t.chooseSystem}>
          <button className="workout-selector-backdrop" type="button" aria-label={t.done} onClick={() => setSelectorOpen(false)} />
          <section className="workout-selector-modal">
            <div className="workout-selector-head">
              <div>
                <strong>{t.chooseSystem}</strong>
                <span>{tr(result.kind === "carbCycling" ? "Carb cycling alignment stays active." : "Default plan follows your saved fat-loss setup.", language)}</span>
              </div>
              <button type="button" onClick={() => setSelectorOpen(false)}>{t.done}</button>
            </div>

            {groupPrograms().map(([category, options]) => (
              <div className="program-category" key={category}>
                <div className="program-category-title">{t.categories[category]}</div>
                {options.map((option) => (
                  <button className={`program-option ${!customPlan && programId === option.id ? "active" : ""}`} type="button" onClick={() => chooseProgram(option.id)} key={option.id}>
                    <strong>{option.name}</strong>
                    <span>{tr(option.description, language)}</span>
                  </button>
                ))}
              </div>
            ))}
            <div className="program-category">
              <div className="program-category-title">{t.customPlan}</div>
              <button className={`program-option custom-plan-option ${customPlan ? "active" : ""}`} type="button" onClick={() => setCustomBuilderOpen(true)}>
                <strong>{t.customPlan}</strong>
                <span>{t.customPlanDescription}</span>
              </button>
            </div>
          </section>
        </div>
      )}

      {customBuilderOpen && <CustomWorkoutBuilderOverlay initialPlan={customPlan} language={language} onBack={() => setCustomBuilderOpen(false)} onSave={saveCustomPlan} />}
      {selectedGif && <WorkoutGifOverlay gif={selectedGif} labels={t} onClose={() => setSelectedGif(null)} />}
    </main>
  );
}

function WorkoutInfoCard({ labels, language, plan }: { labels: typeof copy.en | typeof copy.zh; language: Language; plan: ReturnType<typeof buildWorkoutPlan> }) {
  return (
    <section className="card workout-info-card">
      <div className="workout-info-section workout-program-card">
        <div>
          <div className="card-title">{plan.title}</div>
          <p className="small-note no-margin">{tr(plan.program.description, language)}</p>
        </div>
        <div className="program-best-for">
          <span>{labels.bestFor}</span>
          <strong>{tr(plan.program.bestFor, language)}</strong>
        </div>
      </div>

      <div className="workout-info-section">
        <div className="card-title">{labels.principles}</div>
        <div className="principle-stack">
          {plan.principles.map((principle) => <div className="principle-line" key={principle}>{tr(principle, language)}</div>)}
        </div>
      </div>
    </section>
  );
}

function WorkoutDayCard({ day, labels, language, onOpenGif, hideIntentIntensity }: { day: WorkoutDay; labels: typeof copy.en | typeof copy.zh; language: Language; onOpenGif: (gif: SelectedWorkoutGif) => void; hideIntentIntensity: boolean }) {
  return (
    <section className="card workout-day-card">
      <div className="workout-day-head">
        <div><div className="card-title no-margin">{day.day}</div><strong>{day.title}</strong></div>
        <div className="workout-day-badges">
          {day.carbType && <span className={`day-type ${day.carbType.toLowerCase()}`}>{day.carbType}</span>}
          <span>{day.duration}</span>
        </div>
      </div>

      {!hideIntentIntensity && (
        <div className="workout-intent-grid">
          <div><span>{labels.intent}</span>{" "}<strong>{tr(day.intent, language)}</strong></div>
          <div><span>{labels.intensity}</span>{" "}<strong>{day.intensity}</strong></div>
        </div>
      )}

      <div className="exercise-stack">
        {day.exercises.map((exercise) => (
          <WorkoutExerciseRow exercise={exercise} labels={labels} language={language} onOpenGif={onOpenGif} key={`${day.day}-${exercise.name}`} />
        ))}
      </div>

      {(day.conditioning || day.recovery) && (
        <div className="workout-note-grid">
          {day.conditioning && <div><span>{labels.conditioning}</span>{" "}<strong>{tr(day.conditioning, language)}</strong></div>}
          {day.recovery && <div><span>{labels.recovery}</span>{" "}<strong>{tr(day.recovery, language)}</strong></div>}
        </div>
      )}
    </section>
  );
}

function WorkoutExerciseRow({ exercise, labels, language, onOpenGif }: { exercise: WorkoutExercise; labels: typeof copy.en | typeof copy.zh; language: Language; onOpenGif: (gif: SelectedWorkoutGif) => void }) {
  const { gifUrl, thumbUrl, sourceName } = getWorkoutExerciseMedia(exercise);

  return (
    <div className={`exercise-row ${gifUrl ? "has-gif" : ""}`}>
      <div className="exercise-copy">
        <strong>{exercise.name}</strong>
        <span className="exercise-prescription">{exercise.prescription}</span>
        {exercise.note && <em>{tr(exercise.note, language)}</em>}
      </div>
      {gifUrl && thumbUrl && (
        <button
          className="exercise-gif-button"
          type="button"
          aria-label={`${labels.viewExercise}: ${exercise.name}`}
          onClick={() => {
            void preloadImage(gifUrl);
            onOpenGif({ title: exercise.name, prescription: exercise.prescription, sourceName, gifUrl, thumbUrl });
          }}
          onMouseEnter={() => void preloadImage(gifUrl)}
        >
          <img
            src={thumbUrl}
            alt=""
            loading="lazy"
            onLoad={() => markImageCached(thumbUrl)}
            onError={(event) => {
              event.currentTarget.parentElement?.classList.add("is-hidden");
            }}
          />
        </button>
      )}
    </div>
  );
}

function WorkoutGifOverlay({ gif, labels, onClose }: { gif: SelectedWorkoutGif; labels: typeof copy.en | typeof copy.zh; onClose: () => void }) {
  useEffect(() => {
    void preloadImage(gif.gifUrl);
  }, [gif.gifUrl]);

  return (
    <div className="workout-gif-overlay" role="dialog" aria-modal="true" aria-label={gif.title}>
      <button className="workout-gif-backdrop" type="button" aria-label={labels.close} onClick={onClose} />
      <section className="workout-gif-modal">
        <div className="workout-gif-frame">
          <img src={gif.gifUrl} alt={gif.sourceName} onLoad={() => markImageCached(gif.gifUrl)} />
        </div>
        <div className="workout-gif-caption">
          <strong>{gif.title}</strong>
          <span>{gif.prescription}</span>
        </div>
      </section>
    </div>
  );
}

function getWorkoutExerciseMedia(exercise: WorkoutExercise): WorkoutExerciseMedia {
  const customGif = exercise as WorkoutExercise & { gifUrl?: string; thumbUrl?: string; sourceName?: string };
  const match = getExerciseGifMatch(exercise.name);
  const asset = match.asset;
  const gifUrl = customGif.gifUrl ?? (asset ? getExerciseGifUrl(asset) : undefined);
  const thumbUrl = customGif.thumbUrl ?? (asset ? getExerciseThumbUrl(asset) : undefined) ?? gifUrl;
  const sourceName = customGif.sourceName ?? asset?.sourceName ?? exercise.name;

  return { gifUrl, thumbUrl, sourceName };
}

function tr(value: string, language: Language): string {
  if (language !== "zh") return value;
  if (value.startsWith("Built around ")) return value.replace("Built around", "围绕").replace("training days, progressive overload, steps, and recovery.", "个训练日、渐进超负荷、步数和恢复生成。");
  return zhText[value] ?? value;
}

function buildResult(input: UserInput): PlanResult {
  if (input.sex === "male" && input.planType === "carbCycling") return buildCarbCyclingPlan(input);
  return buildStandardPlan(input);
}

function loadProgramId(): WorkoutProgramId {
  const stored = window.localStorage.getItem(PROGRAM_KEY);
  if (!stored) return "auto";
  return WORKOUT_PROGRAM_OPTIONS.some((option) => option.id === stored) ? (stored as WorkoutProgramId) : "auto";
}

function groupPrograms(): [WorkoutProgramCategory, WorkoutProgramOption[]][] {
  const categories: WorkoutProgramCategory[] = ["default", "powerlifting", "bodybuilding", "machine", "crossfit", "generalStrength", "home"];
  return categories.map((category) => [category, WORKOUT_PROGRAM_OPTIONS.filter((option) => option.category === category)]);
}

function normalizeCarouselIndex(index: number, length: number): number {
  return ((index % length) + length) % length;
}

function getTodayWorkoutCardIndex(): number {
  if (typeof Date === "undefined") return 1;
  const day = new Date().getDay();
  return (day === 0 ? 6 : day - 1) + 1;
}

function loadLanguage(): Language {
  if (typeof window === "undefined") return "en";
  return window.localStorage.getItem("last_chance_language") === "zh" ? "zh" : "en";
}
