import { lastAutoClean, settings } from "../settings";
import type { CleanTasksRequest, CleanTasksResult } from "../store-tasks";
import type { Patch } from "./types";

const onEplay = location.hostname === "eplay.netconsole.me";
const pending = new Map<string, (result: CleanTasksResult) => void>();
let running = false;
let note = "";
let noteTimer = 0;

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const data = event.data as Partial<CleanTasksResult> | null;
  if (data?.source !== "netconsole" || data.type !== "clean-tasks-done" || typeof data.id !== "string") return;
  pending.get(data.id)?.(data as CleanTasksResult);
  pending.delete(data.id);
});

function requestClean(): Promise<CleanTasksResult> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      pending.delete(id);
      resolve({ source: "netconsole", type: "clean-tasks-done", id, cleaned: 0, failed: 0, error: "list-failed" });
    }, 60_000);
    pending.set(id, (result) => {
      window.clearTimeout(timeout);
      resolve(result);
    });
    const message: CleanTasksRequest = { source: "netconsole", type: "clean-tasks", id };
    window.postMessage(message, location.origin);
  });
}

// The Store Tasks drawer header: the q-item with the clipboard icon and the refresh button.
function findHeader(root: Document): HTMLElement | null {
  for (const icon of root.querySelectorAll(".mdi-clipboard-check-outline")) {
    const header = icon.closest(".q-item");
    if (header instanceof HTMLElement && header.textContent?.includes("Store Tasks") && header.querySelector("button")) {
      return header;
    }
  }
  return null;
}

function refreshList(root: Document): void {
  const header = findHeader(root);
  const refresh = header?.querySelector<HTMLButtonElement>("button.q-btn:not(.nc-clean-all)");
  refresh?.click();
}

function showNote(text: string): void {
  note = text;
  window.clearTimeout(noteTimer);
  noteTimer = window.setTimeout(() => {
    note = "";
    paint(document);
  }, 4000);
  paint(document);
}

function describe(result: CleanTasksResult): string {
  if (result.error === "not-ready") return "Not ready yet, try again";
  if (result.error) return "Couldn't load tasks";
  if (!result.cleaned && !result.failed) return "Nothing to clean";
  return result.failed ? `Cleaned ${result.cleaned}, ${result.failed} failed` : `Cleaned ${result.cleaned}`;
}

async function cleanNow(): Promise<CleanTasksResult | null> {
  if (running) return null;
  running = true;
  paint(document);
  try {
    const result = await requestClean();
    if (result.cleaned) refreshList(document);
    return result;
  } finally {
    running = false;
    paint(document);
  }
}

function button(root: Document): HTMLButtonElement {
  const el = root.createElement("button");
  el.type = "button";
  el.className = "nc-clean-all";
  el.innerHTML = '<i class="q-icon mdi mdi-broom" aria-hidden="true"></i><span></span>';
  el.addEventListener("click", (event) => {
    // The header toggles the drawer section when clicked, so keep the click to ourselves.
    event.preventDefault();
    event.stopPropagation();
    void cleanNow().then((result) => {
      if (result) showNote(describe(result));
    });
  });
  return el;
}

function paint(root: Document): void {
  if (!onEplay) return;
  const header = findHeader(root);
  if (!header) return;
  let el = header.querySelector<HTMLButtonElement>(".nc-clean-all");
  if (!el) {
    const refresh = header.querySelector<HTMLButtonElement>("button.q-btn");
    const side = refresh?.closest(".q-item__section--side");
    if (!refresh || !side) return;
    el = button(root);
    side.classList.add("nc-clean-side");
    side.insertBefore(el, side.firstChild);
  }
  const label = running ? "Cleaning…" : note || "Clean all";
  const span = el.querySelector("span");
  if (span && span.textContent !== label) span.textContent = label;
  el.disabled = running;
  el.title = "Mark every PC clean task as done";
}

// Auto clean: checked every 30 seconds, runs once per interval across all open eplay tabs.
async function autoCleanTick(): Promise<void> {
  if (!settings.autoClean || running) return;
  const last = await lastAutoClean.getValue();
  if (Date.now() - last < settings.autoCleanMinutes * 60_000) return;
  await lastAutoClean.setValue(Date.now());
  const result = await cleanNow();
  // Not ready means eplay hasn't made a request we can borrow headers from yet. Retry soon.
  if (result?.error === "not-ready") await lastAutoClean.setValue(last);
  if (result?.cleaned) showNote(`Auto cleaned ${result.cleaned}`);
}

if (onEplay) {
  window.setTimeout(() => void autoCleanTick(), 10_000);
  window.setInterval(() => void autoCleanTick(), 30_000);
}

export const storeTasks: Patch = {
  id: "store-tasks",
  apply: paint,
};
