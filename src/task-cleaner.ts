import {
  cleanTaskType,
  storeIdFromUrl,
  type CleanTasksAck,
  type CleanTasksRequest,
  type CleanTasksResult,
} from "./store-tasks";

// Runs in the page. It reuses the headers eplay itself sends (login token, store slug),
// kept in memory only, so the calls act exactly like clicking each task's check button.
const copied = ["authorization", "store-slug", "accept"];
const headers = new Map<string, string>();
let storeId: string | null = null;
let busy = false;

function isEplayApi(url: string): boolean {
  try {
    const parsed = new URL(url, location.href);
    return parsed.origin === location.origin && parsed.pathname.startsWith("/api/");
  } catch {
    return false;
  }
}

export function noteRequest(url: string): void {
  if (!isEplayApi(url)) return;
  storeId = storeIdFromUrl(url) ?? storeId;
}

export function noteHeader(url: string, name: string, value: string): void {
  if (!isEplayApi(url)) return;
  const key = name.toLowerCase();
  if (copied.includes(key)) headers.set(key, value);
}

type Task = { id?: unknown; type?: unknown };

async function cleanAll(send: typeof fetch): Promise<Omit<CleanTasksResult, "source" | "type" | "id">> {
  if (!storeId || !headers.has("authorization")) return { cleaned: 0, failed: 0, error: "not-ready" };
  const init = { headers: Object.fromEntries(headers), credentials: "include" as const };
  const base = `/api/stores/${storeId}/tasks`;

  let tasks: Task[];
  try {
    const response = await send(base, init);
    if (!response.ok) return { cleaned: 0, failed: 0, error: "list-failed" };
    const body = (await response.json()) as unknown;
    const list = Array.isArray(body) ? body : (body as { data?: unknown })?.data;
    tasks = Array.isArray(list) ? (list as Task[]) : [];
  } catch {
    return { cleaned: 0, failed: 0, error: "list-failed" };
  }

  let cleaned = 0;
  let failed = 0;
  for (const task of tasks) {
    if (task?.type !== cleanTaskType || (typeof task.id !== "number" && typeof task.id !== "string")) continue;
    try {
      const response = await send(`${base}/${task.id}`, {
        ...init,
        method: "DELETE",
        headers: { ...init.headers, "X-Suppress-Error-Notification": "true" },
      });
      if (response.ok) cleaned += 1;
      else failed += 1;
    } catch {
      failed += 1;
    }
  }
  return { cleaned, failed };
}

export function answerCleanRequests(send: typeof fetch): void {
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data as Partial<CleanTasksRequest> | null;
    if (data?.source !== "netconsole" || data.type !== "clean-tasks" || typeof data.id !== "string") return;
    const id = data.id;
    const ack: CleanTasksAck = { source: "netconsole", type: "clean-tasks-ack", id };
    window.postMessage(ack, location.origin);
    const reply = (result: Omit<CleanTasksResult, "source" | "type" | "id">) => {
      const message: CleanTasksResult = { source: "netconsole", type: "clean-tasks-done", id, ...result };
      window.postMessage(message, location.origin);
    };
    if (busy) {
      reply({ cleaned: 0, failed: 0 });
      return;
    }
    busy = true;
    void cleanAll(send)
      .then(reply)
      .finally(() => {
        busy = false;
      });
  });
}
