import { autoClean, autoCleanMinutes, cleanMinutes, darkTheme, settings, showThemeButton } from "../settings";
import type { Patch } from "./types";

function onAccountPage(): boolean {
  return (
    location.hostname === "admin.netconsole.me" &&
    (location.pathname === "/me" || location.pathname === "/me/")
  );
}

function bindTablist(tablist: HTMLElement): void {
  if (tablist.dataset.ncBound === "1") return;
  tablist.dataset.ncBound = "1";
  tablist.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const tab = target.closest("[role=tab]");
    if (!tab || tab.hasAttribute("data-nc-tab")) return;
    delete document.documentElement.dataset.ncAccount;
  });
}

function accountTab(): HTMLDivElement {
  const tab = document.createElement("div");
  tab.dataset.ncTab = "1";
  tab.className =
    "q-tab relative-position self-stretch flex flex-center text-center q-tab--no-caps q-focusable q-hoverable cursor-pointer !justify-start !pl-4 !py-3";
  tab.role = "tab";
  tab.tabIndex = 0;
  tab.innerHTML =
    '<div class="q-focus-helper"></div><div class="q-tab__content self-stretch flex-center relative-position q-anchor--skip non-selectable row no-wrap q-tab__content--inline"><i class="q-icon notranslate material-icons q-tab__icon" aria-hidden="true">extension</i><div class="q-tab__label">Netconsole</div></div><div class="q-tab__indicator absolute-right"></div>';
  tab.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    document.documentElement.dataset.ncAccount = "open";
  });
  return tab;
}

function switchRow(
  title: string,
  detail: string,
  pressed: boolean,
  onClick: () => void,
): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "nc-row";
  const copy = document.createElement("div");
  const heading = document.createElement("strong");
  heading.textContent = title;
  const text = document.createElement("span");
  text.textContent = detail;
  copy.append(heading, text);
  const button = document.createElement("button");
  button.type = "button";
  button.className = "nc-switch";
  button.setAttribute("role", "switch");
  button.setAttribute("aria-checked", pressed ? "true" : "false");
  button.setAttribute("aria-label", title);
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClick();
  });
  row.append(copy, button);
  return row;
}

function minutesRow(title: string, detail: string): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "nc-row";
  const copy = document.createElement("div");
  const heading = document.createElement("strong");
  heading.textContent = title;
  const text = document.createElement("span");
  text.textContent = detail;
  copy.append(heading, text);
  const field = document.createElement("label");
  field.className = "nc-minutes";
  const input = document.createElement("input");
  input.type = "number";
  input.min = "1";
  input.max = "1440";
  input.step = "1";
  input.value = String(settings.autoCleanMinutes);
  input.setAttribute("aria-label", title);
  input.addEventListener("change", () => {
    const minutes = cleanMinutes(input.value);
    input.value = String(minutes);
    void autoCleanMinutes.setValue(minutes);
  });
  const unit = document.createElement("span");
  unit.textContent = "min";
  field.append(input, unit);
  row.append(copy, field);
  return row;
}

function accountPanel(): HTMLElement {
  const panel = document.createElement("section");
  panel.dataset.ncAccount = "1";
  panel.className = "nc-account";
  const heading = document.createElement("h2");
  heading.textContent = "Netconsole";
  const intro = document.createElement("p");
  intro.textContent =
    "Browser extension for the netconsole admin sites, version 0.1.0. It changes the page in this browser only. PCAdmin keeps the theme switch it already has.";
  panel.append(heading, intro);
  panel.append(
    switchRow(
      "Dark theme",
      "Dark surfaces on the other netconsole apps.",
      settings.darkTheme,
      () => {
        void darkTheme.setValue(!settings.darkTheme);
      },
    ),
    switchRow(
      "Theme button",
      "Show the theme button in the header, next to the apps menu.",
      settings.showThemeButton,
      () => {
        void showThemeButton.setValue(!settings.showThemeButton);
      },
    ),
    switchRow(
      "Auto clean PC tasks",
      "On eplay, mark every PC clean task as done on a timer. Help requests and other tasks are left alone. Runs while an eplay tab is open.",
      settings.autoClean,
      () => {
        void autoClean.setValue(!settings.autoClean);
      },
    ),
    minutesRow("Clean every", "How often the auto clean runs, in minutes."),
  );
  return panel;
}

export const account: Patch = {
  id: "account",
  apply(root) {
    if (!onAccountPage()) {
      root.querySelector("[data-nc-tab]")?.remove();
      root.querySelector("[data-nc-account]")?.remove();
      delete root.documentElement.dataset.ncAccount;
      return;
    }

    const tablist = root.querySelector<HTMLElement>(
      ".q-tabs--vertical .q-tabs__content",
    );
    const panels = root.querySelector(".q-tab-panels");
    if (!tablist || !panels?.parentElement) return;

    bindTablist(tablist);
    if (!tablist.querySelector("[data-nc-tab]")) tablist.append(accountTab());
    if (!panels.parentElement.querySelector("[data-nc-account]")) {
      panels.after(accountPanel());
    }

    const open = root.documentElement.dataset.ncAccount === "open";
    const tab = tablist.querySelector<HTMLElement>("[data-nc-tab]");
    if (tab) {
      tab.classList.toggle("q-tab--active", open);
      tab.classList.toggle("q-tab--inactive", !open);
      tab.setAttribute("aria-selected", open ? "true" : "false");
    }

    const section = panels.parentElement.querySelector("[data-nc-account]");
    if (!(section instanceof HTMLElement)) return;
    const rows = section.querySelectorAll<HTMLButtonElement>(".nc-switch");
    const states = [settings.darkTheme, settings.showThemeButton, settings.autoClean];
    rows.forEach((row, index) => row.setAttribute("aria-checked", states[index] ? "true" : "false"));
    const minutes = section.querySelector<HTMLInputElement>(".nc-minutes input");
    if (minutes && document.activeElement !== minutes) {
      minutes.value = String(settings.autoCleanMinutes);
      minutes.disabled = !settings.autoClean;
    }
  },
};
