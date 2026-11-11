// Messages between the Store Tasks patch and the page script that sends the API calls.
// Only CLEAN_PC tasks are resolved; help requests, disconnects and start checks are left alone.

export type CleanTasksRequest = {
  source: "netconsole";
  type: "clean-tasks";
  id: string;
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

export const cleanTaskType = "CLEAN_PC";

export function storeIdFromUrl(url: string): string | null {
  try {
    const path = new URL(url, "https://eplay.netconsole.me").pathname;
    return path.match(/^\/api\/stores\/(\d+)\//)?.[1] ?? null;
  } catch {
    return null;
  }
}
