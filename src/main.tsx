import React from "react";
import ReactDOM from "react-dom/client";
import Root from "./Root";
import "./core/interactionMotion";
import { installNumericInputGuard } from "./core/numericInputGuard";
import { installProjectionWheel } from "./core/projectionWheel";
import { startStartupGifPreload } from "./core/startupGifPreloader";
import "./styles/global.css";
import "./styles/progress.css";
import "./styles/navigation.css";
import "./styles/custom-workout.css";
import "./styles/projection.css";
import "./styles/diet.css";
import "./styles/timeline.css";
import "./styles/weekly-structure.css";
import "./styles/motion.css";

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
