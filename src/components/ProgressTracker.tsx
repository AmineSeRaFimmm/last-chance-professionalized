import { useMemo, useState } from "react";
import {
  calculateProgressSummary,
  type ProgressStatus,
  type WeightLogEntry
} from "../core/progress";
import {
  deleteWeightLogEntry,
  loadWeightLog,
  upsertWeightLogEntry
} from "../storage/weightLog";

type Language = "en" | "zh";

interface ProgressTrackerProps {
  language: Language;
  plannedDailyCalories: number;
  expectedWeeklyLossKg: number;
  defaultWeightKg: number;
}

const copy = {
  en: {
    title: "Progress tracker",
    note:
      "Log body weight consistently. After at least 7 days, Last Chance estimates trend loss and actual TDEE from your data.",
    date: "Date",
    weight: "Weight kg",
    add: "Add / update entry",
    delete: "Delete",
    latestAverage: "Latest average",
    trend: "Trend loss",
    actualTdee: "Actual TDEE",
    entries: "Entries",
    insufficient: "Need at least two entries across 7+ days for trend analysis.",
    onTrack: "On track. Keep the plan unchanged for now.",
    slow: "Loss is slower than target. First verify tracking accuracy, then consider -5% weekly calories or +2,000 steps/day.",
    fast: "Loss is faster than target. If strength, sleep, or mood drop, add calories back to training days.",
    gain: "Weight is trending up. Check weekend calories, oils, sauces, snacks, alcohol, and high-carb day execution.",
    recentEntries: "Recent entries",
    targetCalories: "Target calories",
    expectedLoss: "Expected loss"
  },
  zh: {
    title: "进度跟踪",
    note: "持续记录体重。满 7 天后，Last Chance 会根据你的数据估算趋势减重和真实 TDEE。",
    date: "日期",
    weight: "体重 kg",
    add: "添加 / 更新记录",
    delete: "删除",
    latestAverage: "最新平均",
    trend: "趋势减重",
    actualTdee: "反推 TDEE",
    entries: "记录数",
    insufficient: "至少需要跨越 7 天的两条记录，才能做趋势分析。",
    onTrack: "进度正常。暂时不需要调整方案。",
    slow: "下降慢于目标。先检查记录准确性，再考虑周热量 -5% 或每天多走 2000 步。",
    fast: "下降快于目标。如果力量、睡眠或情绪下降，应把热量加回训练日。",
    gain: "体重趋势上升。检查周末热量、油、酱料、零食、酒精和高碳日执行。",
    recentEntries: "最近记录",
    targetCalories: "目标热量",
    expectedLoss: "预计下降"
  }
} as const;

export function ProgressTracker({
  language,
  plannedDailyCalories,
  expectedWeeklyLossKg,
  defaultWeightKg
}: ProgressTrackerProps) {
  const t = copy[language];
  const [entries, setEntries] = useState<WeightLogEntry[]>(() => loadWeightLog());
  const [date, setDate] = useState(todayIso());
  const [weightKg, setWeightKg] = useState(Number(defaultWeightKg.toFixed(1)));

  const summary = useMemo(
    () => calculateProgressSummary(entries, plannedDailyCalories, expectedWeeklyLossKg),
    [entries, plannedDailyCalories, expectedWeeklyLossKg]
  );

  const recentEntries = useMemo(() => entries.slice(-5).reverse(), [entries]);

  function handleAddEntry() {
    if (!date || !Number.isFinite(weightKg) || weightKg <= 0) return;

    const nextEntries = upsertWeightLogEntry(entries, {
      date,
      weightKg
    });

    setEntries(nextEntries);
  }

  function handleDelete(dateToDelete: string) {
    setEntries(deleteWeightLogEntry(entries, dateToDelete));
  }

  return (
    <section className="card progress-card">
      <div className="profile-section-head">
        <div>
          <div className="card-title">{t.title}</div>
          <p className="small-note no-margin">{t.note}</p>
        </div>
      </div>

      <div className="progress-plan-strip">
        <ProgressPlanMetric label={t.targetCalories} value={`${plannedDailyCalories} kcal`} />
        <ProgressPlanMetric label={t.expectedLoss} value={`${expectedWeeklyLossKg} kg/wk`} />
      </div>

      <div className="progress-entry-grid">
        <ProgressDatePicker label={t.date} language={language} value={date} onChange={setDate} />
        <div className="field">
          <label>{t.weight}</label>
          <input
            type="number"
            min={35}
            max={250}
            step={0.1}
            value={weightKg}
            onChange={(event) => setWeightKg(Number(event.target.value))}
          />
        </div>
      </div>

      <div className="progress-actions">
        <button className="primary-button no-margin" type="button" onClick={handleAddEntry}>
          {t.add}
        </button>
      </div>

      <div className="progress-grid">
        <ProgressMetric
          label={t.latestAverage}
          value={summary.latestAverageKg ? `${summary.latestAverageKg.toFixed(1)} kg` : "—"}
        />
        <ProgressMetric
          label={t.trend}
          value={
            summary.actualLossPerWeekKg !== undefined
              ? `${summary.actualLossPerWeekKg.toFixed(2)} kg/wk`
              : "—"
          }
        />
        <ProgressMetric
          label={t.actualTdee}
          value={summary.actualTdee ? `${Math.round(summary.actualTdee)} kcal` : "—"}
        />
        <ProgressMetric label={t.entries} value={String(summary.entryCount)} />
      </div>

      <div className={`progress-verdict ${summary.status}`}>
        {getStatusMessage(summary.status, t)}
      </div>

      {recentEntries.length > 0 && (
        <div className="recent-log">
          <div className="recent-log-title">{t.recentEntries}</div>
          {recentEntries.map((entry) => (
            <div className="log-row" key={entry.date}>
              <span>{entry.date}</span>
              <strong>{entry.weightKg.toFixed(1)} kg</strong>
              <button type="button" onClick={() => handleDelete(entry.date)}>
                {t.delete}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ProgressDatePicker({
  label,
  language,
  value,
  onChange
}: {
  label: string;
  language: Language;
  value: string;
  onChange: (date: string) => void;
}) {
  const formatted = formatDateDisplay(value, language);

  return (
    <label className="progress-date-field">
      <span>{label}</span>
      <span className="progress-date-picker">
        <strong>{formatted.primary}</strong>
        <em>{formatted.secondary}</em>
        <input type="date" value={value} onChange={(event) => onChange(event.target.value)} />
      </span>
    </label>
  );
}

function ProgressPlanMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="progress-plan-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ProgressMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="progress-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getStatusMessage(status: ProgressStatus, labels: typeof copy.en | typeof copy.zh): string {
  if (status === "onTrack") return labels.onTrack;
  if (status === "slow") return labels.slow;
  if (status === "fast") return labels.fast;
  if (status === "gain") return labels.gain;
  return labels.insufficient;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDateDisplay(value: string, language: Language): { primary: string; secondary: string } {
  const [year, month, day] = value.split("-").map(Number);
  const date = Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)
    ? new Date(year, month - 1, day)
    : new Date();
  const locale = language === "zh" ? "zh-CN" : "en-US";

  return {
    primary: date.toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric" }),
    secondary: String(date.getFullYear())
  };
}
