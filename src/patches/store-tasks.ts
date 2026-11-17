import { lastAutoClean, lastAutoClearDisconnects, settings } from "../settings";
import {
  cleanTaskType,
  disconnectTaskType,
  type CleanTasksAck,
  type CleanTasksRequest,
  type CleanTasksResult,
} from "../store-tasks";
import type { Patch } from "./types";

const onEplay = location.hostname === "eplay.netconsole.me";
// How long to wait for the page script to say it got the request, then for the clean to finish.
const ackWait = 3_000;
const doneWait = 120_000;

type Waiter = { acked: () => void; done: (result: CleanTasksResult) => void };
const pending = new Map<string, Waiter>();
let running = false;
let note = "";
let noteTimer = 0;

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const data = event.data as Partial<CleanTasksResult | CleanTasksAck> | null;
  if (data?.source !== "netconsole" || typeof data.id !== "string") return;
  const waiter = pending.get(data.id);
  if (!waiter) return;
  if (data.type === "clean-tasks-ack") waiter.acked();
  if (data.type === "clean-tasks-done") {
    pending.delete(data.id);
    waiter.done(data as CleanTasksResult);
  }
});

function requestClean(types: string[]): Promise<CleanTasksResult> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return new Promise((resolve) => {
    const fail = (error: CleanTasksResult["error"]) => {
      pending.delete(id);
      resolve({ source: "netconsole", type: "clean-tasks-done", id, cleaned: 0, failed: 0, error });
    };
    let timer = window.setTimeout(() => fail("no-reply"), ackWait);
    pending.set(id, {
      acked: () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => fail("timeout"), doneWait);
      },
      done: (result) => {
        window.clearTimeout(timer);
        resolve(result);
      },
    });
    const message: CleanTasksRequest = { source: "netconsole", type: "clean-tasks", id, types };
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
  if (result.error === "no-reply") return "No reply";
  if (result.error === "timeout") return "Took too long";
  if (result.error) return "Couldn't load tasks";
  if (!result.cleaned && !result.failed) return "Nothing to clean";
  return result.failed ? `Cleaned ${result.cleaned}, ${result.failed} failed` : `Cleaned ${result.cleaned}`;
}

async function cleanNow(types: string[]): Promise<CleanTasksResult | null> {
  if (running) return null;
  running = true;
  paint(document);
  try {
    const result = await requestClean(types);
    if (result.error === "no-reply") {
      console.warn(
        "[netconsole] Clean all: the page script didn't answer. Reload the extension (or restart `npm run dev`) and refresh the page.",
      );
    }
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
    void cleanNow([cleanTaskType, disconnectTaskType]).then((result) => {
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
  el.title = "Mark every PC clean and client disconnected task as done";
}

// Auto clean: two independent jobs, checked every 30 seconds. Each runs once per its own
// interval across all open eplay tabs (the last run time is shared through storage).
type Job = {
  enabled: () => boolean;
  minutes: () => number;
  last: typeof lastAutoClean;
  types: string[];
  done: string;
};

const jobs: Job[] = [
  {
    enabled: () => settings.autoClean,
    minutes: () => settings.autoCleanMinutes,
    last: lastAutoClean,
    types: [cleanTaskType],
    done: "Auto cleaned",
  },
  {
    enabled: () => settings.autoClearDisconnects,
    minutes: () => settings.autoClearDisconnectsMinutes,
    last: lastAutoClearDisconnects,
    types: [disconnectTaskType],
    done: "Auto cleared",
  },
];

async function runJob(job: Job): Promise<void> {
  if (!job.enabled() || running) return;
  const last = await job.last.getValue();
  if (Date.now() - last < job.minutes() * 60_000) return;
  await job.last.setValue(Date.now());
  const result = await cleanNow(job.types);
  // Not ready or no reply: eplay hasn't loaded enough yet. Retry on the next check.
  if (!result || result.error === "not-ready" || result.error === "no-reply") await job.last.setValue(last);
  if (result?.cleaned) showNote(`${job.done} ${result.cleaned}`);
}

async function autoCleanTick(): Promise<void> {
  for (const job of jobs) await runJob(job);
}

if (onEplay) {
  window.setTimeout(() => void autoCleanTick(), 10_000);
  window.setInterval(() => void autoCleanTick(), 30_000);
}

export const storeTasks: Patch = {
  id: "store-tasks",
  apply: paint,
};
