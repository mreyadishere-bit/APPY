/* ============================================================
   APPY — the reading room
   Turns books into a two-page spread. Books come from two places:
   the sample markup in read.html, and your own diary in IndexedDB.
   Without JavaScript the entries stay as a plain readable page.
   ============================================================ */

(function () {
  "use strict";

  var shelf = document.getElementById("shelf");
  var reader = document.getElementById("reader");
  var spread = document.getElementById("spread");

  if (!shelf || !reader || !spread) return;

  var slots = {
    left: reader.querySelector('[data-slot="left"]'),
    right: reader.querySelector('[data-slot="right"]')
  };
  var folios = {
    left: reader.querySelector('[data-folio="left"]'),
    right: reader.querySelector('[data-folio="right"]')
  };
  var titleEl = document.getElementById("readerTitle");
  var countEl = document.getElementById("readerCount");
  var progressFill = document.getElementById("progressFill");
  var prevBtn = document.getElementById("prevPage");
  var nextBtn = document.getElementById("nextPage");
  var closeBtn = document.getElementById("readerClose");

  var userShelf = document.getElementById("userShelf");
  var userShelfBlock = document.getElementById("userShelfBlock");
  var userShelfEmpty = document.getElementById("userShelfEmpty");
  var booksContainer = document.querySelector(".books");

  var books = {};
  var state = { bookId: null, index: 0, perPage: 2 };
  var wideQuery = window.matchMedia("(min-width: 60rem)");

  /* ---------- helpers ---------- */

  function displayDate(iso) {
    if (!iso) return "";
    var parts = iso.split("-").map(Number);
    var date = new Date(parts[0], parts[1] - 1, parts[2]);
    if (isNaN(date.getTime())) return iso;

    var options = { day: "numeric", month: "long" };
    if (date.getFullYear() !== new Date().getFullYear()) options.year = "numeric";
    return new Intl.DateTimeFormat("en-GB", options).format(date);
  }

  function excerpt(text) {
    var clean = String(text || "").replace(/\s+/g, " ").trim();
    if (!clean) return "An empty page.";
    return clean.length > 64 ? clean.slice(0, 64) + "…" : clean;
  }

  /* ---------- your own books ---------- */

  function buildUserBook(book, folderName, entries) {
    var domId = "user-" + book.id;

    /* shelf volume */
    var li = document.createElement("li");
    var link = document.createElement("a");
    link.className = "volume";
    link.href = "#" + domId;
    link.setAttribute("data-open-book", domId);

    var spine = document.createElement("span");
    spine.className = "volume-spine";
    spine.setAttribute("aria-hidden", "true");

    var body = document.createElement("span");
    body.className = "volume-body";

    var title = document.createElement("span");
    title.className = "volume-title";
    title.textContent = book.title;

    var meta = document.createElement("span");
    meta.className = "volume-meta";
    meta.textContent =
      (folderName ? folderName + " · " : "") +
      entries.length + (entries.length === 1 ? " entry" : " entries");

    var blurb = document.createElement("span");
    blurb.className = "volume-blurb";
    blurb.textContent = excerpt(entries[entries.length - 1].text);

    body.appendChild(title);
    body.appendChild(meta);
    body.appendChild(blurb);
    link.appendChild(spine);
    link.appendChild(body);
    li.appendChild(link);

    /* the book markup the reader already understands */
    var section = document.createElement("section");
    section.className = "book";
    section.id = domId;

    var head = document.createElement("header");
    head.className = "book-head";

    var heading = document.createElement("h2");
    heading.textContent = book.title;

    var bookMeta = document.createElement("p");
    bookMeta.className = "book-meta";
    bookMeta.textContent =
      (folderName ? folderName + " · " : "") +
      entries.length + (entries.length === 1 ? " entry" : " entries");

    head.appendChild(heading);
    head.appendChild(bookMeta);

    var list = document.createElement("div");
    list.className = "entries";

    entries.forEach(function (entry) {
      var article = document.createElement("article");
      article.className = "entry";

      var dateEl = document.createElement("p");
      dateEl.className = "entry-date";
      dateEl.textContent = displayDate(entry.date);

      var textEl = document.createElement("p");
      textEl.className = "entry-text";
      textEl.textContent = entry.text;

      article.appendChild(dateEl);
      article.appendChild(textEl);
      list.appendChild(article);
    });

    section.appendChild(head);
    section.appendChild(list);

    return { shelf: li, section: section };
  }

  function injectUserBooks() {
    if (!window.AppyStore || !userShelf || !booksContainer) return Promise.resolve();

    return Promise.all([
      window.AppyStore.listFolders(),
      window.AppyStore.listBooks(),
      window.AppyStore.listAllEntries()
    ]).then(function (parts) {
      var folders = parts[0];
      var allBooks = parts[1];
      var allEntries = parts[2];

      var filled = allBooks
        .map(function (book) {
          var entries = allEntries
            .filter(function (entry) { return entry.bookId === book.id; })
            .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
          return { book: book, entries: entries };
        })
        .filter(function (item) { return item.entries.length > 0; });

      if (!filled.length) return;

      filled.forEach(function (item) {
        var folder = folders.filter(function (f) { return f.id === item.book.folderId; })[0];
        var built = buildUserBook(item.book, folder ? folder.name : "", item.entries);
        userShelf.appendChild(built.shelf);
        booksContainer.insertBefore(built.section, booksContainer.firstChild);
      });

      userShelfBlock.hidden = false;
      if (userShelfEmpty) userShelfEmpty.hidden = true;
    }).catch(function () {
      /* A diary that cannot be read should not break the samples. */
    });
  }

  /* ---------- collect books from the document ---------- */

  function collectBooks() {
    Array.prototype.forEach.call(document.querySelectorAll(".book"), function (section) {
      var heading = section.querySelector("h2");
      var meta = section.querySelector(".book-meta");
      var entries = Array.prototype.map.call(
        section.querySelectorAll(".entry"),
        function (entry) {
          return {
            date: entry.querySelector(".entry-date").textContent.trim(),
            text: entry.querySelector(".entry-text").innerHTML.trim()
          };
        }
      );

      books[section.id] = {
        title: heading ? heading.textContent.trim() : "",
        meta: meta ? meta.textContent.trim() : "",
        entries: entries
      };
    });
  }

  /* ---------- rendering ---------- */

  function updatePerPage() {
    state.perPage = wideQuery.matches ? 2 : 1;
  }

  function totalSpreads(book) {
    return Math.max(1, Math.ceil(book.entries.length / state.perPage));
  }

  function entryMarkup(entry) {
    return (
      '<article class="reader-entry">' +
      '<p class="entry-date">' + entry.date + "</p>" +
      '<p class="entry-text">' + entry.text + "</p>" +
      "</article>"
    );
  }

  function render(animate) {
    var book = books[state.bookId];
    if (!book) return;

    var start = state.index;
    var slice = book.entries.slice(start, start + state.perPage);

    slots.left.innerHTML = slice[0] ? entryMarkup(slice[0]) : "";
    slots.right.innerHTML = state.perPage === 2 && slice[1] ? entryMarkup(slice[1]) : "";

    folios.left.textContent = slice[0] ? String(start + 1) : "";
    folios.right.textContent = state.perPage === 2 && slice[1] ? String(start + 2) : "";

    var spreads = totalSpreads(book);
    var current = Math.floor(start / state.perPage) + 1;

    countEl.textContent = "Spread " + current + " of " + spreads;
    progressFill.style.width = (current / spreads) * 100 + "%";

    prevBtn.disabled = state.index === 0;
    nextBtn.disabled = state.index + state.perPage >= book.entries.length;

    spread.classList.toggle("is-single", state.perPage === 1);
    titleEl.textContent = book.title;

    if (animate) {
      spread.classList.remove("is-flipping");
      void spread.offsetWidth;
      spread.classList.add("is-flipping");
    }
  }

  function openBook(id, options) {
    if (!books[id]) return;

    state.bookId = id;
    state.index = 0;

    shelf.hidden = true;
    reader.hidden = false;

    render(false);
    reader.scrollIntoView({
      block: "start",
      behavior: options && options.instant ? "auto" : "smooth"
    });

    closeBtn.focus({ preventScroll: true });

    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, "", "#" + id);
    }
  }

  function closeBook() {
    reader.hidden = true;
    shelf.hidden = false;

    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, "", "#shelf");
    }

    shelf.scrollIntoView({ block: "start", behavior: "smooth" });

    var opener = document.querySelector('[data-open-book="' + state.bookId + '"]');
    if (opener) opener.focus({ preventScroll: true });

    state.bookId = null;
  }

  function step(direction) {
    var book = books[state.bookId];
    if (!book) return;

    var next = state.index + direction * state.perPage;
    if (next < 0 || next >= book.entries.length) return;

    state.index = next;
    render(true);
  }

  /* ---------- wiring ---------- */

  function wire() {
    Array.prototype.forEach.call(
      document.querySelectorAll("[data-open-book]"),
      function (link) {
        link.addEventListener("click", function (event) {
          event.preventDefault();
          openBook(link.getAttribute("data-open-book"));
        });
      }
    );

    prevBtn.addEventListener("click", function () { step(-1); });
    nextBtn.addEventListener("click", function () { step(1); });
    closeBtn.addEventListener("click", closeBook);

    document.addEventListener("keydown", function (event) {
      if (reader.hidden) return;

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        step(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        step(1);
      } else if (event.key === "Escape") {
        event.preventDefault();
        closeBook();
      }
    });

    var onBreakpointChange = function () {
      var book = books[state.bookId];
      if (!book) { updatePerPage(); return; }

      var firstVisible = state.index;
      updatePerPage();
      state.index = firstVisible - (firstVisible % state.perPage);
      render(false);
    };

    if (wideQuery.addEventListener) {
      wideQuery.addEventListener("change", onBreakpointChange);
    } else if (wideQuery.addListener) {
      wideQuery.addListener(onBreakpointChange);
    }
  }

  function handleHash() {
    var hash = window.location.hash.replace("#", "");
    if (hash && books[hash]) openBook(hash, { instant: true });
  }

  /* ---------- start ---------- */

  updatePerPage();

  injectUserBooks().then(function () {
    collectBooks();
    wire();
    handleHash();
    /* Only now hide the plain entry lists — the reader can serve them. */
    document.documentElement.classList.add("reader-ready");
  });
})();
