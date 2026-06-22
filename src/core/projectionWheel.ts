let installed = false;

export function installProjectionWheel(): void {
  if (installed || typeof document === "undefined") return;
  installed = true;

  const enhance = () => {
    document.querySelectorAll<HTMLElement>(".projection-table").forEach(setupWheel);
  };

  enhance();

  const observer = new MutationObserver(enhance);
  observer.observe(document.body, { childList: true, subtree: true });
}

function setupWheel(table: HTMLElement): void {
  if (table.dataset.wheelReady === "true") return;

  const rows = Array.from(table.querySelectorAll<HTMLElement>(".projection-row"));
  if (rows.length === 0) return;

  table.dataset.wheelReady = "true";
  table.classList.add("projection-wheel");
  table.setAttribute("role", "button");
  table.setAttribute("tabindex", "0");
  table.setAttribute("aria-label", "Roll 12-week projection");

  let startY = 0;
  let rolling = false;
  let activeIndex = prefersReducedMotion() ? rows.length - 1 : 0;

  setActiveRow(rows, activeIndex);

  const roll = () => {
    if (rolling) return;

    if (prefersReducedMotion()) {
      activeIndex = rows.length - 1;
      setActiveRow(rows, activeIndex);
      return;
    }

    rolling = true;
    table.classList.add("is-rolling");
    activeIndex = 0;
    setActiveRow(rows, activeIndex);

    const interval = window.setInterval(() => {
      activeIndex += 1;
      setActiveRow(rows, activeIndex);

      if (activeIndex >= rows.length - 1) {
        window.clearInterval(interval);
        window.setTimeout(() => {
          table.classList.remove("is-rolling");
          table.classList.add("roll-complete");
          rolling = false;
        }, 120);
      }
    }, 72);
  };

  table.addEventListener("pointerdown", (event) => {
    startY = event.clientY;
  });

  table.addEventListener("pointerup", (event) => {
    const deltaY = event.clientY - startY;
    if (deltaY < -18 || Math.abs(deltaY) < 6) {
      roll();
    }
  });

  table.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      roll();
    }
  });
}

function setActiveRow(rows: HTMLElement[], activeIndex: number): void {
  rows.forEach((row, index) => {
    const isActive = index === activeIndex;
    row.classList.toggle("is-active", isActive);
    row.setAttribute("aria-hidden", isActive ? "false" : "true");
  });
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
