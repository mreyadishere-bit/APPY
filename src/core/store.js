/* ============================================================
   APPY — application state
   The database is the truth; this module keeps a warm copy of it
   in memory so views can render synchronously, and owns every
   mutation so the two never drift.
   ============================================================ */

import { db, StorageError } from "./db.js";
import { loadSettings, saveSettings, DEFAULT_SETTINGS } from "./settings.js";
import {
  SCHEMA,
  emptyEntry,
  normalizeBook,
  normalizeEntry,
  normalizeFolder,
  todayISO,
  wordCount,
} from "./model.js";

const listeners = new Set();

export const state = {
  ready: false,
  books: [],
  folders: [],
  entries: [],
  settings: { ...DEFAULT_SETTINGS },
  counts: { books: 0, folders: 0, entries: 0, words: 0 },
};

function emit(reason) {
  recount();
  listeners.forEach((listener) => {
    try {
      listener(reason);
    } catch (error) {
      console.error("APPY listener failed", error);
    }
  });
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function recount() {
  const live = state.entries.filter((entry) => !entry.deletedAt);
  state.counts = {
    books: state.books.length,
    folders: state.folders.length,
    entries: live.length,
    words: live.reduce((total, entry) => total + wordCount(entry.body), 0),
  };
}

/* ---------- queries (synchronous, from memory) ---------- */

export const books = () => state.books;
export const folders = () => state.folders;
export const bookById = (id) => state.books.find((book) => book.id === id) || null;
export const folderById = (id) => state.folders.find((folder) => folder.id === id) || null;
export const entryById = (id) => state.entries.find((entry) => entry.id === id) || null;

export function entriesIn({ bookId = null, folderId = null, sort = "newest", includeDeleted = false } = {}) {
  let rows = state.entries.filter((entry) => includeDeleted || !entry.deletedAt);
  if (bookId) rows = rows.filter((entry) => entry.bookId === bookId);
  if (folderId) rows = rows.filter((entry) => entry.folderId === folderId);

  rows.sort((a, b) => {
    if (sort === "oldest") return a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt;
    if (sort === "updated") return b.updatedAt - a.updatedAt;
    return a.date > b.date ? -1 : a.date < b.date ? 1 : b.createdAt - a.createdAt;
  });

  return rows;
}

export const liveEntries = () => entriesIn({});

export function recentEntries(limit = 4) {
  return [...state.entries.filter((entry) => !entry.deletedAt)]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit);
}

export function entriesOnDate(iso) {
  return entriesIn({ sort: "oldest" }).filter((entry) => entry.date === iso);
}

export function entriesByMonth() {
  const groups = new Map();
  for (const entry of entriesIn({ sort: "oldest" })) {
    const key = entry.date.slice(0, 7);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }
  return groups;
}

export function bookStats(bookId) {
  const rows = state.entries.filter((entry) => entry.bookId === bookId && !entry.deletedAt);
  const words = rows.reduce((total, entry) => total + wordCount(entry.body), 0);
  const dates = rows.map((entry) => entry.date).sort();
  return {
    entries: rows.length,
    words,
    first: dates[0] || null,
    last: dates[dates.length - 1] || null,
  };
}

export function folderCount(folderId) {
  return state.entries.filter((entry) => entry.folderId === folderId && !entry.deletedAt).length;
}

export function trashedEntries() {
  return [...state.entries]
    .filter((entry) => entry.deletedAt)
    .sort((a, b) => b.deletedAt - a.deletedAt);
}

export function bookOptions() {
  return [...state.books].sort((a, b) => a.title.localeCompare(b.title));
}

export const settings = () => state.settings;

/* ---------- boot ---------- */

export async function init() {
  state.settings = loadSettings();

  const [rawBooks, rawFolders, rawEntries] = await Promise.all([
    db.getAll("books"),
    db.getAll("folders"),
    db.getAll("entries"),
  ]);

  const schema = await db.getMeta("schema", 1);
  const needsMigration = Number(schema) < SCHEMA;

  state.books = rawBooks.map(normalizeBook);
  state.folders = rawFolders.map(normalizeFolder);
  state.entries = rawEntries.map(normalizeEntry);

  if (needsMigration) await migrateV1();

  state.books.sort((a, b) => b.updatedAt - a.updatedAt);
  state.folders.sort((a, b) => a.createdAt - b.createdAt);

  state.ready = true;
  emit("init");
  return state;
}

/** Version 1 stored the folder on the book. Version 2 files entries. */
async function migrateV1() {
  const changed = [];
  const bookFolder = new Map();

  state.books.forEach((book) => {
    if (book.folderId) {
      bookFolder.set(book.id, book.folderId);
      delete book.folderId;
      changed.push(book);
    }
  });

  if (bookFolder.size) {
    state.entries.forEach((entry) => {
      const folderId = bookFolder.get(entry.bookId);
      if (folderId && !entry.folderId) {
        entry.folderId = folderId;
        changed.push(entry);
      }
    });
  }

  if (changed.length) {
    const booksToWrite = changed.filter((row) => state.books.includes(row));
    const entriesToWrite = changed.filter((row) => state.entries.includes(row));
    if (booksToWrite.length) await db.putMany("books", booksToWrite);
    if (entriesToWrite.length) await db.putMany("entries", entriesToWrite);
  }

  await db.setMeta("schema", SCHEMA);
}

