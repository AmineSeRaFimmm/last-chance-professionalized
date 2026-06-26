let planSetupScrollResetInstalled = false;
let lastObservedSetupStage: string | null = null;
let pendingResetFrame = 0;

export function installPlanSetupScrollReset(): void {
  if (typeof window === "undefined" || typeof document === "undefined" || planSetupScrollResetInstalled) return;

  planSetupScrollResetInstalled = true;

  function getCurrentSetupStage(): string | null {
    const form = document.querySelector<HTMLElement>(".plan-sheet-form");
    if (!form) return null;

    return Array.from(form.classList).find((className) => className.startsWith("stage-")) ?? null;
  }

  function resetSetupScroll(): void {
    if (pendingResetFrame) window.cancelAnimationFrame(pendingResetFrame);

    pendingResetFrame = window.requestAnimationFrame(() => {
      pendingResetFrame = window.requestAnimationFrame(() => {
        pendingResetFrame = 0;
        const setupBody = document.querySelector<HTMLElement>(".plan-sheet-body");
        const setupModal = document.querySelector<HTMLElement>(".plan-sheet-modal");

        setupBody?.scrollTo({ top: 0, left: 0, behavior: "auto" });
        setupModal?.scrollTo({ top: 0, left: 0, behavior: "auto" });

        if (setupBody) {
          setupBody.scrollTop = 0;
          setupBody.scrollLeft = 0;
        }

        if (setupModal) {
          setupModal.scrollTop = 0;
          setupModal.scrollLeft = 0;
        }
      });
    });
  }

  function syncSetupStage(): void {
    const nextStage = getCurrentSetupStage();
    if (!nextStage || nextStage === lastObservedSetupStage) return;

    lastObservedSetupStage = nextStage;
    resetSetupScroll();
  }

  const observer = new MutationObserver(syncSetupStage);
  observer.observe(document.body, { attributes: true, attributeFilter: ["class"], childList: true, subtree: true });
  syncSetupStage();

  window.addEventListener(
    "pagehide",
    () => {
      observer.disconnect();
      if (pendingResetFrame) window.cancelAnimationFrame(pendingResetFrame);
      pendingResetFrame = 0;
      planSetupScrollResetInstalled = false;
      lastObservedSetupStage = null;
    },
    { once: true }
  );
}
