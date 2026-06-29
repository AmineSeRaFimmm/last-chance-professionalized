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
  const [activeFocusDay, setActiveFocusDay] = useState<string | null>(null);
  const [savedPulse, setSavedPulse] = useState(false);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  const rows = useMemo(() => buildRows(result, offset, focusByDay), [result, offset, focusByDay]);
  const carbSummary = useMemo(() => buildCarbSummary(rows, language), [rows, language]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.toggle("weekly-adjust-open", adjustOpen);
    return () => document.body.classList.remove("weekly-adjust-open");
  }, [adjustOpen]);

  useEffect(() => {
    if (!savedPulse) return;
    const timer = window.setTimeout(() => setSavedPulse(false), 900);
    return () => window.clearTimeout(timer);
  }, [savedPulse]);

  function rotateCycle(direction: number) {
    setOffset((current) => {
      const next = current + direction;
      saveCarbRotationOffset(next);
      return next;
    });
    setSavedPulse(true);
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
    setActiveFocusDay(null);
    setSavedPulse(true);
  }

  function handleReset() {
    saveCarbRotationOffset(0);
    saveTrainingFocusByDay({});
    setOffset(0);
    setFocusByDay({});
    setActiveFocusDay(null);
    setSavedPulse(true);
  }

  return (
    <>
      <section className="card weekly-structure-card dashboard-reveal reveal-3">
        <div className="weekly-structure-header">
          <div>
            <div className="card-title no-margin">{labels.weeklyStructure}</div>
            <strong>{carbSummary}</strong>
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
        <p className="weekly-structure-note">{language === "zh" ? "高碳日更适合安排高强度训练。" : "High carb days are best paired with heavier training."}</p>
      </section>

      {adjustOpen && (
        <div className="weekly-adjust-overlay" role="dialog" aria-modal="true" aria-label={labels.weeklyStructure}>
          <button className="weekly-adjust-backdrop" type="button" aria-label={t.done} onClick={() => { setActiveFocusDay(null); setAdjustOpen(false); }} />
          <section className="weekly-adjust-modal">
            <div className="weekly-adjust-modal-header">
              <div>
                <strong>{labels.weeklyStructure}</strong>
                <span>{savedPulse ? (language === "zh" ? "已保存" : "Saved") : t.helper}</span>
              </div>
              <button className="weekly-adjust-done" type="button" onClick={() => { setActiveFocusDay(null); setAdjustOpen(false); }}>{t.done}</button>
            </div>

            <div className="weekly-shift-control" aria-label={language === "zh" ? "调整碳水循环" : "Adjust carb cycle"}>
              <button type="button" onClick={() => rotateCycle(-1)}>{language === "zh" ? "后移" : "Later"}</button>
              <span>{carbSummary}</span>
              <button type="button" onClick={() => rotateCycle(1)}>{language === "zh" ? "前移" : "Earlier"}</button>
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
                  <button className="weekly-focus-button" type="button" onClick={() => setActiveFocusDay((current) => current === row.day ? null : row.day)}>
                    <span>{t.focus[row.focus]}</span>
                  </button>
                </div>
              ))}
            </div>

            <div className="weekly-adjust-tools">
              <button type="button" onClick={handleReset}>{t.reset}</button>
              <button type="button" onClick={() => rotateCycle(-1)}>{language === "zh" ? "下移循环" : "Shift down"}</button>
              <button type="button" onClick={() => rotateCycle(1)}>{language === "zh" ? "上移循环" : "Shift up"}</button>
            </div>

            {activeFocusDay && (
              <div className="weekly-focus-panel" role="dialog" aria-label={language === "zh" ? "选择训练部位" : "Choose training focus"}>
                <button className="weekly-focus-panel-backdrop" type="button" aria-label={t.done} onClick={() => setActiveFocusDay(null)} />
                <div className="weekly-focus-panel-card">
                  <div>
                    <span>{activeFocusDay}</span>
                    <strong>{language === "zh" ? "训练重点" : "Training focus"}</strong>
                  </div>
                  <div className="weekly-focus-options">
                    {focusOptions.map((focus) => (
                      <button
                        className={rows.find((row) => row.day === activeFocusDay)?.focus === focus ? "active" : ""}
                        type="button"
                        onClick={() => handleFocusChange(activeFocusDay, focus)}
                        key={focus}
                      >
                        {t.focus[focus]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}

function buildCarbSummary(rows: WeeklyStructureRow[], language: Language): string {
  const counts = rows.reduce<Record<CarbType, number>>(
    (summary, row) => ({ ...summary, [row.carbType]: summary[row.carbType] + 1 }),
    { High: 0, Medium: 0, Low: 0 }
  );
  const high = language === "zh" ? "高" : "High";
  const medium = language === "zh" ? "中" : "Medium";
  const low = language === "zh" ? "低" : "Low";
  return `${counts.High} ${high} · ${counts.Medium} ${medium} · ${counts.Low} ${low}`;
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
