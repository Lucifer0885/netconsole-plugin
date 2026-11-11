import type { VisitNoteEntry, VisitNoteMessage } from "../visit-notes";
import type { Patch } from "./types";

// A seat can hold up to 4 users (common on PlayStations), and the overview dialog shows one
// card per user. Each card gets the notes of the visit whose user name appears on that card.
type Known = { own: string | null; customer: string[]; names: string[] };

const freshFor = 3000;
const known = new Map<string, Known>();
const openedAt = new WeakMap<Element, number>();
let lastSingle: { id: string; at: number } | null = null;

function clean(list: unknown): string[] {
  return Array.isArray(list) ? list.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function remember(visit: VisitNoteEntry): void {
  if (typeof visit?.id !== "string") return;
  const before = known.get(visit.id);
  known.set(visit.id, {
    // The client list leaves out the visit's own note; keep what the visit response said.
    own: visit.own === undefined ? (before?.own ?? null) : visit.own,
    customer: clean(visit.customer),
    names: clean(visit.names),
  });
}

function onMessage(event: MessageEvent): void {
  if (event.source !== window) return;
  const data = event.data as Partial<VisitNoteMessage> | null;
  if (!data || data.source !== "netconsole" || data.type !== "visit-notes" || !Array.isArray(data.visits)) return;
  for (const visit of data.visits) remember(visit);
  if (data.single && data.visits[0]) lastSingle = { id: data.visits[0].id, at: performance.now() };
  paint(document);
}

window.addEventListener("message", onMessage);

function notesOf(visit: Known): string[] {
  const notes = visit.own ? [visit.own] : [];
  for (const note of visit.customer) if (!notes.includes(note)) notes.push(note);
  return notes;
}

// The card's own text, leaving out the note row this patch added.
function cardText(card: Element): string {
  let text = "";
  for (const child of card.childNodes) {
    if (child instanceof Element && child.classList.contains("nc-visit-note")) continue;
    text += ` ${child.textContent ?? ""}`;
  }
  return text.toUpperCase();
}

// The visit whose longest matching name is on the card. Two visits tied on the same length
// means we can't tell them apart, so no note rather than a wrong one.
function matchCard(card: Element): Known | null {
  const text = cardText(card);
  let best: Known | null = null;
  let bestLength = 0;
  let tied = false;
  for (const visit of known.values()) {
    const length = Math.max(0, ...visit.names.filter((name) => text.includes(name.toUpperCase())).map((name) => name.length));
    if (length === 0) continue;
    if (length > bestLength) {
      best = visit;
      bestLength = length;
      tied = false;
    } else if (length === bestLength && visit !== best) {
      tied = true;
    }
  }
  return tied ? null : best;
}

function setNote(root: Document, card: Element, notes: string[]): void {
  let row = card.querySelector(":scope > .nc-visit-note");
  const text = notes.join("\n");
  if (!text) {
    row?.remove();
    return;
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

function paint(root: Document): void {
  const dialog = root.querySelector(".overview-dialog");
  if (!(dialog instanceof HTMLElement)) return;
  if (!openedAt.has(dialog)) openedAt.set(dialog, performance.now());
  const opened = openedAt.get(dialog) ?? 0;
  const cards = [...dialog.querySelectorAll('[class*="bg-blue-50"]')];

  for (const card of cards) {
    let visit = matchCard(card);
    // A single card with no name match: fall back to the visit the dialog just loaded.
    if (!visit && cards.length === 1 && lastSingle && lastSingle.at >= opened - freshFor) {
      visit = known.get(lastSingle.id) ?? null;
    }
    setNote(root, card, visit ? notesOf(visit) : []);
  }
}

export const visitNote: Patch = {
  id: "visit-note",
  apply: paint,
};
