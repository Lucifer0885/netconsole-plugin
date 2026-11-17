import type { Patch } from "./types";

// eplay's Restart / Shutdown confirmations ("Shutdown Client", "Are you sure…") don't say which
// PC they're for. The PC's right-click menu has its name as a header, so remember the name when
// an item in that menu is clicked and add it to the confirmation that opens right after.
const freshMs = 3000;
let picked: { name: string; at: number } | null = null;

function menuClientName(item: Element): string | null {
  const menu = item.closest(".q-menu");
  const header = menu?.firstElementChild;
  if (!header || header.tagName !== "SPAN") return null;
  const name = header.textContent?.trim();
  return name || null;
}

document.addEventListener(
  "click",
  (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const item = target.closest(".q-menu .q-item");
    if (!item) return;
    const name = menuClientName(item);
    if (name) picked = { name, at: performance.now() };
  },
  true,
);

function paint(root: Document): void {
  for (const dialog of root.querySelectorAll<HTMLElement>(".q-dialog-plugin")) {
    let name = dialog.dataset.ncClient;
    if (name === undefined) {
      // Only a dialog that opened just after a PC menu click gets that PC's name.
      const fresh = picked && performance.now() - picked.at < freshMs;
      name = fresh && picked ? picked.name : "";
      dialog.dataset.ncClient = name;
      if (fresh) picked = null;
    }
    if (!name || dialog.querySelector(".nc-dialog-client")) continue;
    const message = dialog.querySelector(".q-dialog__message") ?? dialog.querySelector(".q-dialog__title");
    if (!message) continue;
    const row = root.createElement("div");
    row.className = "q-card__section q-card__section--vert nc-dialog-client";
    const label = root.createElement("span");
    label.textContent = "Client: ";
    const value = root.createElement("strong");
    value.textContent = name;
    row.append(label, value);
    message.after(row);
  }
}

export const clientDialog: Patch = {
  id: "client-dialog",
  apply: paint,
};
