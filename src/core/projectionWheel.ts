let installed = false;

interface ProjectionItem {
  week: string;
  weight: string;
}

const PIXELS_PER_WEEK = 34;
const FLICK_VELOCITY = 0.65;
const AUTOPLAY_INTERVAL_MS = 1000;
const EXIT_CLASS_CLEAR_MS = 520;
const autoplayTimers = new WeakMap<HTMLElement, number>();

export function installProjectionWheel(): void {
  if (installed || typeof document === "undefined") return;
  installed = true;

  const enhance = () => {
    document.querySelectorAll<HTMLElement>(".projection-table").forEach(setupProjectionCard);
  };

  enhance();

  const observer = new MutationObserver(enhance);
  observer.observe(document.body, { childList: true, subtree: true });
}

function setupProjectionCard(table: HTMLElement): void {
  const rows = Array.from(table.querySelectorAll<HTMLElement>(".projection-row"));
  const items = readProjectionItems(table);
  if (items.length === 0) return;

  const signature = buildProjectionSignature(items);
  if (table.dataset.projectionSignature !== signature) {
    table.dataset.projectionSignature = signature;
    table.dataset.projectionActiveIndex = "0";
    setActiveRow(rows, 0);
    restartAutoplay(table);
  }

  table.classList.add("projection-wheel");
  table.setAttribute("role", "button");
  table.setAttribute("tabindex", "0");
  table.setAttribute("aria-label", "Open projection focus view");

  startAutoplay(table);

  if (table.dataset.focusReady === "true") return;

  table.dataset.focusReady = "true";
  table.addEventListener("click", () => {
    const currentItems = readProjectionItems(table);
    if (currentItems.length > 0) openProjectionFocus(currentItems);
  });
  table.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const currentItems = readProjectionItems(table);
      if (currentItems.length > 0) openProjectionFocus(currentItems);
    }
  });
}

function startAutoplay(table: HTMLElement): void {
  if (prefersReducedMotion()) return;
  if (autoplayTimers.has(table)) return;

  const timer = window.setInterval(() => {
    if (!document.body.contains(table)) {
      restartAutoplay(table);
      return;
    }

    const rows = Array.from(table.querySelectorAll<HTMLElement>(".projection-row"));
    if (rows.length <= 1) return;

    const currentIndex = clamp(Number(table.dataset.projectionActiveIndex ?? 0), 0, rows.length - 1);
    const nextIndex = (currentIndex + 1) % rows.length;
    setActiveRow(rows, nextIndex, currentIndex);
    table.dataset.projectionActiveIndex = String(nextIndex);
  }, AUTOPLAY_INTERVAL_MS);

  autoplayTimers.set(table, timer);
}

function restartAutoplay(table: HTMLElement): void {
  const timer = autoplayTimers.get(table);
  if (timer !== undefined) {
    window.clearInterval(timer);
    autoplayTimers.delete(table);
  }
}

