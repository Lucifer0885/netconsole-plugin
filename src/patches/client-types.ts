import type { ClientKind, ClientStatsMessage } from "../client-stats";
import type { Patch } from "./types";

let kinds: ClientKind[] = [];

function onMessage(event: MessageEvent): void {
  if (event.source !== window) return;
  const data = event.data as Partial<ClientStatsMessage> | null;
  if (!data || data.source !== "netconsole" || data.type !== "clients") return;
  if (!Array.isArray(data.kinds)) return;
  kinds = data.kinds;
  paint(document);
}

window.addEventListener("message", onMessage);
window.postMessage({ source: "netconsole", type: "clients-replay" }, location.origin);

// The stats pill on the Clients map: a frosted row whose first chip has the "occupied" icon.
function findPill(root: Document): HTMLElement | null {
  const icon = root.querySelector(".backdrop-blur-md .mdi-account-clock");
  const pill = icon?.closest(".backdrop-blur-md");
  return pill instanceof HTMLElement ? pill : null;
}

function chip(root: Document, kind: ClientKind): HTMLElement {
  const free = kind.total - kind.busy - kind.broken;
  const el = root.createElement("div");
  el.className = "nc-client-kind";
  el.title = `${kind.label}: ${kind.busy} occupied, ${free} free, ${kind.broken} out of order, ${kind.total} total`;

  const icon = root.createElement("i");
  icon.className = `q-icon mdi ${kind.icon}`;
  icon.setAttribute("aria-hidden", "true");

  const text = root.createElement("div");
  text.className = "nc-client-kind__text";
  const value = root.createElement("div");
  value.className = "nc-client-kind__value";
  value.textContent = `${free}/${kind.total}`;
  const label = root.createElement("div");
  label.className = "nc-client-kind__label";
  label.textContent = kind.broken ? `${kind.label} free · ${kind.broken} down` : `${kind.label} free`;
  text.append(value, label);

  el.append(icon, text);
  return el;
}

function paint(root: Document): void {
  const pill = findPill(root);
  if (!pill) return;
  let row = pill.querySelector(":scope > .nc-client-kinds");
  // While our chips are showing, the page's own chips are hidden (see patches.css).
  pill.classList.toggle("nc-client-pill", kinds.length > 0);
  if (!kinds.length) {
    row?.remove();
    return;
  }
  const signature = JSON.stringify(kinds);
  if (row instanceof HTMLElement && row.dataset.signature === signature) return;
  if (!(row instanceof HTMLElement)) {
    row = root.createElement("div");
    row.className = "nc-client-kinds";
    pill.append(row);
  }
  const target = row as HTMLElement;
  target.dataset.signature = signature;
  target.replaceChildren(...kinds.map((kind) => chip(root, kind)));
}

export const clientTypes: Patch = {
  id: "client-types",
  apply: paint,
};
