import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  CUSTOM_WORKOUT_MUSCLE_TABS,
  fetchCustomExercisesByMuscle,
  getCachedCustomExercisesByMuscle,
  type CustomCatalogExercise
} from "../core/customWorkoutCatalog";
import { markImageCached, preloadImage, warmImageCache } from "../core/imageCache";
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

interface ActiveReorder {
  dayIndex: number;
  fromIndex: number;
  label: string;
  x: number;
  y: number;
  startX: number;
  startY: number;
  moved: boolean;
}

interface SelectedBuilderGif {
  title: string;
  gifUrl: string;
  previewUrl: string;
  sourceName: string;
}

interface LastPillTap {
  dayIndex: number;
  exerciseIndex: number;
  time: number;
}

const copy = {
  en: {
    title: "Custom Plan",
    subtitle: "Create your own professional weekly training plan",
    done: "Done",
    search: "Search exercises",
    sets: "sets",
    reps: "reps",
    duration: "duration",
    loading: "Loading exercises...",
    empty: "No exercises found",
    back: "Back",
    viewExercise: "View exercise animation",
    close: "Close"
  },
  zh: {
    title: "自定义计划",
    subtitle: "创建自己的专业周训练计划",
    done: "完成",
    search: "搜索训练动作",
    sets: "组",
    reps: "次",
    duration: "时长",
    loading: "正在加载动作...",
    empty: "没有找到动作",
    back: "返回",
    viewExercise: "查看动作动图",
    close: "关闭"
  }
} as const;

const setOptions = [1, 2, 3, 4, 5, 6];
const repOptions = ["5", "6–8", "8–10", "10–12", "12–15", "15–20", "AMRAP"];
const durationOptions = [10, 15, 20, 30, 45, 60];
const firstMuscle = CUSTOM_WORKOUT_MUSCLE_TABS[0].muscle;
const doubleTapDelayMs = 320;
const pillPageSize = 8;

