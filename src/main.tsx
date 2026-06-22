import React from "react";
import ReactDOM from "react-dom/client";
import Root from "./Root";
import { installNumericInputGuard } from "./core/numericInputGuard";
import { installProjectionWheel } from "./core/projectionWheel";
import "./styles/global.css";
import "./styles/progress.css";
import "./styles/navigation.css";
import "./styles/projection.css";

installNumericInputGuard();
installProjectionWheel();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