/* ---------- entries ---------- */

export async function saveEntry(input, { silent = false } = {}) {
  const existing = input.id ? entryById(input.id) : null;
  const entry = normalizeEntry({
    ...input,
    createdAt: existing?.createdAt || input.createdAt || Date.now(),
    updatedAt: Date.now(),
    deletedAt: null,
  });

  if (!entry.bookId) throw new Error("An entry needs a book.");

  await db.put("entries", entry);
  upsert(state.entries, entry);

  const book = bookById(entry.bookId);
  if (book) {
    const touched = { ...book, updatedAt: entry.updatedAt };
    await db.put("books", touched);
    upsert(state.books, touched);
    state.books.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  rememberLast({ lastEntryId: entry.id, lastBookId: entry.bookId });
  if (!silent) emit("entry:saved");
  else recount();
  return entry;
}

export async function createEntryFor(bookId, overrides = {}) {
  const entry = normalizeEntry({
    ...emptyEntry(bookId, overrides.folderId ?? null),
    date: overrides.date || todayISO(),
    ...overrides,
  });
  return saveEntry(entry);
}

export async function trashEntry(id) {
  const entry = entryById(id);
  if (!entry) return;
  const next = { ...entry, deletedAt: Date.now() };
  await db.put("entries", next);
  upsert(state.entries, next);
  emit("entry:trashed");
}

export async function restoreEntry(id) {
  const entry = entryById(id);
  if (!entry) return;

  // The book may have been deleted while the entry was in the trash. A
  // restored entry must land somewhere real, or it would be invisible.
  let bookId = entry.bookId;
  if (!bookById(bookId)) {
    const fallback = state.books[0];
    bookId = fallback ? fallback.id : (await createBook({ title: "Recovered entries" })).id;
  }

  const next = { ...entry, bookId, deletedAt: null, updatedAt: Date.now() };
  await db.put("entries", next);
  upsert(state.entries, next);
  emit("entry:restored");
}

export async function purgeEntry(id) {
  await db.remove("entries", id);
  state.entries = state.entries.filter((entry) => entry.id !== id);
  emit("entry:purged");
}

export async function emptyTrash() {
  const ids = trashedEntries().map((entry) => entry.id);
  await db.removeMany("entries", ids);
  state.entries = state.entries.filter((entry) => !entry.deletedAt);
  emit("trash:emptied");
}

export async function moveEntry(id, { bookId, folderId }) {
  const entry = entryById(id);
  if (!entry) return;
  const next = {
    ...entry,
    bookId: bookId || entry.bookId,
    folderId: folderId === undefined ? entry.folderId : folderId,
    updatedAt: Date.now(),
  };
  await db.put("entries", next);
  upsert(state.entries, next);
  emit("entry:moved");
}

/* ---------- books ---------- */

export async function createBook({ title, subtitle = "", cover } = {}) {
  const book = normalizeBook({ title, subtitle, cover, createdAt: Date.now(), updatedAt: Date.now() });
  await db.put("books", book);
  state.books.push(book);
  state.books.sort((a, b) => b.updatedAt - a.updatedAt);
  rememberLast({ lastBookId: book.id });
  emit("book:created");
  return book;
}

export async function updateBook(id, patch) {
  const book = bookById(id);
  if (!book) return null;
  const next = normalizeBook({ ...book, ...patch, id, updatedAt: Date.now() });
  await db.put("books", next);
  upsert(state.books, next);
  emit("book:updated");
  return next;
}

/** Deleting a book never destroys writing: entries move, or they go to the trash. */
export async function deleteBook(id, { moveEntriesTo = null } = {}) {
  const rows = state.entries.filter((entry) => entry.bookId === id);
  const live = rows.filter((entry) => !entry.deletedAt);
  if (live.length && !moveEntriesTo) {
    throw new Error("This book still has entries. Choose where they should go.");
  }

  if (rows.length) {
    const now = Date.now();
    const next = rows.map((entry) => {
      if (moveEntriesTo === "trash") {
        return entry.deletedAt ? entry : { ...entry, deletedAt: now };
      }
      // Entries already in the trash move too, so restoring them later
      // still finds a book.
      return { ...entry, bookId: moveEntriesTo, updatedAt: now };
    });
    await db.putMany("entries", next);
    next.forEach((entry) => upsert(state.entries, entry));
  }

  await db.remove("books", id);
  state.books = state.books.filter((book) => book.id !== id);

  if (state.settings.lastBookId === id) rememberLast({ lastBookId: null });

  emit("book:deleted");
}

/* ---------- folders ---------- */

export async function createFolder({ name, color } = {}) {
  const folder = normalizeFolder({ name, color, createdAt: Date.now() });
  await db.put("folders", folder);
  state.folders.push(folder);
  emit("folder:created");
  return folder;
}

export async function updateFolder(id, patch) {
  const folder = folderById(id);
  if (!folder) return null;
  const next = normalizeFolder({ ...folder, ...patch, id });
  await db.put("folders", next);
  upsert(state.folders, next);
  emit("folder:updated");
  return next;
}

/** Removing a folder never removes writing — the entries simply come unfiled. */
export async function deleteFolder(id) {
  const rows = state.entries.filter((entry) => entry.folderId === id);
  if (rows.length) {
    const next = rows.map((entry) => ({ ...entry, folderId: null }));
    await db.putMany("entries", next);
    next.forEach((entry) => upsert(state.entries, entry));
  }
  await db.remove("folders", id);
  state.folders = state.folders.filter((folder) => folder.id !== id);
  emit("folder:deleted");
}

/* ---------- preferences ---------- */

export function updateSettings(patch, { silent = false } = {}) {
  state.settings = saveSettings({ ...state.settings, ...patch });
  if (!silent) emit("settings");
  return state.settings;
}

function rememberLast(patch) {
  state.settings = saveSettings({ ...state.settings, ...patch });
}

/* ---------- backup ---------- */

export async function exportAll() {
  const [rawBooks, rawFolders, rawEntries] = await Promise.all([
    db.getAll("books"),
    db.getAll("folders"),
    db.getAll("entries"),
  ]);

  return {
    app: "APPY",
    schema: SCHEMA,
    exportedAt: new Date().toISOString(),
    books: rawBooks.map(normalizeBook),
    folders: rawFolders.map(normalizeFolder),
    entries: rawEntries.map(normalizeEntry),
  };
}

export function validateBackup(data) {
  if (!data || typeof data !== "object") return "That file is not an APPY backup.";
  if (data.app !== "APPY") return "That file was not exported by APPY.";
  if (!Array.isArray(data.books) || !Array.isArray(data.entries)) {
    return "That backup is missing its books or entries.";
  }
  if (!Array.isArray(data.folders)) data.folders = [];
  return null;
}

/**
 * mode "replace" wipes the diary first; mode "merge" keeps what is here and
 * adds anything whose id it has not seen. Entries that point at a missing
 * book are given a recovered book rather than dropped.
 */
export async function importAll(data, mode = "replace") {
  const problem = validateBackup(data);
  if (problem) throw new Error(problem);

  const nextBooks = data.books.map(normalizeBook);
  const nextFolders = data.folders.map(normalizeFolder);
  const nextEntries = data.entries.map(normalizeEntry);

  if (mode === "replace") {
    await db.clearAll();
    state.books = nextBooks;
    state.folders = nextFolders;
    state.entries = nextEntries;
  } else {
    const bookIds = new Set(state.books.map((book) => book.id));
    const folderIds = new Set(state.folders.map((folder) => folder.id));
    const entryIds = new Set(state.entries.map((entry) => entry.id));

    nextBooks.forEach((book) => {
      if (!bookIds.has(book.id)) {
        state.books.push(book);
        bookIds.add(book.id);
      }
    });
    nextFolders.forEach((folder) => {
      if (!folderIds.has(folder.id)) {
        state.folders.push(folder);
        folderIds.add(folder.id);
      }
    });
    nextEntries.forEach((entry) => {
      if (!entryIds.has(entry.id)) {
        state.entries.push(entry);
        entryIds.add(entry.id);
      }
    });
  }

  // Recover entries whose book did not come with them.
  const knownBooks = new Set(state.books.map((book) => book.id));
  const orphans = state.entries.filter((entry) => !knownBooks.has(entry.bookId));
  if (orphans.length) {
    const recovered = normalizeBook({
      title: "Recovered entries",
      subtitle: "Restored from a backup",
      cover: { style: "linen" },
    });
    state.books.push(recovered);
    orphans.forEach((entry) => {
      entry.bookId = recovered.id;
    });
  }

  const knownFolders = new Set(state.folders.map((folder) => folder.id));
  state.entries.forEach((entry) => {
    if (entry.folderId && !knownFolders.has(entry.folderId)) entry.folderId = null;
  });

  await Promise.all([
    db.putMany("books", state.books),
    db.putMany("folders", state.folders),
    db.putMany("entries", state.entries),
  ]);
  await db.setMeta("schema", SCHEMA);

  state.books.sort((a, b) => b.updatedAt - a.updatedAt);
  emit("imported");
  return {
    books: state.books.length,
    folders: state.folders.length,
    entries: state.entries.filter((entry) => !entry.deletedAt).length,
  };
}

export async function wipeDiary() {
  await db.clearAll();
  state.books = [];
  state.folders = [];
  state.entries = [];
  updateSettings({ lastBookId: null, lastEntryId: null }, { silent: true });
  emit("wiped");
}

function upsert(list, value) {
  const index = list.findIndex((item) => item.id === value.id);
  if (index === -1) list.push(value);
  else list[index] = value;
}

export { StorageError };
