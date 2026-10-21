/* ============================================================
   APPY — storage
   IndexedDB, one database, four object stores. Every write is a
   transaction; every failure comes back as a StorageError with a
   code the interface can explain in plain words.
   ============================================================ */

const DB_NAME = "appy";
const VERSION = 2;

export const STORES = ["books", "folders", "entries", "meta"];

export class StorageError extends Error {
  constructor(message, code = "unknown", cause) {
    super(message);
    this.name = "StorageError";
    this.code = code;
    this.cause = cause;
  }
}

function wrapError(error) {
  if (error instanceof StorageError) return error;

  const name = error?.name || "";
  if (name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED") {
    return new StorageError(
      "This device has no room left for the diary. Export a backup, then free some space.",
      "quota",
      error
    );
  }
  if (name === "InvalidStateError" || name === "NotFoundError") {
    return new StorageError("The diary could not be reached. Reloading usually fixes it.", "state", error);
  }
  return new StorageError("Your diary could not be saved. Please try again.", "unknown", error);
}

let dbPromise = null;

/* A tiny write should take milliseconds. If a write transaction sits this
   long without completing, it is wedged (often by another tab holding the
   database). Abort it and try once more instead of leaving the interface
   on "Working…" forever. Reads get a much longer leash because a large
   diary can legitimately take a while to load. */
const WRITE_TIMEOUT = 4000;
const READ_TIMEOUT = 20000;

/* Bulk operations (import, emptying a big trash) legitimately need longer;
   give them a few milliseconds per row, capped so a true stall still ends. */
function bulkTimeout(count) {
  return Math.min(WRITE_TIMEOUT + count * 2, 30000);
}

function forgetDatabase(db = null) {
  dbPromise = null;
  if (db) {
    try {
      db.close();
    } catch {
      /* already closed */
    }
  }
}

function openDatabase() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(
        new StorageError(
          "This browser cannot store a diary. Private windows sometimes block storage, and some browsers disable it entirely.",
          "unavailable"
        )
      );
      return;
    }

    let request;
    try {
      request = indexedDB.open(DB_NAME, VERSION);
    } catch (error) {
      reject(wrapError(error));
      return;
    }

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const oldVersion = event.oldVersion;

      if (!db.objectStoreNames.contains("folders")) {
        db.createObjectStore("folders", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("books")) {
        const books = db.createObjectStore("books", { keyPath: "id" });
        books.createIndex("updatedAt", "updatedAt");
      }
      if (!db.objectStoreNames.contains("entries")) {
        const entries = db.createObjectStore("entries", { keyPath: "id" });
        entries.createIndex("bookId", "bookId");
        entries.createIndex("date", "date");
        entries.createIndex("updatedAt", "updatedAt");
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }

      // Version 1 could leave these missing; add them without touching data.
      if (oldVersion < 2) {
        const tx = request.transaction;
        if (tx) {
          const books = tx.objectStore("books");
          if (!books.indexNames.contains("updatedAt")) books.createIndex("updatedAt", "updatedAt");
          const entries = tx.objectStore("entries");
          ["bookId", "date", "updatedAt"].forEach((name) => {
            if (!entries.indexNames.contains(name)) entries.createIndex(name, name);
          });
        }
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      // If another tab asks for a newer schema, close this connection and
      // make the next operation open a fresh one.
      db.onversionchange = () => forgetDatabase(db);
      db.onclose = () => {
        if (dbPromise) dbPromise = null;
      };
      resolve(db);
    };

    request.onerror = () => {
      dbPromise = null;
      reject(wrapError(request.error));
    };
    request.onblocked = () =>
      reject(
        new StorageError(
          "Another APPY tab is holding the diary open. Close it, then try again.",
          "blocked"
        )
      );
  });

  return dbPromise;
}

