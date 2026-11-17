import { isClientListUrl, kindsFromClients, type ClientStatsMessage } from "../src/client-stats";
import { usersByClient, type ClientVisitsRequest, type ClientVisitsResult } from "../src/client-visits";
import { answerCleanRequests, noteHeader, noteRequest, storeGet } from "../src/task-cleaner";
import { entriesFromClients, entryFromVisit, visitIdFromUrl, type VisitNoteMessage } from "../src/visit-notes";

function wanted(url: string): boolean {
  return visitIdFromUrl(url) !== null || isClientListUrl(url);
}

function publish(url: string, body: unknown): void {
  const id = visitIdFromUrl(url);
  if (id) {
    const visit = entryFromVisit(id, body);
    if (!visit) return;
    const message: VisitNoteMessage = { source: "netconsole", type: "visit-notes", single: true, visits: [visit] };
    window.postMessage(message, location.origin);
    return;
  }
  if (isClientListUrl(url)) {
    lastUsers = usersByClient(body);
    lastNotes = { source: "netconsole", type: "visit-notes", single: false, visits: entriesFromClients(body) };
    window.postMessage(lastNotes, location.origin);
    const kinds = kindsFromClients(body);
    if (!kinds) return;
    lastClients = { source: "netconsole", type: "clients", kinds };
    window.postMessage(lastClients, location.origin);
  }
}

let lastNotes: VisitNoteMessage | null = null;
let lastUsers: Map<string, string[]> | null = null;

// Who is on a PC: fetch a fresh client list (read-only) so the answer is current; fall back
// to the last list eplay loaded if that isn't possible.
function answerClientVisits(send: typeof fetch): void {
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data as Partial<ClientVisitsRequest> | null;
    if (data?.source !== "netconsole" || data.type !== "client-visits") return;
    if (typeof data.id !== "string" || typeof data.client !== "string") return;
    const { id, client } = data;
    void storeGet(send, "clients/active").then((body) => {
      if (body) lastUsers = usersByClient(body);
      const users = lastUsers?.get(client);
      const message: ClientVisitsResult = {
        source: "netconsole",
        type: "client-visits-done",
        id,
        client,
        users: users ?? [],
        fresh: Boolean(body),
        unknown: !lastUsers || users === undefined,
      };
      window.postMessage(message, location.origin);
    });
  });
}

let lastClients: ClientStatsMessage | null = null;

// The patch asks again once it loads, in case the list arrived before it was listening.
function answerReplays(): void {
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data as { source?: unknown; type?: unknown } | null;
    if (data?.source !== "netconsole" || data.type !== "clients-replay") return;
    if (lastClients) window.postMessage(lastClients, location.origin);
    if (lastNotes) window.postMessage(lastNotes, location.origin);
  });
}

const originalFetch = window.fetch.bind(window);

function hookFetch(): void {
  const original = window.fetch;
  window.fetch = function (input, init) {
    return original.call(this, input, init).then((response) => {
      const url =
        typeof input === "string" ? input : input instanceof Request ? input.url : input instanceof URL ? input.href : "";
      if (wanted(url)) {
        void response
          .clone()
          .json()
          .then((body) => publish(url, body))
          .catch(() => undefined);
      }
      return response;
    });
  };
}

function hookXhr(): void {
  const urls = new WeakMap<XMLHttpRequest, string>();
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  const originalSetHeader = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: unknown[]) {
    urls.set(this, String(url));
    noteRequest(String(url));
    return originalOpen.apply(this, [method, url, ...rest] as Parameters<XMLHttpRequest["open"]>);
  } as XMLHttpRequest["open"];
  XMLHttpRequest.prototype.setRequestHeader = function (this: XMLHttpRequest, name: string, value: string) {
    const url = urls.get(this);
    if (url) noteHeader(url, name, value);
    return originalSetHeader.call(this, name, value);
  };
  XMLHttpRequest.prototype.send = function (this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
    this.addEventListener("load", () => {
      const url = urls.get(this);
      if (!url || !wanted(url)) return;
      try {
        publish(url, JSON.parse(this.responseText));
      } catch {
        // These payloads are JSON. Anything else is ignored.
      }
    });
    return originalSend.call(this, body);
  };
}

export default defineContentScript({
  matches: ["https://netconsole.me/*", "https://*.netconsole.me/*"],
  runAt: "document_start",
  world: "MAIN",
  main() {
    hookFetch();
    hookXhr();
    answerReplays();
    if (location.hostname === "eplay.netconsole.me") {
      answerCleanRequests(originalFetch);
      answerClientVisits(originalFetch);
    }
  },
});