function openProjectionFocus(items: ProjectionItem[]): void {
  const previousOverlay = document.querySelector(".projection-focus-overlay");
  if (previousOverlay) previousOverlay.remove();

  let activeIndex = 0;
  let startIndex = 0;
  let startY = 0;
  let lastY = 0;
  let startTime = 0;
  let dragging = false;
  const reducedMotion = prefersReducedMotion();

  const overlay = document.createElement("div");
  overlay.className = "projection-focus-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Projection focus view");

  const backdrop = document.createElement("button");
  backdrop.className = "projection-focus-backdrop";
  backdrop.type = "button";
  backdrop.setAttribute("aria-label", "Close projection");

  const card = document.createElement("div");
  card.className = "projection-focus-card";
  card.tabIndex = 0;

  const week = document.createElement("div");
  week.className = "projection-focus-week";

  const weight = document.createElement("div");
  weight.className = "projection-focus-weight";

  card.append(week, weight);
  overlay.append(backdrop, card);
  document.body.appendChild(overlay);
  document.body.classList.add("projection-focus-open");

  const render = (direction: "up" | "down" | "none" = "none", animate = true) => {
    const item = items[activeIndex];
    week.textContent = item.week;
    weight.textContent = item.weight;
    card.dataset.direction = direction;

    if (!reducedMotion && animate) {
      card.classList.remove("projection-focus-animate");
      void card.offsetWidth;
      card.classList.add("projection-focus-animate");
    }
  };

  const close = () => {
    document.body.classList.remove("projection-focus-open");
    overlay.classList.add("is-closing");
    window.setTimeout(() => overlay.remove(), reducedMotion ? 0 : 160);
    document.removeEventListener("keydown", handleKeydown);
  };

  const setIndex = (nextIndex: number, animate = true) => {
    const clampedIndex = clamp(nextIndex, 0, items.length - 1);
    if (clampedIndex === activeIndex) return;

    const direction = clampedIndex > activeIndex ? "up" : "down";
    activeIndex = clampedIndex;
    render(direction, animate);
  };

  const move = (delta: number) => {
    setIndex(activeIndex + delta);
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") close();
    if (event.key === "ArrowUp") move(1);
    if (event.key === "ArrowDown") move(-1);
  };

  backdrop.addEventListener("click", close);
  card.addEventListener("pointerdown", (event) => {
    dragging = true;
    startY = event.clientY;
    lastY = event.clientY;
    startIndex = activeIndex;
    startTime = performance.now();
    card.classList.add("is-dragging");
    card.setPointerCapture(event.pointerId);
  });

  card.addEventListener("pointermove", (event) => {
    if (!dragging) return;

    lastY = event.clientY;
    const offset = Math.trunc((startY - event.clientY) / PIXELS_PER_WEEK);
    setIndex(startIndex + offset, false);
  });

  card.addEventListener("pointerup", (event) => {
    if (!dragging) return;

    dragging = false;
    card.classList.remove("is-dragging");
    card.releasePointerCapture(event.pointerId);

    const elapsed = Math.max(1, performance.now() - startTime);
    const deltaY = startY - lastY;
    const velocity = deltaY / elapsed;
    const baseOffset = Math.round(deltaY / PIXELS_PER_WEEK);
    const momentum = Math.abs(velocity) > FLICK_VELOCITY ? Math.sign(velocity) * 2 : 0;
    const finalOffset = baseOffset + momentum;

    if (finalOffset !== 0) {
      setIndex(startIndex + finalOffset, true);
    }
  });

  card.addEventListener("pointercancel", () => {
    dragging = false;
    card.classList.remove("is-dragging");
  });

  card.addEventListener("wheel", (event) => {
    event.preventDefault();
    const wheelDelta = Math.max(-3, Math.min(3, Math.round(event.deltaY / 36)));
    if (wheelDelta !== 0) move(wheelDelta);
  }, { passive: false });
  document.addEventListener("keydown", handleKeydown);

  render("none");
  window.setTimeout(() => card.focus(), 0);
}

function readProjectionItems(table: HTMLElement): ProjectionItem[] {
  return Array.from(table.querySelectorAll<HTMLElement>(".projection-row"))
    .map(readProjectionItem)
    .filter(Boolean) as ProjectionItem[];
}

function readProjectionItem(row: HTMLElement): ProjectionItem | null {
  const week = row.querySelector("span")?.textContent?.trim();
  const weight = row.querySelector("strong")?.textContent?.trim();

  if (!week || !weight) return null;
  return { week, weight };
}

function buildProjectionSignature(items: ProjectionItem[]): string {
  return items.map((item) => `${item.week}:${item.weight}`).join("|");
}

function setActiveRow(rows: HTMLElement[], activeIndex: number, previousIndex?: number): void {
  rows.forEach((row, index) => {
    row.classList.remove("is-entering", "is-exiting");

    const isActive = index === activeIndex;
    const isPrevious = previousIndex !== undefined && index === previousIndex && index !== activeIndex;

    row.classList.toggle("is-active", isActive);
    row.classList.toggle("is-exiting", isPrevious);
    row.setAttribute("aria-hidden", isActive ? "false" : "true");

    if (isActive && previousIndex !== undefined) row.classList.add("is-entering");
    if (isPrevious) window.setTimeout(() => row.classList.remove("is-exiting"), EXIT_CLASS_CLEAR_MS);
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
