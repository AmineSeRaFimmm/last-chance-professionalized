import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  CUSTOM_WORKOUT_MUSCLE_TABS,
  fetchCustomExercisesByMuscle,
  type CustomCatalogExercise
} from "../core/customWorkoutCatalog";
import {
  createEmptyCustomWorkoutPlan,
  type CustomWorkoutExercise,
  type CustomWorkoutPlanData
} from "../storage/customWorkoutPlan";

type Language = "en" | "zh";

interface CustomWorkoutBuilderOverlayProps {
  initialPlan: CustomWorkoutPlanData | null;
  language: Language;
  onBack: () => void;
  onSave: (plan: CustomWorkoutPlanData) => void;
}

interface ActiveDrag {
  exercise: CustomCatalogExercise;
  x: number;
  y: number;
  startX: number;
  startY: number;
  moved: boolean;
}

interface SelectedBuilderGif {
  title: string;
  gifUrl: string;
  sourceName: string;
}

const copy = {
  en: {
    title: "Custom Plan",
    subtitle: "Build a weekly plan from ExerciseGymGifsDB movements.",
    done: "Done",
    search: "Search exercises",
    sets: "sets",
    reps: "reps",
    loading: "Loading exercises...",
    empty: "No exercises found",
    back: "Back",
    viewExercise: "View exercise animation",
    close: "Close"
  },
  zh: {
    title: "自定义计划",
    subtitle: "从 ExerciseGymGifsDB 动作库创建一周训练。",
    done: "完成",
    search: "搜索训练动作",
    sets: "组",
    reps: "次",
    loading: "正在加载动作...",
    empty: "没有找到动作",
    back: "返回",
    viewExercise: "查看动作动图",
    close: "关闭"
  }
} as const;

const setOptions = [1, 2, 3, 4, 5, 6];
const repOptions = ["5", "6–8", "8–10", "10–12", "12–15", "15–20", "AMRAP"];

