// Messages between the Store Tasks patch and the page script that sends the API calls.
// Only CLEAN_PC tasks are resolved; help requests, disconnects and start checks are left alone.

export type CleanTasksRequest = {
  source: "netconsole";
  type: "clean-tasks";
  id: string;
};

export type CleanTasksResult = {
  source: "netconsole";
  type: "clean-tasks-done";
  id: string;
  cleaned: number;
  failed: number;
  error?: "not-ready" | "list-failed";
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
