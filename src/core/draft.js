/* ============================================================
   APPY — the draft in the corner
   A small synchronous copy of whatever is currently being typed.
   It exists only for the seconds between a keystroke and the
   IndexedDB write, and is cleared the moment a save lands.
   ============================================================ */

const KEY = "appy:draft";

export function saveDraft(draft) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...draft, at: Date.now() }));
  } catch {
    /* storage full or blocked: the autosave still runs */
  }
}

export function readDraft() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}
