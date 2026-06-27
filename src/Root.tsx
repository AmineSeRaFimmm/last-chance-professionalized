import { useEffect, useState } from "react";
import { Dumbbell, Target, Utensils, UserRound } from "lucide-react";
import App from "./App";
import { DietPlanner } from "./components/DietPlanner";
import { ProfilePage } from "./components/ProfilePage";
import { WorkoutPlanner } from "./components/WorkoutPlanner";

type View = "plan" | "diet" | "workout" | "profile";

const copy = {
  en: { plan: "Plan", diet: "Diet", workout: "Workout", profile: "Profile" },
  zh: { plan: "计划", diet: "饮食", workout: "训练", profile: "主页" }
} as const;

const navItems = [
  { view: "plan", icon: Target },
  { view: "diet", icon: Utensils },
  { view: "workout", icon: Dumbbell },
  { view: "profile", icon: UserRound }
] as const;

export default function Root() {
  const [view, setView] = useState<View>("plan");
  const language = getLanguage();
  const t = copy[language];

  useEffect(() => {
    resetScrollTop();
  }, [view]);

  return (
    <>
      {view === "plan" && <App />}
      {view === "diet" && <DietPlanner />}
      {view === "workout" && <WorkoutPlanner />}
      {view === "profile" && <ProfilePage />}

      <nav className="bottom-nav-shell" aria-label="Primary navigation">
        <div className="bottom-nav">
          {navItems.map(({ view: itemView, icon: Icon }) => (
            <button className={view === itemView ? "active" : ""} onClick={() => setView(itemView)} type="button" key={itemView}>
              <span className="bottom-nav-icon" aria-hidden="true"><Icon size={18} strokeWidth={2.25} /></span>
              {t[itemView]}
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}

function resetScrollTop(): void {
  if (typeof window === "undefined") return;

  window.requestAnimationFrame(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.scrollingElement?.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
  });
}

function getLanguage(): "en" | "zh" {
  if (typeof window === "undefined") return "en";
  return window.localStorage.getItem("last_chance_language") === "zh" ? "zh" : "en";
}
