import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import type { AppCopy, Language } from "../core/appCopy";
import type { CarbCyclingPlanResult } from "../core/types";
import {
  loadCarbRotationOffset,
  loadTrainingFocusByDay,
  saveCarbRotationOffset,
  saveTrainingFocusByDay,
  type FocusByDay,
  type TrainingFocusKey
} from "../storage/weeklyStructurePreferences";

type CarbType = "High" | "Medium" | "Low";

interface WeeklyStructureCardProps {
  result: CarbCyclingPlanResult;
  labels: AppCopy;
  language: Language;
}

interface WeeklyStructureRow {
  day: string;
  carbType: CarbType;
  focus: TrainingFocusKey;
}

const copy = {
  en: {
    adjust: "Adjust",
    date: "Date",
    carb: "Carb",
    training: "Training",
    done: "Done",
    reset: "Reset",
    helper: "Swipe carb column to rotate the cycle. Dates stay fixed.",
    high: "High",
    medium: "Medium",
    low: "Low",
    focus: {
      heavyLegs: "Legs / Lower",
      backDeadlift: "Back / Deadlift",
      upperBody: "Upper Body",
      push: "Push / Chest",
      pull: "Pull / Back",
      fullBody: "Full Body",
      strength: "Strength",
      accessoryCardio: "Accessory + Cardio",
      lightCardio: "Light Cardio",
      walkRecovery: "Walk / Recovery",
      rest: "Rest"
    }
  },
  zh: {
    adjust: "调整",
    date: "日期",
    carb: "碳水",
    training: "训练部位",
    done: "完成",
    reset: "重置",
    helper: "上下滑动碳水列来平移循环顺序，日期固定不变。",
    high: "高碳",
    medium: "中碳",
    low: "低碳",
    focus: {
      heavyLegs: "腿部 / 下肢",
      backDeadlift: "背部 / 硬拉",
      upperBody: "上肢",
      push: "胸 / 推",
      pull: "背 / 拉",
      fullBody: "全身",
      strength: "力量",
      accessoryCardio: "辅助 + 有氧",
      lightCardio: "轻有氧",
      walkRecovery: "步行 / 恢复",
      rest: "休息"
    }
  }
} as const;

const focusOptions: TrainingFocusKey[] = [
  "heavyLegs",
  "backDeadlift",
  "upperBody",
  "push",
  "pull",
  "fullBody",
  "strength",
  "accessoryCardio",
  "lightCardio",
  "walkRecovery",
  "rest"
];

