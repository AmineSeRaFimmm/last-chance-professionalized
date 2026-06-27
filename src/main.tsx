import React from "react";
import ReactDOM from "react-dom/client";
import Root from "./Root";
import { installNumericInputGuard } from "./core/numericInputGuard";
import { installProjectionWheel } from "./core/projectionWheel";
import { startStartupGifPreload } from "./core/startupGifPreloader";
import "./styles/global.css";
import "./styles/progress.css";
import "./styles/navigation.css";
import "./styles/custom-workout.css";
import "./styles/projection.css";
import "./styles/diet.css";
import "./styles/diet-selector.css";
import "./styles/timeline.css";
import "./styles/weekly-structure.css";
import "./styles/motion.css";
import "./styles/plan-home.css";
import "./styles/plan-setup-polish.css";
import "./styles/plan-picker.css";
import "./styles/plan-stage-dashboard.css";
import "./styles/professional-ui.css";
import "./core/interactionMotion";

installNumericInputGuard();
installProjectionWheel();
startStartupGifPreload();

const rootElement = document.getElementById("root");

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <Root />
    </React.StrictMode>
  );
}
