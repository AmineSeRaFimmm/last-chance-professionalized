const STORAGE_KEY = "last_chance_last_input";
const LANGUAGE_KEY = "last_chance_language";

type Stage = "intro" | "form";

const copy = {
  en: {
    result: "Result",
    status: "Status",
    startTitle: "Build your plan first",
    startText: "Set sex, plan type, and body data before showing personal results.",
    start: "Start setup",
    setup: "Plan setup",
    setupText: "Change the data, then save the plan locally.",
    body: "Body data",
    goal: "Goal weight",
    timeline: "Timeline",
    savedTitle: "Your plan is ready",
    savedText: "This is your saved local plan. Use Change data to update it.",
    saved: "Saved",
    change: "Change data",
    save: "Save plan",
    close: "Close"
  },
  zh: {
    result: "结果",
    status: "状态",
    startTitle: "先建立你的计划",
    startText: "先设置性别、方案和身体数据，再展示个人结果。",
    start: "开始设置",
    setup: "计划设置",
    setupText: "修改数据后，保存为本地计划。",
    body: "身体数据",
    goal: "目标体重",
    timeline: "完成周期",
    savedTitle: "计划已就绪",
    savedText: "这是你已保存的本地计划。需要更新时，点击 Change data。",
    saved: "已保存",
    change: "Change data",
    save: "保存计划",
    close: "关闭"
  }
} as const;

let booted = false;
let open = false;
let stage: Stage = "intro";

bootPlanSetupSheet();

function bootPlanSetupSheet(): void {
  if (booted || typeof window === "undefined" || typeof document === "undefined") return;
  booted = true;
  document.addEventListener("click", onClick, true);
  document.addEventListener("click", onClickAfterSave, false);
  const observer = new MutationObserver(sync);
  observer.observe(document.body, { childList: true, subtree: true });
  window.requestAnimationFrame(sync);
}

function onClick(event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof Element) || !target.closest(".app-shell")) return;

  if (target.closest("[data-plan-open]")) {
    event.preventDefault();
    openSheet(hasPlan() ? "form" : "intro");
    return;
  }

  if (target.closest("[data-plan-start]")) {
    event.preventDefault();
    openSheet("form");
    return;
  }

  if (target.closest("[data-plan-close]")) {
    event.preventDefault();
    if (hasPlan()) closeSheet();
  }
}

function onClickAfterSave(event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (!target.closest(".plan-sheet-footer .change-plan-button")) return;
  window.setTimeout(() => {
    if (hasPlan() && !document.querySelector(".timeline-risk-panel.blocked")) closeSheet();
    else sync();
  }, 0);
}

function openSheet(nextStage: Stage): void {
  open = true;
  stage = nextStage;
  sync();
}

function closeSheet(): void {
  open = false;
  stage = "form";
  sync();
}

function sync(): void {
  const shell = document.querySelector(".app-shell");
  if (!(shell instanceof HTMLElement)) return;

  markCards(shell);
  const stored = hasPlan();
  if (!stored && !open) open = true;

  shell.classList.toggle("plan-dashboard-ready", stored);
  shell.classList.toggle("plan-setup-open", open);

  syncHero(shell);
  syncDashboard(shell, stored);
  syncSheet(shell, stored);
}

function syncHero(shell: HTMLElement): void {
  const labels = labelsNow();
  const top = shell.querySelector(".hero-topline");
  if (!(top instanceof HTMLElement)) return;

  const original = originalSave(shell);
  if (original) original.hidden = true;

  let change = top.querySelector("[data-plan-open]");
  if (!(change instanceof HTMLButtonElement)) {
    change = document.createElement("button");
    change.type = "button";
    change.className = "change-plan-button plan-change-data-button";
    change.setAttribute("data-plan-open", "true");
    top.appendChild(change);
  }
  change.textContent = labels.change;
}

function syncDashboard(shell: HTMLElement, stored: boolean): void {
  const hero = shell.querySelector(".hero");
  const result = shell.querySelector(".plan-result-card");
  const status = statusCard(shell);

  setupCards(shell).forEach((card) => {
    if (!card.closest(".plan-sheet-modal")) card.hidden = true;
  });

  if (result instanceof HTMLElement) {
    result.hidden = !stored;
    if (stored) {
      resultBanner(result);
      after(result, hero);
    }
  }

  status.hidden = !stored;
  if (stored && result instanceof HTMLElement) {
    const risk = shell.querySelector(".plan-body-data-card .timeline-risk-panel");
    const labels = labelsNow();
    status.innerHTML = `<div class="card-title">${labels.status}</div>${risk instanceof HTMLElement ? risk.outerHTML : ""}`;
    after(status, result);
  }

  Array.from(shell.children).forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    if (!node.classList.contains("card")) return;
    if (node.classList.contains("plan-result-card") || node.classList.contains("plan-home-status-card") || node.classList.contains("plan-settings-card")) return;
    node.hidden = !stored || !allowedDashboardCard(node);
  });
}

