import { storage } from "wxt/utils/storage";

export const darkTheme = storage.defineItem<boolean>("local:darkTheme", {
  fallback: false,
});

export const showThemeButton = storage.defineItem<boolean>("local:showThemeButton", {
  fallback: true,
});

export const settings = {
  darkTheme: false,
  showThemeButton: true,
};

export async function loadSettings(): Promise<void> {
  settings.darkTheme = await darkTheme.getValue();
  settings.showThemeButton = await showThemeButton.getValue();
}

export function watchSettings(onChange: () => void): () => void {
  const stopDark = darkTheme.watch((value) => {
    settings.darkTheme = value;
    onChange();
  });
  const stopButton = showThemeButton.watch((value) => {
    settings.showThemeButton = value;
    onChange();
  });
  return () => {
    stopDark();
    stopButton();
  };
}
