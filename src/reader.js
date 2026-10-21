/* ============================================================
   APPY — the reading room
   Turns the static entry markup into a two-page spread.
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

  /* ---------- collect the books from the document ---------- */

  var books = {};

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

  var state = {
    bookId: null,
    index: 0,
    perPage: 2
  };

  var wideQuery = window.matchMedia("(min-width: 60rem)");

  function updatePerPage() {
    state.perPage = wideQuery.matches ? 2 : 1;
  }

  updatePerPage();

  function totalSpreads(book) {
    return Math.max(1, Math.ceil(book.entries.length / state.perPage));
  }

  /* ---------- rendering ---------- */

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
    slots.right.innerHTML =
      state.perPage === 2 && slice[1] ? entryMarkup(slice[1]) : "";

    /* Page numbers follow the entry positions, like a printed book. */
    folios.left.textContent = slice[0] ? String(start + 1) : "";
    folios.right.textContent =
      state.perPage === 2 && slice[1] ? String(start + 2) : "";

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
      /* force a reflow so the animation restarts */
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
    reader.scrollIntoView({ block: "start", behavior: options && options.instant ? "auto" : "smooth" });

    /* Move focus to the reader so keyboard users land in the right place. */
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

  Array.prototype.forEach.call(
    document.querySelectorAll("[data-open-book]"),
    function (link) {
      link.addEventListener("click", function (event) {
        event.preventDefault();
        openBook(link.getAttribute("data-open-book"));
      });
    }
  );

  prevBtn.addEventListener("click", function () {
    step(-1);
  });

  nextBtn.addEventListener("click", function () {
    step(1);
  });

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

  /* Reflow the spread when the breakpoint changes, keeping the reader's place. */
  function onBreakpointChange() {
    var book = books[state.bookId];
    if (!book) {
      updatePerPage();
      return;
    }

    var firstVisible = state.index;
    updatePerPage();
    state.index = firstVisible - (firstVisible % state.perPage);
    render(false);
  }

  if (wideQuery.addEventListener) {
    wideQuery.addEventListener("change", onBreakpointChange);
  } else if (wideQuery.addListener) {
    wideQuery.addListener(onBreakpointChange);
  }

  /* Deep link: /read.html#book-winter opens that book directly. */
  var hash = window.location.hash.replace("#", "");
  if (hash && books[hash]) {
    openBook(hash, { instant: true });
  }

  /* Hide the plain entry list only now that the reader is available. */
  document.documentElement.classList.add("reader-ready");
})();
