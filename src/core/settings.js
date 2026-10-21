/* Preferences live in localStorage so the theme can be painted before
   IndexedDB has even opened. Diary content never lives here. */

export const SETTINGS_KEY = "appy:settings";

export const DEFAULT_SETTINGS = {
  theme: "system",
  name: "",
  lastBookId: null,
  lastEntryId: null,
  readerScale: 1,
  readerView: "spread",
  persistAsked: false,
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...(parsed && typeof parsed === "object" ? parsed : {}) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* storage blocked — preferences hold for this session only */
  }
  return settings;
}

export function resolveTheme(pref) {
  if (pref === "light" || pref === "dark") return pref;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function paintTheme(pref) {
  const resolved = resolveTheme(pref);
  document.documentElement.dataset.theme = resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", resolved === "dark" ? "#131210" : "#f5f1e6");
  return resolved;
}
