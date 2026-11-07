import type { VisitNoteMessage } from "../visit-notes";
import type { Patch } from "./types";

type VisitNotes = {
  id: string;
  notes: string[];
  at: number;
};

const freshFor = 3000;
const openedAt = new WeakMap<Element, number>();
let latest: VisitNotes | null = null;

function onMessage(event: MessageEvent): void {
  if (event.source !== window) return;
  const data = event.data as Partial<VisitNoteMessage> | null;
  if (!data || data.source !== "netconsole" || data.type !== "visit") return;
  if (typeof data.id !== "string" || !Array.isArray(data.notes)) return;
  latest = {
    id: data.id,
    notes: data.notes.filter((note): note is string => typeof note === "string" && note.trim().length > 0),
    at: performance.now(),
  };
  paint(document);
}

window.addEventListener("message", onMessage);

function paint(root: Document): void {
  const dialog = root.querySelector(".overview-dialog");
  if (!(dialog instanceof HTMLElement)) return;
  if (!openedAt.has(dialog)) openedAt.set(dialog, performance.now());
  const opened = openedAt.get(dialog) ?? 0;
  const notes = latest && latest.at >= opened - freshFor ? latest.notes : [];
  const text = notes.join("\n");

  for (const card of dialog.querySelectorAll('[class*="bg-blue-50"]')) {
    let row = card.querySelector(":scope > .nc-visit-note");
    if (!text) {
      row?.remove();
      continue;
    }
    if (!(row instanceof HTMLElement)) {
      row = root.createElement("div");
      row.className = "nc-visit-note";
      const label = root.createElement("span");
      label.className = "nc-visit-note__label";
      label.textContent = "Note";
      const body = root.createElement("span");
      body.className = "nc-visit-note__text";
      row.append(label, body);
      card.append(row);
    }
    const body = row.querySelector(".nc-visit-note__text");
    if (body && body.textContent !== text) body.textContent = text;
  }
}

export const visitNote: Patch = {
  id: "visit-note",
  apply: paint,
};
