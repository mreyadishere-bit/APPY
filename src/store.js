/* ============================================================
   APPY — on-device storage
   Folders → books → entries, kept in IndexedDB on this device.
   Nothing leaves the browser. No account, no server, no sync.
   ============================================================ */

(function (global) {
  "use strict";

  var DB_NAME = "appy";
  var DB_VERSION = 1;
  var STORES = ["folders", "books", "entries"];
  var dbPromise = null;

  function openDb() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise(function (resolve, reject) {
      if (!global.indexedDB) {
        reject(new Error("This browser has no IndexedDB, so APPY cannot store a diary here."));
        return;
      }

      var request = global.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = function (event) {
        var db = event.target.result;

        if (!db.objectStoreNames.contains("folders")) {
          db.createObjectStore("folders", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("books")) {
          var books = db.createObjectStore("books", { keyPath: "id" });
          books.createIndex("folderId", "folderId", { unique: false });
        }
        if (!db.objectStoreNames.contains("entries")) {
          var entries = db.createObjectStore("entries", { keyPath: "id" });
          entries.createIndex("bookId", "bookId", { unique: false });
        }
      };

      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error || new Error("Could not open the diary.")); };
      request.onblocked = function () { reject(new Error("Another APPY tab is holding the diary open. Close it and try again.")); };
    });

    return dbPromise;
  }

  function uid() {
    if (global.crypto && typeof global.crypto.randomUUID === "function") {
      return global.crypto.randomUUID();
    }
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  /* One transaction over one or more stores. `work` receives the store map
     and may return a request whose result is handed back. */
  function run(storeNames, mode, work) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var names = Array.isArray(storeNames) ? storeNames : [storeNames];
        var tx = db.transaction(names, mode);
        var stores = {};
        names.forEach(function (name) { stores[name] = tx.objectStore(name); });

        var result;
        var request = work(stores);
        if (request) {
          request.onsuccess = function () { result = request.result; };
        }

        tx.oncomplete = function () { resolve(result); };
        tx.onerror = function () { reject(tx.error); };
        tx.onabort = function () { reject(tx.error); };
      });
    });
  }

  function getAll(storeName) {
    return run(storeName, "readonly", function (s) { return s[storeName].getAll(); })
      .then(function (rows) { return rows || []; });
  }

  function put(storeName, value) {
    return run(storeName, "readwrite", function (s) { return s[storeName].put(value); })
      .then(function () { return value; });
  }

  function remove(storeName, id) {
    return run(storeName, "readwrite", function (s) { return s[storeName].delete(id); });
  }

  function byOldestFirst(a, b) {
    return (a.createdAt || 0) - (b.createdAt || 0);
  }

  function byNewestEntryFirst(a, b) {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return (b.createdAt || 0) - (a.createdAt || 0);
  }

  /* ---------- folders ---------- */

  function listFolders() {
    return getAll("folders").then(function (rows) { return rows.sort(byOldestFirst); });
  }

  function createFolder(name) {
    var folder = {
      id: uid(),
      name: String(name || "").trim() || "Untitled folder",
      createdAt: Date.now()
    };
    return put("folders", folder);
  }

  function renameFolder(id, name) {
    return listFolders().then(function (folders) {
      var folder = folders.filter(function (f) { return f.id === id; })[0];
      if (!folder) throw new Error("That folder no longer exists.");
      folder.name = String(name || "").trim() || folder.name;
      return put("folders", folder);
    });
  }

  /* Deleting a folder takes its books, and their entries, with it. */
  function deleteFolder(id) {
    return run(STORES, "readwrite", function (s) {
      var bookReq = s.books.getAll();
      bookReq.onsuccess = function () {
        var doomed = bookReq.result.filter(function (b) { return b.folderId === id; });
        var doomedIds = doomed.map(function (b) { return b.id; });

        var entryReq = s.entries.getAll();
        entryReq.onsuccess = function () {
          entryReq.result.forEach(function (entry) {
            if (doomedIds.indexOf(entry.bookId) !== -1) s.entries.delete(entry.id);
          });
        };

        doomed.forEach(function (b) { s.books.delete(b.id); });
      };

      return s.folders.delete(id);
    });
  }

  /* ---------- books ---------- */

  function listBooks() {
    return getAll("books").then(function (rows) { return rows.sort(byOldestFirst); });
  }

  function createBook(folderId, title) {
    var book = {
      id: uid(),
      folderId: folderId,
      title: String(title || "").trim() || "Untitled book",
      createdAt: Date.now()
    };
    return put("books", book);
  }

  function renameBook(id, title) {
    return listBooks().then(function (books) {
      var book = books.filter(function (b) { return b.id === id; })[0];
      if (!book) throw new Error("That book no longer exists.");
      book.title = String(title || "").trim() || book.title;
      return put("books", book);
    });
  }

  function deleteBook(id) {
    return run(["books", "entries"], "readwrite", function (s) {
      var entryReq = s.entries.getAll();
      entryReq.onsuccess = function () {
        entryReq.result.forEach(function (entry) {
          if (entry.bookId === id) s.entries.delete(entry.id);
        });
      };
      return s.books.delete(id);
    });
  }

  /* ---------- entries ---------- */

  function listEntries(bookId) {
    return getAll("entries").then(function (rows) {
      return rows
        .filter(function (e) { return e.bookId === bookId; })
        .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    });
  }

  function listAllEntries() {
    return getAll("entries").then(function (rows) { return rows.sort(byNewestEntryFirst); });
  }

  function createEntry(bookId, date, text) {
    var entry = {
      id: uid(),
      bookId: bookId,
      date: date,
      text: String(text || ""),
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    return put("entries", entry);
  }

  function updateEntry(entry) {
    entry.updatedAt = Date.now();
    return put("entries", entry);
  }

  function deleteEntry(id) {
    return remove("entries", id);
  }

  /* ---------- whole diary ---------- */

  function exportAll() {
    return Promise.all([listFolders(), listBooks(), getAll("entries")]).then(function (parts) {
      return {
        app: "APPY",
        version: 1,
        exportedAt: new Date().toISOString(),
        folders: parts[0],
        books: parts[1],
        entries: parts[2]
      };
    });
  }

  function clearAll() {
    return run(STORES, "readwrite", function (s) {
      s.folders.clear();
      s.books.clear();
      return s.entries.clear();
    });
  }

  function importAll(data) {
    if (!data || data.app !== "APPY" || !Array.isArray(data.folders) ||
        !Array.isArray(data.books) || !Array.isArray(data.entries)) {
      return Promise.reject(new Error("That file is not an APPY backup."));
    }

    return clearAll().then(function () {
      return run(STORES, "readwrite", function (s) {
        data.folders.forEach(function (f) { s.folders.put(f); });
        data.books.forEach(function (b) { s.books.put(b); });
        data.entries.forEach(function (e) { s.entries.put(e); });
      });
    });
  }

  /* Counts for the library summary. */
  function summary() {
    return Promise.all([getAll("folders"), getAll("books"), getAll("entries")])
      .then(function (parts) {
        return {
          folders: parts[0].length,
          books: parts[1].length,
          entries: parts[2].length
        };
      });
  }

  global.AppyStore = {
    available: function () {
      return openDb().then(function () { return true; }).catch(function () { return false; });
    },
    listFolders: listFolders,
    createFolder: createFolder,
    renameFolder: renameFolder,
    deleteFolder: deleteFolder,
    listBooks: listBooks,
    createBook: createBook,
    renameBook: renameBook,
    deleteBook: deleteBook,
    listEntries: listEntries,
    listAllEntries: listAllEntries,
    createEntry: createEntry,
    updateEntry: updateEntry,
    deleteEntry: deleteEntry,
    exportAll: exportAll,
    importAll: importAll,
    clearAll: clearAll,
    summary: summary,
    uid: uid
  };
})(window);
