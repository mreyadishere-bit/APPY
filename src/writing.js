/* ============================================================
   APPY — the writing room
   Folders, books, and entries. Everything is written straight
   to IndexedDB on this device.
   ============================================================ */

(function () {
  "use strict";

  var Store = window.AppyStore;

  var el = function (id) { return document.getElementById(id); };

  var libraryTree = el("libraryTree");
  var librarySummary = el("librarySummary");

  var views = {
    empty: el("emptyView"),
    book: el("bookView"),
    editor: el("editorView")
  };

  var entryList = el("entryList");
  var bookEmpty = el("bookEmpty");
  var bookTitle = el("bookTitle");
  var bookFolder = el("bookFolder");

  var editorFolder = el("editorFolder");
  var editorBook = el("editorBook");
  var entryDate = el("entryDate");
  var entryText = el("entryText");
  var saveStatus = el("saveStatus");
  var deleteEntryBtn = el("deleteEntryBtn");

  var nameDialog = el("nameDialog");
  var nameForm = el("nameForm");
  var nameTitle = el("nameTitle");
  var nameLabel = el("nameLabel");
  var nameInput = el("nameInput");

  var state = {
    folders: [],
    books: [],
    bookId: null,
    entry: null,      // the entry being edited, or a fresh draft
    isNew: false,
    dirty: false
  };

  var saveTimer = null;
  var LAST_BOOK_KEY = "appy-last-book";

  function rememberBook(id) {
    try {
      localStorage.setItem(LAST_BOOK_KEY, id);
    } catch (e) {
      /* storage blocked — the app still works, it just forgets the selection */
    }
  }

  function readLastBook() {
    try {
      return localStorage.getItem(LAST_BOOK_KEY);
    } catch (e) {
      return null;
    }
  }

  /* ---------- dates ---------- */

  function todayISO() {
    var now = new Date();
    var local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function displayDate(iso) {
    if (!iso) return "";
    var parts = iso.split("-").map(Number);
    var date = new Date(parts[0], parts[1] - 1, parts[2]);
    if (isNaN(date.getTime())) return iso;

    var options = { day: "numeric", month: "long" };
    if (date.getFullYear() !== new Date().getFullYear()) options.year = "numeric";

    return new Intl.DateTimeFormat("en-GB", options).format(date);
  }

  function words(text) {
    var trimmed = String(text || "").trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
  }

  function excerpt(text) {
    var clean = String(text || "").replace(/\s+/g, " ").trim();
    if (!clean) return "Empty";
    return clean.length > 96 ? clean.slice(0, 96) + "…" : clean;
  }

  /* ---------- views ---------- */

  function show(name) {
    Object.keys(views).forEach(function (key) {
      views[key].hidden = key !== name;
    });
  }

  function setStatus(text, tone) {
    saveStatus.textContent = text;
    saveStatus.setAttribute("data-tone", tone || "");
  }

  /* ---------- library ---------- */

  function bookCountFor(folderId) {
    return state.books.filter(function (b) { return b.folderId === folderId; }).length;
  }

  function renderTree() {
    if (!state.folders.length) {
      libraryTree.innerHTML =
        '<p class="library-empty">No folders yet. Make one to hold your first book.</p>';
      return;
    }

    var html = state.folders.map(function (folder) {
      var books = state.books.filter(function (b) { return b.folderId === folder.id; });

      var bookItems = books.map(function (book) {
        return (
          '<li><button class="book-link' +
          (book.id === state.bookId ? " is-active" : "") +
          '" type="button" data-book="' + book.id + '">' +
          escapeHtml(book.title) +
          "</button></li>"
        );
      }).join("");

      return (
        '<div class="folder">' +
          '<div class="folder-head">' +
            '<span class="folder-name">' + escapeHtml(folder.name) + "</span>" +
            '<span class="folder-count">' + bookCountFor(folder.id) + "</span>" +
          "</div>" +
          (books.length
            ? '<ul class="book-list">' + bookItems + "</ul>"
            : '<p class="folder-empty">No books yet.</p>') +
          '<div class="folder-actions">' +
            '<button class="tiny" type="button" data-add-book="' + folder.id + '">+ book</button>' +
            '<button class="tiny" type="button" data-rename-folder="' + folder.id + '">rename</button>' +
            '<button class="tiny danger" type="button" data-delete-folder="' + folder.id + '">delete</button>' +
          "</div>" +
        "</div>"
      );
    }).join("");

    libraryTree.innerHTML = html;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderSummary() {
    Store.summary().then(function (counts) {
      if (!counts.entries) {
        librarySummary.textContent = "";
        return;
      }
      librarySummary.textContent =
        counts.entries + (counts.entries === 1 ? " entry" : " entries") +
        " · " + counts.books + (counts.books === 1 ? " book" : " books") +
        " · " + counts.folders + (counts.folders === 1 ? " folder" : " folders");
    });
  }

  function refresh() {
    return Promise.all([Store.listFolders(), Store.listBooks()]).then(function (parts) {
      state.folders = parts[0];
      state.books = parts[1];
      renderTree();
      renderSummary();
    });
  }

  /* ---------- books ---------- */

  function currentBook() {
    return state.books.filter(function (b) { return b.id === state.bookId; })[0] || null;
  }

  function folderOf(book) {
    return state.folders.filter(function (f) { return f.id === book.folderId; })[0] || null;
  }

  function selectBook(bookId) {
    state.bookId = bookId;
    rememberBook(bookId);
    renderTree();
    openBookView();
  }

  function firstAvailableBook() {
    var remembered = state.books.filter(function (b) { return b.id === readLastBook(); })[0];
    return remembered || state.books[0] || null;
  }

  function openBookView() {
    var book = currentBook();
    if (!book) { show("empty"); return; }

    var folder = folderOf(book);
    bookTitle.textContent = book.title;
    bookFolder.textContent = folder ? folder.name : "";

    Store.listEntries(book.id).then(function (entries) {
      var html = entries.map(function (entry) {
        var count = words(entry.text);
        return (
          '<li><button class="entry-row" type="button" data-entry="' + entry.id + '">' +
            '<span class="entry-row-date">' + escapeHtml(displayDate(entry.date)) + "</span>" +
            '<span class="entry-row-text">' + escapeHtml(excerpt(entry.text)) + "</span>" +
            '<span class="entry-row-meta">' + count + " " + (count === 1 ? "word" : "words") + "</span>" +
          "</button></li>"
        );
      }).join("");

      entryList.innerHTML = html;
      bookEmpty.hidden = entries.length > 0;
      show("book");
    });
  }

  /* ---------- editor ---------- */

  function openEditor(entry, isNew) {
    var book = currentBook();
    if (!book) return;

    var folder = folderOf(book);

    state.entry = entry;
    state.isNew = !!isNew;
    state.dirty = false;

    editorFolder.textContent = folder ? folder.name : "";
    editorBook.textContent = book.title;

    entryDate.value = entry.date;
    entryText.value = entry.text;

    deleteEntryBtn.hidden = !!isNew;
    setStatus(isNew ? "" : "Saved");

    show("editor");
    entryText.focus();
    if (!isNew) {
      entryText.setSelectionRange(entryText.value.length, entryText.value.length);
    }
  }

  function newEntry() {
    var book = currentBook();
    if (!book) return;

    openEditor({
      id: Store.uid(),
      bookId: book.id,
      date: todayISO(),
      text: "",
      createdAt: Date.now(),
      updatedAt: Date.now()
    }, true);
  }

  function persist(force) {
    var entry = state.entry;
    if (!entry) return Promise.resolve();

    var text = entryText.value;
    var date = entryDate.value || todayISO();

    /* A brand-new, still-empty entry is not worth keeping. */
    if (state.isNew && !text.trim()) {
      setStatus("");
      return Promise.resolve();
    }

    entry.text = text;
    entry.date = date;

    setStatus("Saving…", "busy");

    var promise = state.isNew
      ? Store.createEntry(entry.bookId, date, text).then(function (saved) {
          entry.id = saved.id;
          entry.createdAt = saved.createdAt;
          entry.updatedAt = saved.updatedAt;
          state.isNew = false;
          deleteEntryBtn.hidden = false;
          return saved;
        })
      : Store.updateEntry(entry);

    return promise.then(function () {
      state.dirty = false;
      setStatus("Saved", "ok");
      renderSummary();
      if (force) return null;
      return null;
    }).catch(function (error) {
      setStatus("Not saved", "error");
      throw error;
    });
  }

  function scheduleSave() {
    state.dirty = true;
    setStatus("Unsaved", "busy");
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(function () {
      persist().catch(function () {});
    }, 700);
  }

  function leaveEditor() {
    persist().catch(function () {}).then(function () {
      state.entry = null;
      state.isNew = false;
      openBookView();
    });
  }

  /* ---------- dialogs ---------- */

  function askName(options) {
    return new Promise(function (resolve) {
      nameTitle.textContent = options.title;
      nameLabel.textContent = options.label;
      nameInput.value = options.value || "";

      var settled = false;

      function finish(value) {
        if (settled) return;
        settled = true;
        nameForm.removeEventListener("submit", onSubmit);
        nameDialog.removeEventListener("cancel", onCancel);
        nameDialog.removeEventListener("keydown", onKeydown);
        if (nameDialog.open) nameDialog.close();
        resolve(value);
      }

      function onSubmit(event) {
        /* Settle here rather than on "close": some browsers never fire it. */
        event.preventDefault();
        var submitter = event.submitter;
        var verdict = submitter ? submitter.value : "ok";

        if (verdict !== "ok") {
          finish(null);
          return;
        }

        var name = nameInput.value.trim();
        if (!name) {
          nameInput.focus();
          return;
        }
        finish(name);
      }

      function onCancel(event) {
        event.preventDefault();
        finish(null);
      }

      function onKeydown(event) {
        if (event.key === "Escape") {
          event.preventDefault();
          finish(null);
        }
      }

      nameForm.addEventListener("submit", onSubmit);
      nameDialog.addEventListener("cancel", onCancel);
      nameDialog.addEventListener("keydown", onKeydown);

      nameDialog.showModal();
      nameInput.focus();
      nameInput.select();
    });
  }

  /* ---------- actions ---------- */

  function makeFolder() {
    askName({ title: "New folder", label: "What is this folder for?", value: "" })
      .then(function (name) {
        if (!name) return;
        return Store.createFolder(name).then(refresh);
      })
      .catch(reportError);
  }

  function makeBook(folderId) {
    askName({ title: "New book", label: "What is this book called?", value: "" })
      .then(function (title) {
        if (!title) return;
        return Store.createBook(folderId, title).then(function (book) {
          return refresh().then(function () {
            selectBook(book.id);
          });
        });
      })
      .catch(reportError);
  }

  function reportError(error) {
    if (error && error.message) {
      setStatus(error.message, "error");
      window.alert(error.message);
    }
  }

  /* ---------- wiring ---------- */

  el("newFolderBtn").addEventListener("click", makeFolder);
  el("emptyNewFolder").addEventListener("click", makeFolder);

  el("newEntryBtn").addEventListener("click", newEntry);
  el("backToBookBtn").addEventListener("click", function (event) {
    event.preventDefault();
    leaveEditor();
  });

  entryDate.addEventListener("change", scheduleSave);
  entryText.addEventListener("input", scheduleSave);

  entryText.addEventListener("keydown", function (event) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      window.clearTimeout(saveTimer);
      persist(true).catch(reportError);
    }
  });

  el("deleteEntryBtn").addEventListener("click", function () {
    if (!state.entry || state.isNew) return;
    if (!window.confirm("Delete this entry? This cannot be undone.")) return;

    Store.deleteEntry(state.entry.id).then(function () {
      state.entry = null;
      state.isNew = false;
      renderSummary();
      openBookView();
    }).catch(reportError);
  });

  el("renameBookBtn").addEventListener("click", function () {
    var book = currentBook();
    if (!book) return;

    askName({ title: "Rename book", label: "Book name", value: book.title })
      .then(function (title) {
        if (!title) return;
        return Store.renameBook(book.id, title).then(function () {
          return refresh().then(openBookView);
        });
      })
      .catch(reportError);
  });

  el("deleteBookBtn").addEventListener("click", function () {
    var book = currentBook();
    if (!book) return;
    if (!window.confirm('Delete "' + book.title + '" and every entry in it? This cannot be undone.')) return;

    Store.deleteBook(book.id).then(function () {
      state.bookId = null;
      return refresh().then(function () {
        var next = firstAvailableBook();
        if (next) selectBook(next.id);
        else show("empty");
      });
    }).catch(reportError);
  });

  /* Delegated events in the library tree. */
  libraryTree.addEventListener("click", function (event) {
    var target = event.target.closest("button");
    if (!target) return;

    if (target.hasAttribute("data-book")) {
      selectBook(target.getAttribute("data-book"));
      return;
    }

    if (target.hasAttribute("data-add-book")) {
      makeBook(target.getAttribute("data-add-book"));
      return;
    }

    if (target.hasAttribute("data-rename-folder")) {
      var folderId = target.getAttribute("data-rename-folder");
      var folder = state.folders.filter(function (f) { return f.id === folderId; })[0];
      if (!folder) return;

      askName({ title: "Rename folder", label: "Folder name", value: folder.name })
        .then(function (name) {
          if (!name) return;
          return Store.renameFolder(folderId, name).then(refresh);
        })
        .catch(reportError);
      return;
    }

    if (target.hasAttribute("data-delete-folder")) {
      var id = target.getAttribute("data-delete-folder");
      var doomed = state.folders.filter(function (f) { return f.id === id; })[0];
      if (!doomed) return;

      var message = 'Delete "' + doomed.name + '", its books, and every entry in them? This cannot be undone.';
      if (!window.confirm(message)) return;

      Store.deleteFolder(id).then(function () {
        var openBook = currentBook();
        if (openBook && openBook.folderId === id) state.bookId = null;
        return refresh().then(function () {
          if (state.bookId) { openBookView(); return; }
          var next = firstAvailableBook();
          if (next) selectBook(next.id);
          else show("empty");
        });
      }).catch(reportError);
    }
  });

  entryList.addEventListener("click", function (event) {
    var row = event.target.closest("[data-entry]");
    if (!row) return;

    var id = row.getAttribute("data-entry");
    Store.listEntries(state.bookId).then(function (entries) {
      var entry = entries.filter(function (e) { return e.id === id; })[0];
      if (entry) openEditor(entry, false);
    });
  });

  /* ---------- export / import ---------- */

  el("exportBtn").addEventListener("click", function () {
    Store.exportAll().then(function (data) {
      var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var link = document.createElement("a");
      link.href = url;
      link.download = "appy-" + todayISO() + ".json";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      setStatus("Exported", "ok");
    }).catch(reportError);
  });

  el("importBtn").addEventListener("click", function () {
    el("importFile").click();
  });

  el("importFile").addEventListener("change", function (event) {
    var file = event.target.files && event.target.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function () {
      var data;
      try {
        data = JSON.parse(reader.result);
      } catch (error) {
        window.alert("That file is not readable JSON.");
        return;
      }

      if (!window.confirm("Importing replaces everything currently in this diary. Continue?")) return;

      Store.importAll(data).then(function () {
        state.bookId = null;
        state.entry = null;
        return refresh().then(function () {
          show("empty");
          setStatus("Imported", "ok");
        });
      }).catch(function (error) {
        window.alert(error.message || "That import did not work.");
      });
    };
    reader.readAsText(file);
    event.target.value = "";
  });

  /* ---------- start ---------- */

  Store.available().then(function (ok) {
    if (!ok) {
      libraryTree.innerHTML =
        '<p class="library-empty">This browser cannot store a diary. Private windows sometimes block it.</p>';
      show("empty");
      bookTitle.textContent = "Storage is unavailable";
      return;
    }

    return refresh().then(function () {
      /* Come back to where the writing was. */
      var book = firstAvailableBook();
      if (book) selectBook(book.id);
      else show("empty");
    });
  }).catch(reportError);
})();
