import { darkTheme, settings } from "../settings";
import type { Patch } from "./types";

const ownThemeHosts = new Set(["pcadmin.netconsole.me"]);
const brandNavy = "#0c2556";

function rememberColor(root: Document, name: "--q-primary" | "--q-secondary"): string {
  const key = name === "--q-primary" ? "ncPrimary" : "ncSecondary";
  const html = root.documentElement;
  const saved = html.dataset[key];
  if (saved) return saved;
  const value = getComputedStyle(html).getPropertyValue(name).trim().toLowerCase();
  if (value) html.dataset[key] = value;
  return value;
}

function syncBrand(root: Document, dark: boolean): void {
  const html = root.documentElement;
  const primary = rememberColor(root, "--q-primary");
  const secondary = rememberColor(root, "--q-secondary");
  html.classList.toggle("nc-brand-navy", dark && primary === brandNavy);
  html.classList.toggle("nc-brand-navy-2", dark && secondary === brandNavy);
}

function quasarApp(root: Document): boolean {
  return root.querySelector("#q-app") !== null;
}

function usesOwnTheme(root: Document): boolean {
  return (
    ownThemeHosts.has(location.hostname) ||
    root.querySelector(".theme-toggle-btn") !== null
  );
}

function findAppsButton(root: Document): HTMLButtonElement | null {
  for (const icon of root.querySelectorAll(".q-header i.q-icon")) {
    if (icon.textContent?.trim() !== "apps") continue;
    const button = icon.closest("button");
    if (button) return button;
  }
  return null;
}

function themeButton(): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.ncThemeBtn = "1";
  button.className =
    "q-btn q-btn-item non-selectable no-outline q-btn--flat q-btn--round q-btn--actionable q-focusable q-hoverable q-btn--dense nc-theme-btn";
  button.innerHTML =
    '<span class="q-focus-helper"></span><span class="q-btn__content text-center col items-center q-anchor--skip justify-center row"><i class="q-icon notranslate material-icons" aria-hidden="true">dark_mode</i></span>';
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void darkTheme.setValue(!settings.darkTheme);
  });
  return button;
}

export const theme: Patch = {
  id: "theme",
  apply(root) {
    const quasar = quasarApp(root);
    const own = usesOwnTheme(root);
    const dark = settings.darkTheme && quasar && !own;

    root.documentElement.classList.toggle("nc-dark", dark);
    syncBrand(root, dark && quasar && !own);
    if (quasar && !own) {
      root.body.classList.toggle("body--dark", dark);
      root.body.classList.toggle("body--light", !dark);
    }

    if (!quasar || own || !settings.showThemeButton) {
      root.querySelector("[data-nc-theme-btn]")?.remove();
      return;
    }

    const iconName = dark ? "light_mode" : "dark_mode";
    const existing = root.querySelector<HTMLButtonElement>("[data-nc-theme-btn]");
    if (existing) {
      const icon = existing.querySelector("i");
      if (icon && icon.textContent !== iconName) icon.textContent = iconName;
      const title = dark ? "Light theme" : "Dark theme";
      if (existing.title !== title) existing.title = title;
      return;
    }

    const apps = findAppsButton(root);
    if (!apps) return;
    const button = themeButton();
    button.title = dark ? "Light theme" : "Dark theme";
    const icon = button.querySelector("i");
    if (icon) icon.textContent = iconName;
    apps.before(button);
  },
};
