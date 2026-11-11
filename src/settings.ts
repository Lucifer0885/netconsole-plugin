import { storage } from "wxt/utils/storage";

export const darkTheme = storage.defineItem<boolean>("local:darkTheme", {
  fallback: false,
});

export const showThemeButton = storage.defineItem<boolean>("local:showThemeButton", {
  fallback: true,
});

export const autoClean = storage.defineItem<boolean>("local:autoClean", {
  fallback: false,
});

export const autoCleanMinutes = storage.defineItem<number>("local:autoCleanMinutes", {
  fallback: 15,
});

// When any eplay tab last ran the auto clean. Shared so several open tabs don't all clean.
export const lastAutoClean = storage.defineItem<number>("local:lastAutoClean", {
  fallback: 0,
});

export const settings = {
  darkTheme: false,
  showThemeButton: true,
  autoClean: false,
  autoCleanMinutes: 15,
};

export function cleanMinutes(value: unknown): number {
  const minutes = Math.round(Number(value));
  return Number.isFinite(minutes) && minutes >= 1 ? Math.min(minutes, 1440) : 15;
}

export async function loadSettings(): Promise<void> {
  settings.darkTheme = await darkTheme.getValue();
  settings.showThemeButton = await showThemeButton.getValue();
  settings.autoClean = await autoClean.getValue();
  settings.autoCleanMinutes = cleanMinutes(await autoCleanMinutes.getValue());
}

export function watchSettings(onChange: () => void): () => void {
  const stops = [
    darkTheme.watch((value) => {
      settings.darkTheme = value;
      onChange();
    }),
    showThemeButton.watch((value) => {
      settings.showThemeButton = value;
      onChange();
    }),
    autoClean.watch((value) => {
      settings.autoClean = value;
      onChange();
    }),
    autoCleanMinutes.watch((value) => {
      settings.autoCleanMinutes = cleanMinutes(value);
      onChange();
    }),
  ];
  return () => {
    for (const stop of stops) stop();
  };
}