function transact(storeNames, mode, work, options = {}) {
  const names = Array.isArray(storeNames) ? storeNames : [storeNames];
  const attempt = options.attempt || 0;
  const limit = options.timeout || (mode === "readwrite" ? WRITE_TIMEOUT : READ_TIMEOUT);

  return openDatabase()
    .then(
      (db) =>
        new Promise((resolve, reject) => {
          let tx;
          try {
            tx = db.transaction(names, mode);
          } catch (error) {
            if (error?.name === "InvalidStateError") forgetDatabase(db);
            reject(wrapError(error));
            return;
          }

          const stores = {};
          names.forEach((name) => {
            stores[name] = tx.objectStore(name);
          });

          let request = null;
          let settled = false;
          let timer = 0;

          const settle = (callback, value) => {
            if (settled) return;
            settled = true;
            if (timer) clearTimeout(timer);
            callback(value);
          };

          timer = setTimeout(() => {
            console.warn("APPY: diary transaction timed out", { stores: names, mode, attempt });
            try {
              tx.abort();
            } catch {
              /* already finished */
            }
            settle(
              reject,
              new StorageError(
                "The diary stopped responding. Close other APPY tabs or reload the page, then try again.",
                "timeout"
              )
            );
          }, limit);

          // Attach these before issuing the request: the transaction can
          // never complete without these handlers being in place.
          tx.oncomplete = () =>
            settle(resolve, request && "result" in request ? request.result : undefined);
          tx.onerror = () => settle(reject, wrapError(tx.error));
          tx.onabort = () => settle(reject, wrapError(tx.error));

          try {
            request = work(stores, tx);
          } catch (error) {
            try {
              tx.abort();
            } catch {
              /* already gone */
            }
            settle(reject, wrapError(error));
          }
        })
    )
    .catch((error) => {
      // A stalled transaction was aborted; try once more on the same
      // connection. The work is replayed with the same values and keys,
      // so a late commit cannot produce a duplicate.
      if (attempt === 0 && error?.code === "timeout") {
        return transact(storeNames, mode, work, { attempt: 1, timeout: limit });
      }
      throw error;
    });
}

export const db = {
  open: openDatabase,

  getAll(store) {
    return transact(store, "readonly", (stores) => stores[store].getAll()).then(
      (rows) => rows || []
    );
  },

  get(store, key) {
    return transact(store, "readonly", (stores) => stores[store].get(key));
  },

  put(store, value) {
    return transact(store, "readwrite", (stores) => stores[store].put(value)).then(
      () => value
    );
  },

  putMany(store, values) {
    if (!values.length) return Promise.resolve([]);
    return transact(
      store,
      "readwrite",
      (stores) => {
        values.forEach((value) => stores[store].put(value));
        return null;
      },
      { timeout: bulkTimeout(values.length) }
    ).then(() => values);
  },

  remove(store, key) {
    return transact(store, "readwrite", (stores) => stores[store].delete(key));
  },

  removeMany(store, keys) {
    if (!keys.length) return Promise.resolve();
    return transact(
      store,
      "readwrite",
      (stores) => {
        keys.forEach((key) => stores[store].delete(key));
        return null;
      },
      { timeout: bulkTimeout(keys.length) }
    );
  },

  clear(store) {
    return transact(store, "readwrite", (stores) => stores[store].clear());
  },

  /** Wipe every store in one transaction. */
  clearAll() {
    return transact(STORES, "readwrite", (stores) => {
      stores.entries.clear();
      stores.books.clear();
      stores.folders.clear();
      stores.meta.clear();
      return null;
    });
  },

  async all() {
    const [books, folders, entries] = await Promise.all([
      db.getAll("books"),
      db.getAll("folders"),
      db.getAll("entries"),
    ]);
    return { books, folders, entries };
  },

  async getMeta(key, fallback = null) {
    const row = await db.get("meta", key);
    return row ? row.value : fallback;
  },

  setMeta(key, value) {
    return db.put("meta", { key, value });
  },

  /** How much room the browser has given us, if it will say. */
  async estimate() {
    if (!navigator.storage?.estimate) return null;
    try {
      const { usage = 0, quota = 0 } = await navigator.storage.estimate();
      return { usage, quota };
    } catch {
      return null;
    }
  },

  /** Ask the browser not to evict this origin under storage pressure. */
  async requestPersistence() {
    if (!navigator.storage?.persist) return "unsupported";
    try {
      const already = navigator.storage.persisted ? await navigator.storage.persisted() : false;
      if (already) return "granted";
      return (await navigator.storage.persist()) ? "granted" : "denied";
    } catch {
      return "denied";
    }
  },

  async persistenceState() {
    if (!navigator.storage?.persisted) return "unsupported";
    try {
      return (await navigator.storage.persisted()) ? "granted" : "denied";
    } catch {
      return "unsupported";
    }
  },
};

export function describeError(error) {
  if (error instanceof StorageError) return error.message;
  return "Something went wrong. Please try again.";
}
