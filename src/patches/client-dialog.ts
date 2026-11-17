import type { ClientVisitsRequest, ClientVisitsResult } from "../client-visits";
import type { Patch } from "./types";

// eplay's Restart / Shutdown confirmations ("Shutdown Client", "Are you sure…") don't say which
// PC they're for. The PC's right-click menu has its name as a header, so remember the name when
// an item in that menu is clicked and add it to the confirmation that opens right after.
// It also warns when the PC has an active visit, naming the user. OK still works as before.
const freshMs = 3000;
let picked: { name: string; at: number } | null = null;
// Latest lookup per client name; null while it's still loading.
const visits = new Map<string, ClientVisitsResult | null>();
let lookupId = 0;

function menuClientName(item: Element): string | null {
  const menu = item.closest(".q-menu");
  const header = menu?.firstElementChild;
  if (!header || header.tagName !== "SPAN") return null;
  const name = header.textContent?.trim();
  return name || null;
}

function lookUp(name: string): void {
  visits.set(name, null);
  lookupId += 1;
  const message: ClientVisitsRequest = { source: "netconsole", type: "client-visits", id: String(lookupId), client: name };
  window.postMessage(message, location.origin);
}

document.addEventListener(
  "click",
  (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const item = target.closest(".q-menu .q-item");
    if (!item) return;
    const name = menuClientName(item);
    if (!name) return;
    picked = { name, at: performance.now() };
    lookUp(name);
  },
  true,
);

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const data = event.data as Partial<ClientVisitsResult> | null;
  if (data?.source !== "netconsole" || data.type !== "client-visits-done" || typeof data.client !== "string") return;
  visits.set(data.client, data as ClientVisitsResult);
  paint(document);
});

function clientRow(root: Document, name: string): HTMLElement {
  const row = root.createElement("div");
  row.className = "q-card__section q-card__section--vert nc-dialog-client";
  const label = root.createElement("span");
  label.textContent = "Client: ";
  const value = root.createElement("strong");
  value.textContent = name;
  row.append(label, value);
  return row;
}

function el<K extends keyof HTMLElementTagNameMap>(root: Document, tag: K, className: string, text?: string) {
  const node = root.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function icon(root: Document, name: string): HTMLElement {
  const node = el(root, "i", `q-icon mdi ${name}`);
  node.setAttribute("aria-hidden", "true");
  return node;
}

// Busy: a heading, one line per user, then what happens if you continue.
// Loading / free: a single quiet line.
function fill(root: Document, row: HTMLElement, state: string, users: string[]): void {
  if (state !== "busy") {
    const text = state === "loading" ? "Checking for an active visit…" : "No active visit on this client.";
    row.replaceChildren(icon(root, state === "free" ? "mdi-check-circle-outline" : "mdi-timer-sand"), el(root, "span", "", text));
    return;
  }
  const heading = el(root, "div", "nc-dialog-visit__heading");
  heading.append(icon(root, "mdi-alert"), el(root, "span", "", users.length > 1 ? `${users.length} active visits` : "Active visit"));
  const list = el(root, "ul", "nc-dialog-visit__users");
  for (const user of users) {
    const item = el(root, "li", "");
    item.append(icon(root, "mdi-account"), el(root, "span", "", user));
    list.append(item);
  }
  const note = el(
    root,
    "div",
    "nc-dialog-visit__note",
    users.length > 1 ? "Continuing will end their sessions." : "Continuing will end their session.",
  );
  row.replaceChildren(heading, list, note);
}

function visitRow(root: Document, row: HTMLElement | null, result: ClientVisitsResult | null | undefined): HTMLElement | null {
  // Nothing to say: no lookup, or we couldn't tell.
  if (result === undefined || result?.unknown) {
    row?.remove();
    return null;
  }
  const users = result?.users ?? [];
  const state = result === null ? "loading" : users.length ? "busy" : "free";
  // q--avoid-card-border stops Quasar's card rule from stripping our border and corners.
  if (!row) row = el(root, "div", "q-card__section q-card__section--vert q--avoid-card-border nc-dialog-visit");
  const signature = `${state}|${users.join("|")}`;
  if (row.dataset.signature !== signature) {
    row.dataset.signature = signature;
    row.dataset.state = state;
    fill(root, row, state, users);
  }
  return row;
}

function paint(root: Document): void {
  for (const dialog of root.querySelectorAll<HTMLElement>(".q-dialog-plugin")) {
    let name = dialog.dataset.ncClient;
    if (name === undefined) {
      // Only a dialog that opened just after a PC menu click gets that PC's name.
      const fresh = picked && performance.now() - picked.at < freshMs;
      name = fresh && picked ? picked.name : "";
      dialog.dataset.ncClient = name;
      if (fresh) picked = null;
    }
    if (!name) continue;
    const message = dialog.querySelector(".q-dialog__message") ?? dialog.querySelector(".q-dialog__title");
    if (!message) continue;

    let client = dialog.querySelector<HTMLElement>(".nc-dialog-client");
    if (!client) {
      client = clientRow(root, name);
      message.after(client);
    }
    const existing = dialog.querySelector<HTMLElement>(".nc-dialog-visit");
    const row = visitRow(root, existing, visits.get(name));
    if (row && !row.isConnected) client.after(row);
  }
}

export const clientDialog: Patch = {
  id: "client-dialog",
  apply: paint,
};