export function CustomWorkoutBuilderOverlay({ initialPlan, language, onBack, onSave }: CustomWorkoutBuilderOverlayProps) {
  const t = copy[language];
  const activeDayCardRef = useRef<HTMLButtonElement | null>(null);
  const activeDragRef = useRef<ActiveDrag | null>(null);
  const [draft, setDraft] = useState<CustomWorkoutPlanData>(() => initialPlan ?? createEmptyCustomWorkoutPlan());
  const [activeDayIndex, setActiveDayIndex] = useState<number | null>(null);
  const [activeMuscle, setActiveMuscle] = useState(CUSTOM_WORKOUT_MUSCLE_TABS[0].muscle);
  const [query, setQuery] = useState("");
  const [sets, setSets] = useState(3);
  const [reps, setReps] = useState("8–10");
  const [catalog, setCatalog] = useState<Record<string, CustomCatalogExercise[]>>({});
  const [loadingMuscle, setLoadingMuscle] = useState<string | null>(null);
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);
  const [selectedGif, setSelectedGif] = useState<SelectedBuilderGif | null>(null);

  const activeDay = activeDayIndex === null ? null : draft.days[activeDayIndex];

  useEffect(() => {
    activeDragRef.current = activeDrag;
  }, [activeDrag]);

  useEffect(() => {
    if (catalog[activeMuscle]) return;
    let cancelled = false;
    setLoadingMuscle(activeMuscle);
    fetchCustomExercisesByMuscle(activeMuscle)
      .then((exercises) => {
        if (cancelled) return;
        setCatalog((current) => ({ ...current, [activeMuscle]: exercises }));
      })
      .catch(() => {
        if (cancelled) return;
        setCatalog((current) => ({ ...current, [activeMuscle]: [] }));
      })
      .finally(() => {
        if (!cancelled) setLoadingMuscle(null);
      });

    return () => {
      cancelled = true;
    };
  }, [activeMuscle, catalog]);

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
      if (current && activeDayIndex !== null && isInsideElement(event.clientX, event.clientY, activeDayCardRef.current)) {
        addExerciseToDay(activeDayIndex, current.exercise);
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
  }, [Boolean(activeDrag), activeDayIndex, sets, reps]);

  const exercises = useMemo(() => {
    const items = catalog[activeMuscle] ?? [];
    const search = query.trim().toLowerCase();
    if (!search) return items;
    return items.filter((exercise) => exercise.name.toLowerCase().includes(search));
  }, [activeMuscle, catalog, query]);

  function addExerciseToDay(dayIndex: number, exercise: CustomCatalogExercise) {
    const nextExercise: CustomWorkoutExercise = {
      name: exercise.name,
      prescription: `${sets} × ${reps}`,
      gifUrl: exercise.gifUrl,
      thumbUrl: exercise.thumbUrl,
      sourceName: exercise.name,
      muscle: exercise.muscle
    };

    setDraft((current) => ({
      ...current,
      days: current.days.map((day, index) => index === dayIndex ? { ...day, exercises: [...day.exercises, nextExercise] } : day)
    }));
  }

  function removeExerciseFromDay(dayIndex: number, exerciseIndex: number) {
    if (activeDayIndex === null) return;
    setDraft((current) => ({
      ...current,
      days: current.days.map((day, index) => index === dayIndex ? { ...day, exercises: day.exercises.filter((_, itemIndex) => itemIndex !== exerciseIndex) } : day)
    }));
  }

  function startDrag(event: ReactPointerEvent<HTMLDivElement>, exercise: CustomCatalogExercise) {
    event.preventDefault();
    setActiveDrag({ exercise, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false });
  }

  function handleBack() {
    if (activeDayIndex !== null) {
      setActiveDayIndex(null);
      setActiveDrag(null);
      setSelectedGif(null);
      return;
    }

    onBack();
  }

  return (
    <div className="custom-workout-builder-overlay" role="dialog" aria-modal="true" aria-label={t.title}>
      <section className={`custom-workout-builder-modal ${activeDayIndex !== null ? "is-editing" : ""}`}>
        <div className={`custom-builder-head ${activeDayIndex !== null ? "is-editing" : ""}`}>
          <button aria-label={t.back} className="custom-builder-back" onClick={handleBack} type="button">←</button>
          <div>
            <strong>{t.title}</strong>
            <span>{t.subtitle}</span>
          </div>
          {activeDayIndex === null && <button className="custom-builder-done" onClick={() => onSave(draft)} type="button">{t.done}</button>}
        </div>

        <div className="custom-builder-week">
          {(activeDayIndex === null ? draft.days : activeDay ? [activeDay] : []).map((day) => {
            const dayIndex = draft.days.findIndex((item) => item.day === day.day);
            return (
              <button
                className={`custom-builder-day-card ${dayIndex === activeDayIndex ? "active" : ""}`}
                key={day.day}
                onClick={() => setActiveDayIndex(dayIndex)}
                ref={dayIndex === activeDayIndex ? activeDayCardRef : undefined}
                type="button"
              >
                <div className="custom-builder-day-head">
                  <strong>{day.day}</strong>
                  <span>{day.exercises.length} exercises</span>
                </div>
                <div className="custom-builder-day-pills">
                  {day.exercises.map((exercise, exerciseIndex) => (
                    <span
                      className={activeDayIndex !== null ? "removable" : ""}
                      key={`${day.day}-${exercise.name}-${exerciseIndex}`}
                      onClick={activeDayIndex !== null ? (event) => { event.stopPropagation(); removeExerciseFromDay(dayIndex, exerciseIndex); } : undefined}
                    >
                      {exercise.name}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        {activeDayIndex !== null && (
          <div className="custom-builder-exercise-panel">
            <input className="custom-builder-search" onChange={(event) => setQuery(event.target.value)} placeholder={t.search} value={query} />
            <div className="custom-builder-tabs">
              {CUSTOM_WORKOUT_MUSCLE_TABS.map((tab) => (
                <button className={tab.muscle === activeMuscle ? "active" : ""} key={tab.muscle} onClick={() => setActiveMuscle(tab.muscle)} type="button">{tab.label}</button>
              ))}
            </div>

            <div className="custom-builder-exercise-list">
              {loadingMuscle === activeMuscle && <div className="custom-builder-empty">{t.loading}</div>}
              {loadingMuscle !== activeMuscle && exercises.length === 0 && <div className="custom-builder-empty">{t.empty}</div>}
              {loadingMuscle !== activeMuscle && exercises.slice(0, 80).map((exercise) => (
                <div className="custom-exercise-result exercise-row has-gif" key={exercise.id}>
                  <div className="exercise-copy custom-exercise-drag-zone" onDoubleClick={() => addExerciseToDay(activeDayIndex, exercise)} onPointerDown={(event) => startDrag(event, exercise)}>
                    <strong>{exercise.name}</strong>
                    <div className="custom-prescription-capsules" onPointerDown={(event) => event.stopPropagation()}>
                      <label>
                        <span>{t.sets}</span>
                        <select onChange={(event) => setSets(Number(event.target.value))} value={sets}>
                          {setOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                      </label>
                      <label>
                        <span>{t.reps}</span>
                        <select onChange={(event) => setReps(event.target.value)} value={reps}>
                          {repOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                      </label>
                    </div>
                  </div>
                  <button
                    aria-label={`${t.viewExercise}: ${exercise.name}`}
                    className="exercise-gif-button custom-exercise-gif"
                    onClick={() => setSelectedGif({ title: exercise.name, gifUrl: exercise.gifUrl, sourceName: exercise.name })}
                    type="button"
                  >
                    <img alt="" loading="lazy" src={exercise.thumbUrl ?? exercise.gifUrl} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {activeDrag && activeDrag.moved && <div className="custom-exercise-floating" style={{ transform: `translate3d(${activeDrag.x}px, ${activeDrag.y}px, 0)` }}>{activeDrag.exercise.name}</div>}
      {selectedGif && <CustomBuilderGifOverlay gif={selectedGif} labels={t} onClose={() => setSelectedGif(null)} />}
    </div>
  );
}

function CustomBuilderGifOverlay({ gif, labels, onClose }: { gif: SelectedBuilderGif; labels: typeof copy.en | typeof copy.zh; onClose: () => void }) {
  return (
    <div className="custom-builder-gif-overlay" role="dialog" aria-modal="true" aria-label={gif.title}>
      <button className="custom-builder-gif-backdrop" type="button" aria-label={labels.close} onClick={onClose} />
      <section className="custom-builder-gif-modal">
        <div className="workout-gif-frame">
          <img src={gif.gifUrl} alt={gif.sourceName} />
        </div>
        <div className="workout-gif-caption">
          <strong>{gif.title}</strong>
        </div>
      </section>
    </div>
  );
}

function isInsideElement(x: number, y: number, element: HTMLElement | null): boolean {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}
