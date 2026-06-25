const EXIT_DURATION_MS = 220;
const OVERLAY_SELECTOR = ".workout-gif-overlay, .workout-selector-overlay, .custom-workout-builder-overlay, .custom-builder-gif-overlay, .meal-composer-overlay";
const CLOSE_TRIGGER_SELECTOR = [
  ".workout-gif-backdrop",
  ".custom-builder-gif-backdrop",
  ".workout-selector-backdrop",
  ".workout-selector-head button",
  ".workout-selector-modal .program-option:not(.custom-plan-option)",
  ".custom-builder-back",
  ".custom-builder-done",
  ".meal-composer-backdrop",
  ".meal-composer-actions .primary-button:not(:disabled)"
].join(", ");

let started = false;
let lastGifOrigin: DOMRect | null = null;
let scrollLockSnapshot: { overflow: string; touchAction: string; overscrollBehavior: string } | null = null;

startInteractionMotion();

function startInteractionMotion(): void {
  if (started || typeof window === "undefined" || typeof document === "undefined") return;
  started = true;

  document.addEventListener("pointerdown", rememberGifOrigin, true);
  document.addEventListener("click", interceptCloseClick, true);

  const observer = new MutationObserver(() => {
    enhanceMotionLayers();
    updateScrollLock();
  });

  observer.observe(document.body, { childList: true, subtree: true });
  window.requestAnimationFrame(enhanceMotionLayers);
}

function rememberGifOrigin(event: Event): void {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const button = target.closest(".exercise-gif-button");
  if (button instanceof HTMLElement) lastGifOrigin = button.getBoundingClientRect();
}

function interceptCloseClick(event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const trigger = target.closest(CLOSE_TRIGGER_SELECTOR);
  if (!(trigger instanceof HTMLElement)) return;
  if (trigger.dataset.motionReplay === "true") return;

  const overlay = trigger.closest(OVERLAY_SELECTOR);
  if (!(overlay instanceof HTMLElement)) return;
  if (overlay.dataset.motionState === "exit") return;

  if (trigger.matches(".custom-builder-back") && overlay.querySelector(".custom-workout-builder-modal.is-editing")) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  setLayerState(overlay, "exit");

  window.setTimeout(() => {
    trigger.dataset.motionReplay = "true";
    trigger.click();
    window.setTimeout(() => delete trigger.dataset.motionReplay, 0);
  }, EXIT_DURATION_MS);
}

function enhanceMotionLayers(): void {
  document.querySelectorAll(OVERLAY_SELECTOR).forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    if (node.dataset.motionEnhanced === "true") return;

    node.dataset.motionEnhanced = "true";
    setLayerState(node, "enter");

    if (node.classList.contains("workout-selector-overlay")) {
      node.classList.add("motion-layer", "motion-sheet");
      addMotionClass(node, ".workout-selector-backdrop", "motion-backdrop");
      addMotionClass(node, ".workout-selector-modal", "motion-surface");
    } else if (node.classList.contains("workout-gif-overlay") || node.classList.contains("custom-builder-gif-overlay")) {
      node.classList.add("motion-layer", "motion-center");
      addMotionClass(node, ".workout-gif-backdrop, .custom-builder-gif-backdrop", "motion-backdrop");
      const modal = node.querySelector(".workout-gif-modal, .custom-builder-gif-modal");
      if (modal instanceof HTMLElement) {
        modal.classList.add("motion-surface");
        applyGifFlip(modal);
      }
    } else if (node.classList.contains("custom-workout-builder-overlay")) {
      node.classList.add("motion-fullscreen-sheet");
    } else if (node.classList.contains("meal-composer-overlay")) {
      node.classList.add("motion-layer", "motion-immersive");
      addMotionClass(node, ".meal-composer-backdrop", "motion-backdrop");
    }

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setLayerState(node, "open"));
    });
  });
}

function addMotionClass(root: HTMLElement, selector: string, className: string): void {
  const element = root.querySelector(selector);
  if (element instanceof HTMLElement) element.classList.add(className);
}

function applyGifFlip(modal: HTMLElement): void {
  if (!lastGifOrigin) {
    modal.dataset.flipOrigin = "false";
    return;
  }

  const modalRect = modal.getBoundingClientRect();
  const originCenterX = lastGifOrigin.left + lastGifOrigin.width / 2;
  const originCenterY = lastGifOrigin.top + lastGifOrigin.height / 2;
  const modalCenterX = modalRect.left + modalRect.width / 2;
  const modalCenterY = modalRect.top + modalRect.height / 2;

  modal.style.setProperty("--flip-x", `${originCenterX - modalCenterX}px`);
  modal.style.setProperty("--flip-y", `${originCenterY - modalCenterY}px`);
  modal.style.setProperty("--flip-scale-x", `${Math.max(0.08, lastGifOrigin.width / Math.max(1, modalRect.width))}`);
  modal.style.setProperty("--flip-scale-y", `${Math.max(0.08, lastGifOrigin.height / Math.max(1, modalRect.height))}`);
  modal.dataset.flipOrigin = "true";
}

function setLayerState(layer: HTMLElement, state: "enter" | "open" | "exit"): void {
  layer.dataset.motionState = state;
  layer.querySelectorAll(".motion-surface").forEach((surface) => {
    if (surface instanceof HTMLElement) surface.dataset.motionState = state;
  });
}

function updateScrollLock(): void {
  const hasOverlay = Boolean(document.querySelector(OVERLAY_SELECTOR));

  if (hasOverlay && !scrollLockSnapshot) {
    scrollLockSnapshot = {
      overflow: document.body.style.overflow,
      touchAction: document.body.style.touchAction,
      overscrollBehavior: document.documentElement.style.overscrollBehavior
    };
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    document.documentElement.style.overscrollBehavior = "none";
    return;
  }

  if (!hasOverlay && scrollLockSnapshot) {
    document.body.style.overflow = scrollLockSnapshot.overflow;
    document.body.style.touchAction = scrollLockSnapshot.touchAction;
    document.documentElement.style.overscrollBehavior = scrollLockSnapshot.overscrollBehavior;
    scrollLockSnapshot = null;
  }
}

export {};