function syncSheet(shell: HTMLElement, stored: boolean): void {
  const sheet = ensureSheet(shell);
  sheet.hidden = !open;
  sheet.dataset.stage = stage;
  document.body.classList.toggle("plan-setup-lock", open);

  sheet.querySelectorAll("[data-plan-close]").forEach((button) => {
    if (button instanceof HTMLElement) button.hidden = !stored;
  });

  const intro = sheet.querySelector(".plan-sheet-intro");
  const form = sheet.querySelector(".plan-sheet-form");
  if (intro instanceof HTMLElement) intro.hidden = stage !== "intro";
  if (form instanceof HTMLElement) form.hidden = stage !== "form";

  if (stage === "form") {
    const body = sheet.querySelector(".plan-sheet-body");
    if (body instanceof HTMLElement) {
      setupCards(shell).forEach((card) => {
        card.hidden = false;
        if (card.parentElement !== body) body.appendChild(card);
      });
    }
    moveSave(shell, sheet);
  }
}

function ensureSheet(shell: HTMLElement): HTMLElement {
  const existing = shell.querySelector(".plan-sheet-overlay");
  if (existing instanceof HTMLElement) return existing;

  const labels = labelsNow();
  const sheet = document.createElement("section");
  sheet.className = "plan-sheet-overlay";
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "true");
  sheet.innerHTML = `
    <button class="plan-sheet-backdrop" data-plan-close type="button" aria-label="${labels.close}"></button>
    <div class="plan-sheet-modal">
      <div class="plan-sheet-head"><div><div class="card-title">${labels.setup}</div><strong>${labels.setup}</strong><span>${labels.setupText}</span></div><button data-plan-close type="button">${labels.close}</button></div>
      <div class="plan-sheet-intro"><div class="card plan-start-card"><div class="card-title">${labels.result}</div><h2>${labels.startTitle}</h2><p>${labels.startText}</p><div class="setup-step-grid"><span>${labels.body}</span><span>${labels.goal}</span><span>${labels.timeline}</span></div><button class="primary-button plan-start-button" data-plan-start type="button">${labels.start}</button></div></div>
      <div class="plan-sheet-form"><div class="plan-sheet-body"></div><div class="plan-sheet-footer"></div></div>
    </div>
  `;
  shell.appendChild(sheet);
  return sheet;
}

function moveSave(shell: HTMLElement, sheet: HTMLElement): void {
  const labels = labelsNow();
  const footer = sheet.querySelector(".plan-sheet-footer");
  const save = originalSave(shell);
  if (!(footer instanceof HTMLElement) || !(save instanceof HTMLButtonElement)) return;
  save.hidden = false;
  save.textContent = labels.save;
  save.classList.add("plan-setup-save-button");
  if (save.parentElement !== footer) footer.appendChild(save);
}

function markCards(shell: HTMLElement): void {
  Array.from(shell.children).forEach((node) => {
    if (!(node instanceof HTMLElement) || !node.classList.contains("card")) return;
    if (node.classList.contains("accent-card")) node.classList.add("plan-result-card");
    if (node.querySelector(".input-grid")) node.classList.add("plan-body-data-card", "plan-settings-card");
    if (node.querySelector(".segmented.two") && !node.querySelector(".input-grid") && !node.classList.contains("plan-result-card")) node.classList.add("plan-settings-card");
  });
}

function setupCards(shell: HTMLElement): HTMLElement[] {
  const direct = Array.from(shell.children).filter((node): node is HTMLElement => node instanceof HTMLElement && node.classList.contains("plan-settings-card"));
  const body = shell.querySelector(".plan-sheet-body");
  const moved = body instanceof HTMLElement ? Array.from(body.children).filter((node): node is HTMLElement => node instanceof HTMLElement && node.classList.contains("plan-settings-card")) : [];
  return [...direct, ...moved];
}

function originalSave(shell: HTMLElement): HTMLButtonElement | null {
  const buttons = Array.from(shell.querySelectorAll(".change-plan-button"));
  return buttons.find((button): button is HTMLButtonElement => button instanceof HTMLButtonElement && !button.matches("[data-plan-open]")) ?? null;
}

function resultBanner(card: HTMLElement): void {
  const labels = labelsNow();
  let banner = card.querySelector(".plan-result-banner");
  if (!(banner instanceof HTMLElement)) {
    banner = document.createElement("div");
    banner.className = "plan-result-banner";
    card.prepend(banner);
  }
  banner.innerHTML = `<div><div class="card-title">${labels.result}</div><h2>${labels.savedTitle}</h2><p>${labels.savedText}</p></div><span>${labels.saved}</span>`;
}

function statusCard(shell: HTMLElement): HTMLElement {
  const existing = shell.querySelector(".plan-home-status-card");
  if (existing instanceof HTMLElement) return existing;
  const card = document.createElement("section");
  card.className = "card plan-home-status-card";
  return card;
}

function allowedDashboardCard(card: HTMLElement): boolean {
  if (card.classList.contains("weekly-structure-card")) return false;
  if (card.querySelector(".check-grid")) return false;
  if (card.querySelector(".projection-table")) return true;
  if (card.querySelector(".warning")) return true;
  const title = card.querySelector(".card-title")?.textContent?.toLowerCase() ?? "";
  return title.includes("execution") || title.includes("执行");
}

function after(node: Element, ref: Element | null): void {
  if (!ref || !ref.parentElement || ref.nextSibling === node) return;
  ref.parentElement.insertBefore(node, ref.nextSibling);
}

function hasPlan(): boolean {
  return Boolean(window.localStorage.getItem(STORAGE_KEY));
}

function labelsNow(): typeof copy.en | typeof copy.zh {
  return window.localStorage.getItem(LANGUAGE_KEY) === "zh" ? copy.zh : copy.en;
}

export {};
