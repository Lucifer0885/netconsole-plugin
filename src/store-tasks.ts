// Messages between the Store Tasks patch and the page script that sends the API calls.
// Only PC clean and client disconnected tasks can be resolved; help requests and
// self start checks are always left alone.

export const cleanTaskType = "CLEAN_PC";
export const disconnectTaskType = "CLIENT_DISCONNECTED";
export const resolvableTypes: readonly string[] = [cleanTaskType, disconnectTaskType];

export type CleanTasksRequest = {
  source: "netconsole";
  type: "clean-tasks";
  id: string;
  // Which task types to resolve. Anything outside resolvableTypes is ignored.
  types: string[];
};

// Sent straight away so the patch knows the page script is there and working on it.
export type CleanTasksAck = {
  source: "netconsole";
  type: "clean-tasks-ack";
  id: string;
};

export type CleanTasksResult = {
  source: "netconsole";
  type: "clean-tasks-done";
  id: string;
  cleaned: number;
  failed: number;
  // no-reply: the page script never answered (not loaded, or an older build of it).
  // timeout: it answered but the clean took too long.
  error?: "not-ready" | "list-failed" | "no-reply" | "timeout";
};

export function storeIdFromUrl(url: string): string | null {
  try {
    const path = new URL(url, "https://eplay.netconsole.me").pathname;
    return path.match(/^\/api\/stores\/(\d+)\//)?.[1] ?? null;
  } catch {
    return null;
  }
}
