let installed = false;

export function installNumericInputGuard(): void {
  if (installed || typeof document === "undefined") return;
  installed = true;

  document.addEventListener(
    "input",
    (event) => {
      const target = event.target;

      if (!(target instanceof HTMLInputElement) || target.type !== "number") {
        return;
      }

      if (target.value === "") {
        event.stopImmediatePropagation();
        return;
      }

      const normalizedValue = normalizeLeadingZeros(target.value);

      if (normalizedValue !== target.value) {
        target.value = normalizedValue;
      }
    },
    true
  );
}

function normalizeLeadingZeros(value: string): string {
  if (value === "0" || value.startsWith("0.")) return value;
  return value.replace(/^0+(?=\d)/, "");
}