export function WeeklyStructureCard({ result, labels, language }: WeeklyStructureCardProps) {
  const t = copy[language];
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [offset, setOffset] = useState(() => loadCarbRotationOffset());
  const [focusByDay, setFocusByDay] = useState<FocusByDay>(() => loadTrainingFocusByDay());
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  const rows = useMemo(() => buildRows(result, offset, focusByDay), [result, offset, focusByDay]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.toggle("weekly-adjust-open", adjustOpen);
    return () => document.body.classList.remove("weekly-adjust-open");
  }, [adjustOpen]);

  function rotateCycle(direction: number) {
    setOffset((current) => {
      const next = current + direction;
      saveCarbRotationOffset(next);
      return next;
    });
  }

  function handleCarbPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    swipeStartRef.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handleCarbPointerUp(event: PointerEvent<HTMLButtonElement>) {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start) return;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    const isVerticalSwipe = Math.abs(deltaY) >= 24 && Math.abs(deltaY) > Math.abs(deltaX) * 1.2;
    if (!isVerticalSwipe) return;

    rotateCycle(deltaY < 0 ? 1 : -1);
  }

  function handleFocusChange(day: string, focus: TrainingFocusKey) {
    setFocusByDay((current) => {
      const next = { ...current, [day]: focus };
      saveTrainingFocusByDay(next);
      return next;
    });
  }

  function handleReset() {
    saveCarbRotationOffset(0);
    saveTrainingFocusByDay({});
    setOffset(0);
    setFocusByDay({});
  }

  return (
    <>
      <section className="card weekly-structure-card dashboard-reveal reveal-3">
        <div className="weekly-structure-header">
          <div>
            <div className="card-title no-margin">{labels.weeklyStructure}</div>
            <p className="small-note no-margin">{t.helper}</p>
          </div>
          <button className="adjust-button" type="button" onClick={() => setAdjustOpen(true)}>{t.adjust}</button>
        </div>

        <div className="weekly-structure-grid" aria-label={labels.weeklyStructure}>
          <span>{t.date}</span>
          <span>{t.carb}</span>
          <span>{t.training}</span>
          {rows.map((row) => (
            <div className="weekly-structure-row" key={row.day}>
              <span className="weekly-date-cell">{row.day}</span>
              <span className={`weekly-carb-cell ${row.carbType.toLowerCase()}`}>{formatCarbType(row.carbType, language)}</span>
              <strong>{t.focus[row.focus]}</strong>
            </div>
          ))}
        </div>
      </section>

      {adjustOpen && (
        <div className="weekly-adjust-overlay" role="dialog" aria-modal="true" aria-label={labels.weeklyStructure}>
          <button className="weekly-adjust-backdrop" type="button" aria-label={t.done} onClick={() => setAdjustOpen(false)} />
          <section className="weekly-adjust-modal">
            <div className="weekly-adjust-modal-header">
              <div>
                <strong>{labels.weeklyStructure}</strong>
                <span>{t.helper}</span>
              </div>
              <button className="weekly-adjust-done" type="button" onClick={() => setAdjustOpen(false)}>{t.done}</button>
            </div>

            <div className="weekly-adjust-grid">
              <span>{t.date}</span>
              <span>{t.carb}</span>
              <span>{t.training}</span>
              {rows.map((row) => (
                <div className="weekly-adjust-row-fragment" key={row.day}>
                  <span className="weekly-date-cell">{row.day}</span>
                  <button
                    className={`weekly-carb-cell ${row.carbType.toLowerCase()}`}
                    type="button"
                    onPointerCancel={() => { swipeStartRef.current = null; }}
                    onPointerDown={handleCarbPointerDown}
                    onPointerLeave={() => { swipeStartRef.current = null; }}
                    onPointerUp={handleCarbPointerUp}
                  >
                    {formatCarbType(row.carbType, language)}
                  </button>
                  <select className="weekly-focus-select" value={row.focus} onChange={(event) => handleFocusChange(row.day, event.target.value as TrainingFocusKey)}>
                    {focusOptions.map((focus) => <option value={focus} key={focus}>{t.focus[focus]}</option>)}
                  </select>
                </div>
              ))}
            </div>

            <div className="weekly-adjust-tools">
              <button type="button" onClick={handleReset}>{t.reset}</button>
              <button type="button" onClick={() => rotateCycle(-1)}>{language === "zh" ? "下移循环" : "Shift down"}</button>
              <button type="button" onClick={() => rotateCycle(1)}>{language === "zh" ? "上移循环" : "Shift up"}</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function buildRows(result: CarbCyclingPlanResult, offset: number, focusByDay: FocusByDay): WeeklyStructureRow[] {
  const baseTypes = result.weeklySchedule.map((row) => row.type);
  const normalizedOffset = normalizeOffset(offset, baseTypes.length);

  return result.weeklySchedule.map((row, index) => ({
    day: row.day,
    carbType: baseTypes[(index - normalizedOffset + baseTypes.length) % baseTypes.length],
    focus: focusByDay[row.day] ?? inferFocus(row.note)
  }));
}

function normalizeOffset(offset: number, length: number): number {
  if (length <= 0) return 0;
  return ((offset % length) + length) % length;
}

function formatCarbType(type: CarbType, language: Language): string {
  if (language === "zh") {
    if (type === "High") return copy.zh.high;
    if (type === "Medium") return copy.zh.medium;
    return copy.zh.low;
  }

  if (type === "High") return copy.en.high;
  if (type === "Medium") return copy.en.medium;
  return copy.en.low;
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
