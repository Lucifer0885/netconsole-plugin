import { notesFromVisit, visitIdFromUrl, type VisitNoteMessage } from "../src/visit-notes";

function publish(url: string, body: unknown): void {
  const id = visitIdFromUrl(url);
  if (!id) return;
  const message: VisitNoteMessage = {
    source: "netconsole",
    type: "visit",
    id,
    notes: notesFromVisit(body),
  };
  window.postMessage(message, location.origin);
}

function hookFetch(): void {
  const original = window.fetch;
  window.fetch = function (input, init) {
    return original.call(this, input, init).then((response) => {
      const url = typeof input === "string" ? input : input instanceof Request ? input.url : "";
      if (visitIdFromUrl(url)) {
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
  XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: unknown[]) {
    urls.set(this, String(url));
    return originalOpen.apply(this, [method, url, ...rest] as Parameters<XMLHttpRequest["open"]>);
  } as XMLHttpRequest["open"];
  XMLHttpRequest.prototype.send = function (this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
    this.addEventListener("load", () => {
      const url = urls.get(this);
      if (!url) return;
      try {
        publish(url, JSON.parse(this.responseText));
      } catch {
        // The visit payload is JSON. Anything else is ignored.
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
  },
});
