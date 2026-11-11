import type { Patch } from "./types";

// End Shift dialog on eplay: shows Cash + Card under the two amount fields.
// Read-only: it never touches the inputs or the dialog's buttons.
const cashSelector = 'input[aria-label="Cash Amount"]';
const cardSelector = 'input[aria-label="Card Amount"]';

// Accepts "12.50", "12,50", "1.234,50" and "1,234.50". Empty or junk counts as 0.
export function parseAmount(raw: string): number {
  let text = raw.replace(/[^\d.,-]/g, "");
  if (!text) return 0;
  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  const decimal = lastComma > lastDot ? "," : ".";
  const thousands = decimal === "," ? "." : ",";
  text = text.split(thousands).join("").replace(decimal, ".");
  const value = Number.parseFloat(text);
  return Number.isFinite(value) ? value : 0;
}

function format(value: number): string {
  return `€${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function paint(root: Document): void {
  const cash = root.querySelector<HTMLInputElement>(cashSelector);
  if (!cash) return;
  const card = cash.closest(".q-card")?.querySelector<HTMLInputElement>(cardSelector);
  const field = card?.closest(".q-field");
  if (!card || !field) return;

  let row = field.nextElementSibling;
  if (!(row instanceof HTMLElement) || !row.classList.contains("nc-shift-total")) {
    row = root.createElement("div");
    row.className = "nc-shift-total";
    row.innerHTML = '<span class="nc-shift-total__label">Total (cash + card)</span><span class="nc-shift-total__value"></span>';
    field.after(row);
  }
  const value = row.querySelector(".nc-shift-total__value");
  const text = format(parseAmount(cash.value) + parseAmount(card.value));
  if (value && value.textContent !== text) value.textContent = text;
}

// Typing doesn't change the DOM, so the page watcher won't rerun; listen for it here.
document.addEventListener(
  "input",
  (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.matches(`${cashSelector}, ${cardSelector}`)) paint(document);
  },
  true,
);

export const shiftTotal: Patch = {
  id: "shift-total",
  apply: paint,
};