export function CustomWorkoutBuilderOverlay({ initialPlan, language, onBack, onSave }: CustomWorkoutBuilderOverlayProps) {
  const t = copy[language];
  const activeDayCardRef = useRef<HTMLButtonElement | null>(null);
  const exerciseListRef = useRef<HTMLDivElement | null>(null);
  const activeDragRef = useRef<ActiveDrag | null>(null);
  const activeReorderRef = useRef<ActiveReorder | null>(null);
  const lastPillTapRef = useRef<LastPillTap | null>(null);
  const [draft, setDraft] = useState<CustomWorkoutPlanData>(() => initialPlan ?? createEmptyCustomWorkoutPlan());
  const [activeDayIndex, setActiveDayIndex] = useState<number | null>(null);
  const [activeMuscle, setActiveMuscle] = useState(firstMuscle);
  const [query, setQuery] = useState("");
  const [sets, setSets] = useState(3);
  const [reps, setReps] = useState("8–10");
  const [duration, setDuration] = useState(20);
  const [catalog, setCatalog] = useState<Record<string, CustomCatalogExercise[]>>(() => {
    const cached = getCachedCustomExercisesByMuscle(firstMuscle);
    return cached ? { [firstMuscle]: cached } : {};
  });
  const [loadingMuscle, setLoadingMuscle] = useState<string | null>(null);
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);
  const [activeReorder, setActiveReorder] = useState<ActiveReorder | null>(null);
  const [selectedGif, setSelectedGif] = useState<SelectedBuilderGif | null>(null);

  const activeDay = activeDayIndex === null ? null : draft.days[activeDayIndex];

  useEffect(() => {
    activeDragRef.current = activeDrag;
  }, [activeDrag]);

  useEffect(() => {
    activeReorderRef.current = activeReorder;
  }, [activeReorder]);

  useEffect(() => {
    if (catalog[activeMuscle]) return;

    const cached = getCachedCustomExercisesByMuscle(activeMuscle);
    if (cached) {
      setCatalog((current) => ({ ...current, [activeMuscle]: cached }));
      setLoadingMuscle(null);
      return;
    }

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
  }, [Boolean(activeDrag), activeDayIndex, sets, reps, duration]);

  useEffect(() => {
    if (!activeReorder) return;

    function handlePointerMove(event: PointerEvent) {
      event.preventDefault();
      setActiveReorder((current) => {
        if (!current) return null;
        const moved = current.moved || Math.hypot(event.clientX - current.startX, event.clientY - current.startY) > 5;
        return { ...current, x: event.clientX, y: event.clientY, moved };
      });
    }

    function handlePointerUp(event: PointerEvent) {
      event.preventDefault();
      const current = activeReorderRef.current;
      if (current?.moved) {
        const target = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-custom-exercise-index]") as HTMLElement | null;
        const toIndex = target ? Number(target.dataset.customExerciseIndex) : current.fromIndex;
        if (Number.isInteger(toIndex)) reorderExerciseInDay(current.dayIndex, current.fromIndex, toIndex);
      }

      setActiveReorder(null);
    }

    function handlePointerCancel() {
      setActiveReorder(null);
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerUp, { passive: false });
    window.addEventListener("pointercancel", handlePointerCancel);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
    };
  }, [Boolean(activeReorder)]);

  const exercises = useMemo(() => {
    const items = catalog[activeMuscle] ?? [];
    const search = query.trim().toLowerCase();
    if (!search) return items;
    return items.filter((exercise) => exercise.name.toLowerCase().includes(search));
  }, [activeMuscle, catalog, query]);

  useEffect(() => {
    warmImageCache(exercises.map((exercise) => exercise.thumbUrl ?? exercise.gifUrl), 24);
  }, [exercises]);

  useEffect(() => {
    warmImageCache(exercises.map((exercise) => exercise.gifUrl), 8);
  }, [exercises]);

  useEffect(() => {
    const list = exerciseListRef.current;
    if (!list) return;

    window.requestAnimationFrame(() => {
      list.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
  }, [activeMuscle]);

  function addExerciseToDay(dayIndex: number, exercise: CustomCatalogExercise) {
    const exerciseKey = getCatalogExerciseKey(exercise);
    const nextExercise: CustomWorkoutExercise = {
      sourceId: exercise.id,
      name: exercise.name,
      prescription: isCardioExercise(exercise) ? `${duration} min` : `${sets} × ${reps}`,
      gifUrl: exercise.gifUrl,
      thumbUrl: exercise.thumbUrl,
      sourceName: exercise.name,
      muscle: exercise.muscle
    };

    setDraft((current) => ({
      ...current,
      days: current.days.map((day, index) => {
        if (index !== dayIndex) return day;
        if (day.exercises.some((item) => getStoredExerciseKey(item) === exerciseKey)) return day;
        return { ...day, exercises: [...day.exercises, nextExercise] };
      })
    }));
  }

  function removeExerciseFromDay(dayIndex: number, exerciseIndex: number) {
    if (activeDayIndex === null) return;
    setDraft((current) => ({
      ...current,
      days: current.days.map((day, index) => index === dayIndex ? { ...day, exercises: day.exercises.filter((_, itemIndex) => itemIndex !== exerciseIndex) } : day)
    }));
  }

  function reorderExerciseInDay(dayIndex: number, fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    setDraft((current) => ({
      ...current,
      days: current.days.map((day, index) => {
        if (index !== dayIndex) return day;
        const nextExercises = [...day.exercises];
        const [moved] = nextExercises.splice(fromIndex, 1);
        if (!moved) return day;
        nextExercises.splice(Math.max(0, Math.min(toIndex, nextExercises.length)), 0, moved);
        return { ...day, exercises: nextExercises };
      })
    }));
  }

  function startDrag(event: ReactPointerEvent<HTMLDivElement>, exercise: CustomCatalogExercise) {
    event.preventDefault();
    setActiveDrag({ exercise, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false });
  }

  function startReorder(event: ReactPointerEvent<HTMLElement>, dayIndex: number, fromIndex: number, label: string) {
    if (activeDayIndex === null) return;
    const now = window.performance.now();
    const lastTap = lastPillTapRef.current;
    const isDoubleTap = Boolean(lastTap && lastTap.dayIndex === dayIndex && lastTap.exerciseIndex === fromIndex && now - lastTap.time <= doubleTapDelayMs);

    event.preventDefault();
    event.stopPropagation();

    if (isDoubleTap) {
      lastPillTapRef.current = null;
      setActiveReorder(null);
      removeExerciseFromDay(dayIndex, fromIndex);
      return;
    }

    lastPillTapRef.current = { dayIndex, exerciseIndex: fromIndex, time: now };
    setActiveDrag(null);
    setActiveReorder({ dayIndex, fromIndex, label, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false });
  }

  function openGif(exercise: CustomCatalogExercise) {
    void preloadImage(exercise.gifUrl);
    setSelectedGif({ title: exercise.name, gifUrl: exercise.gifUrl, previewUrl: exercise.thumbUrl ?? exercise.gifUrl, sourceName: exercise.name });
  }

  function handleBack() {
    if (activeDayIndex !== null) {
      setActiveDayIndex(null);
      setActiveDrag(null);
      setActiveReorder(null);
      setSelectedGif(null);
      return;
    }

    onBack();
  }

  function renderExercisePill(day: string, dayIndex: number, exercise: CustomWorkoutExercise, exerciseIndex: number) {
    return (
      <span
        className={activeDayIndex !== null ? "removable sortable" : ""}
        data-custom-exercise-index={exerciseIndex}
        key={`${day}-${exercise.name}-${exerciseIndex}`}
      >
        {activeDayIndex !== null && <b onPointerDown={(event) => startReorder(event, dayIndex, exerciseIndex, exercise.name)}>{exerciseIndex + 1}</b>}
        {exercise.name}
      </span>
    );
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
                  {activeDayIndex !== null
                    ? chunkItems(day.exercises, pillPageSize).map((page, pageIndex) => (
                        <div className="custom-builder-pill-page" key={`${day.day}-page-${pageIndex}`}>
                          {page.map((exercise, pageExerciseIndex) => renderExercisePill(day.day, dayIndex, exercise, pageIndex * pillPageSize + pageExerciseIndex))}
                        </div>
                      ))
                    : day.exercises.map((exercise, exerciseIndex) => renderExercisePill(day.day, dayIndex, exercise, exerciseIndex))}
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

            <div className="custom-builder-exercise-list" ref={exerciseListRef}>
              {loadingMuscle === activeMuscle && <div className="custom-builder-empty">{t.loading}</div>}
              {loadingMuscle !== activeMuscle && exercises.length === 0 && <div className="custom-builder-empty">{t.empty}</div>}
              {loadingMuscle !== activeMuscle && exercises.slice(0, 80).map((exercise) => {
                const previewUrl = exercise.thumbUrl ?? exercise.gifUrl;
                const cardio = isCardioExercise(exercise);
                return (
                  <div className="custom-exercise-result exercise-row has-gif" key={exercise.id}>
                    <div className="exercise-copy custom-exercise-drag-zone" onDoubleClick={() => addExerciseToDay(activeDayIndex, exercise)} onPointerDown={(event) => startDrag(event, exercise)}>
                      <strong>{exercise.name}</strong>
                      <div className="custom-prescription-capsules" onPointerDown={(event) => event.stopPropagation()}>
                        {cardio ? (
                          <label>
                            <span>{t.duration}</span>
                            <select onChange={(event) => setDuration(Number(event.target.value))} value={duration}>
                              {durationOptions.map((option) => <option key={option} value={option}>{option} min</option>)}
                            </select>
                          </label>
                        ) : (
                          <>
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
                          </>
                        )}
                      </div>
                    </div>
                    <button
                      aria-label={`${t.viewExercise}: ${exercise.name}`}
                      className="exercise-gif-button custom-exercise-gif"
                      onClick={() => openGif(exercise)}
                      onMouseEnter={() => void preloadImage(exercise.gifUrl)}
                      type="button"
                    >
                      <img alt="" loading="lazy" onLoad={() => markImageCached(previewUrl)} src={previewUrl} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {activeDrag && activeDrag.moved && <div className="custom-exercise-floating" style={{ transform: `translate3d(${activeDrag.x}px, ${activeDrag.y}px, 0)` }}>{activeDrag.exercise.name}</div>}
      {activeReorder && activeReorder.moved && <div className="custom-exercise-floating" style={{ transform: `translate3d(${activeReorder.x}px, ${activeReorder.y}px, 0)` }}>{activeReorder.label}</div>}
      {selectedGif && <CustomBuilderGifOverlay gif={selectedGif} labels={t} onClose={() => setSelectedGif(null)} />}
    </div>
  );
}

function CustomBuilderGifOverlay({ gif, labels, onClose }: { gif: SelectedBuilderGif; labels: typeof copy.en | typeof copy.zh; onClose: () => void }) {
  const [gifReady, setGifReady] = useState(false);

  useEffect(() => {
    setGifReady(false);
    let cancelled = false;
    preloadImage(gif.gifUrl).then(() => {
      if (!cancelled) setGifReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [gif.gifUrl]);

  return (
    <div className="custom-builder-gif-overlay" role="dialog" aria-modal="true" aria-label={gif.title}>
      <button className="custom-builder-gif-backdrop" type="button" aria-label={labels.close} onClick={onClose} />
      <section className="custom-builder-gif-modal">
        <div className="workout-gif-frame">
          <img
            className={gifReady ? "is-ready" : "is-preview"}
            src={gifReady ? gif.gifUrl : gif.previewUrl}
            alt={gif.sourceName}
            onLoad={() => markImageCached(gifReady ? gif.gifUrl : gif.previewUrl)}
          />
        </div>
        <div className="workout-gif-caption">
          <strong>{gif.title}</strong>
        </div>
      </section>
    </div>
  );
}

function getCatalogExerciseKey(exercise: CustomCatalogExercise): string {
  return exercise.id || `${exercise.muscle}:${exercise.name}`;
}

function getStoredExerciseKey(exercise: CustomWorkoutExercise): string {
  return exercise.sourceId || `${exercise.muscle}:${exercise.sourceName || exercise.name}`;
}

function isCardioExercise(exercise: CustomCatalogExercise): boolean {
  return exercise.muscle === "cardio" || exercise.category === "cardio";
}

function isInsideElement(x: number, y: number, element: HTMLElement | null): boolean {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function chunkItems<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}
