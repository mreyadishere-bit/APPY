/* ============================================================
   APPY — library, folder, and day
   The shelf: books with covers, folders that cross them, and a
   plain way to walk through everything that has been written.
   ============================================================ */

import { esc, h } from "../ui/dom.js";
import { coverHTML, coverStyle, icon, plural } from "../ui/kit.js";
import { pageHead } from "../ui/shell.js";
import * as store from "../core/store.js";
import { formatDate, formatWeekday, isISODate, titleOf } from "../core/model.js";
import { entriesGroupedHTML, moreLink } from "../ui/entry-list.js";
import { navigate } from "../ui/router.js";
import { missingView } from "./missing.js";
import {
  bookMenu,
  createBookFlow,
  createFolderFlow,
  deleteFolderFlow,
  folderMenu,
  folderSettingsFlow,
  startNewEntry,
} from "./actions.js";

const PAGE = 24;

/* ---------- library ---------- */

export function libraryView() {
  const root = h("div");
  let expanded = false;

  const unsubscribe = store.subscribe(render);
  root.addEventListener("click", onClick);

  render();

  return {
    root,
    title: "Library",
    destroy() {
      unsubscribe();
      root.removeEventListener("click", onClick);
    },
  };

  function onClick(event) {
    const action = event.target.closest("[data-action]");
    if (action) {
      if (action.dataset.action === "new-book") createBookFlow();
      if (action.dataset.action === "new-folder") createFolderFlow();
      if (action.dataset.action === "show-more") {
        expanded = true;
        render();
      }
      return;
    }

    const bookTrigger = event.target.closest("[data-book-menu]");
    if (bookTrigger) {
      const book = store.bookById(bookTrigger.dataset.bookMenu);
      if (book) bookMenu(book, bookTrigger);
      return;
    }

    const folderTrigger = event.target.closest("[data-folder-menu]");
    if (folderTrigger) {
      const folder = store.folderById(folderTrigger.dataset.folderMenu);
      if (folder) folderMenu(folder, folderTrigger);
    }
  }

  function render() {
    const books = store.books();
    const folders = store.folders();
    const all = store.entriesIn({ sort: "newest" });
    const visible = expanded ? all : all.slice(0, PAGE);

    root.innerHTML = `
      ${pageHead({
        eyebrow: "Your shelf",
        title: "Library",
        intro: books.length
          ? `${plural(books.length, "book")} · ${plural(all.length, "entry", "entries")} · ${
              folders.length ? plural(folders.length, "folder") : "no folders yet"
            }`
          : "Everything you write lives in a book. Start with one.",
        actions: `
          <button class="btn" type="button" data-action="new-folder">${icon("folder")} New folder</button>
          <button class="btn btn--primary" type="button" data-action="new-book">${icon("plus")} New book</button>
        `,
      })}

      ${
        books.length
          ? `<section class="library-block" aria-labelledby="booksHeading">
              <div class="section-head">
                <h2 class="display" id="booksHeading" style="font-size:1.25rem">Books</h2>
                <span class="label">${plural(books.length, "volume")}</span>
              </div>
              <div class="books-grid">
                ${books
                  .map((book) => {
                    const stats = store.bookStats(book.id);
                    return `
                      <div class="book-card">
                        <a class="cover" href="#/book/${esc(book.id)}" ${coverStyle(book)}
                          aria-label="${esc(book.title)}, ${plural(stats.entries, "entry", "entries")}">
                          ${coverHTML(book, { count: stats.entries })}
                        </a>
                        <div class="book-card-foot">
                          <a class="book-card-title" href="#/book/${esc(book.id)}">${esc(book.title)}</a>
                          <button class="entry-menu-btn" type="button" data-book-menu="${esc(book.id)}"
                            aria-label="More for ${esc(book.title)}" aria-haspopup="menu">⋯</button>
                        </div>
                        <p class="book-card-meta">${plural(stats.entries, "entry", "entries")}</p>
                      </div>
                    `;
                  })
                  .join("")}
                <button class="cover cover--new" type="button" data-action="new-book">
                  <span class="plus" aria-hidden="true">+</span>
                  <span>New book</span>
                </button>
              </div>
            </section>`
          : ""
      }

      ${
        folders.length
          ? `<section class="library-block" aria-labelledby="foldersHeading">
              <div class="section-head">
                <h2 class="display" id="foldersHeading" style="font-size:1.25rem">Folders</h2>
                <span class="label">Across every book</span>
              </div>
              <div class="folder-list">
                ${folders
                  .map((folder) => {
                    const count = store.folderCount(folder.id);
                    return `
                      <div class="folder-row">
                        <a class="folder-name" href="#/folder/${esc(folder.id)}">
                          <span class="folder-dot" style="--folder-color:${esc(folder.color)}" aria-hidden="true"></span>
                          ${esc(folder.name)}
                        </a>
                        <span class="folder-meta">${plural(count, "entry", "entries")}</span>
                        <button class="entry-menu-btn" type="button" data-folder-menu="${esc(folder.id)}"
                          aria-label="More for ${esc(folder.name)}" aria-haspopup="menu">⋯</button>
                      </div>
                    `;
                  })
                  .join("")}
              </div>
            </section>`
          : ""
      }

      <section class="library-block" aria-labelledby="allHeading">
        <div class="section-head">
          <h2 class="display" id="allHeading" style="font-size:1.25rem">All entries</h2>
          <a class="linkish" href="#/search">Search and filter</a>
        </div>
        ${
          all.length
            ? entriesGroupedHTML(visible, { showBook: true }) + moreLink(all.length - visible.length, all.length)
            : `<p class="dim">No entries yet. Open a book and write the first one.</p>`
        }
      </section>
    `;
  }
}

/* ---------- a folder ---------- */

export function folderView(folderId) {
  const folder = store.folderById(folderId);
  if (!folder) {
    return missingView({
      title: "That folder is gone",
      message: "It may have been deleted on another tab. Your entries are safe in their books.",
      back: "/library",
      backLabel: "Back to the library",
    });
  }

  const root = h("div");
  let expanded = false;
  const unsubscribe = store.subscribe(render);
  root.addEventListener("click", onClick);
  render();

  return {
    root,
    title: folder.name,
    destroy() {
      unsubscribe();
      root.removeEventListener("click", onClick);
    },
  };

  function onClick(event) {
    const action = event.target.closest("[data-action]");
    if (!action) return;
    if (action.dataset.action === "new-entry") startNewEntry({ folderId: folder.id });
    if (action.dataset.action === "folder-settings") folderSettingsFlow(folder);
    if (action.dataset.action === "delete-folder") deleteFolderFlow(folder).then((done) => done && navigate("/library"));
    if (action.dataset.action === "show-more") {
      expanded = true;
      render();
    }
  }

  function render() {
    const entries = store.entriesIn({ folderId: folder.id, sort: "newest" });
    const visible = expanded ? entries : entries.slice(0, PAGE);

    root.innerHTML = `
      ${pageHead({
        eyebrow: "Folder",
        title: folder.name,
        intro: `${plural(entries.length, "entry", "entries")} from ${plural(
          new Set(entries.map((entry) => entry.bookId)).size,
          "book"
        )}. Folders group by subject; the books keep the writing.`,
        actions: `
          <button class="btn" type="button" data-action="folder-settings">${icon("settings")} Settings</button>
          <button class="btn btn--primary" type="button" data-action="new-entry">${icon("pen")} New entry</button>
        `,
      })}

      ${
        entries.length
          ? entriesGroupedHTML(visible, { showBook: true }) + moreLink(entries.length - visible.length, entries.length)
          : `<div class="empty">
              <h2 class="display">Nothing filed here yet.</h2>
              <p>Write something new, or move an existing entry into this folder from its ⋯ menu.</p>
              <div class="empty-actions">
                <button class="btn btn--primary" type="button" data-action="new-entry">Write in this folder</button>
                <a class="btn" href="#/library">Browse the library</a>
              </div>
            </div>`
      }
    `;
  }
}

/* ---------- one day ---------- */

export function dayView(day) {
  if (!isISODate(day)) {
    return missingView({
      title: "That is not a day",
      message: "The link did not carry a real date.",
      back: "/",
      backLabel: "Back home",
    });
  }

  const root = h("div");
  const unsubscribe = store.subscribe(render);
  root.addEventListener("click", onClick);
  render();

  return {
    root,
    title: formatDate(day, "full"),
    destroy() {
      unsubscribe();
      root.removeEventListener("click", onClick);
    },
  };

  function onClick(event) {
    const action = event.target.closest("[data-action]");
    if (action?.dataset.action === "new-entry") startNewEntry({ date: day });
  }

  function render() {
    const entries = store.entriesOnDate(day);

    root.innerHTML = `
      ${pageHead({
        eyebrow: `A day · ${formatWeekday(day)}`,
        title: formatDate(day, "full"),
        intro: entries.length
          ? `${plural(entries.length, "entry", "entries")} written on this day.`
          : "A blank day, if you want it.",
        actions: `<button class="btn btn--primary" type="button" data-action="new-entry">${icon("pen")} Write for this day</button>`,
      })}

      ${
        entries.length
          ? `<ol class="entries">
              ${entries
                .map((entry) => {
                  const book = store.bookById(entry.bookId);
                  return `
                    <li class="entry-row">
                      <a class="entry-link" href="#/write/${esc(entry.id)}" aria-label="Open ${esc(titleOf(entry))}"></a>
                      <span class="entry-date">${esc(book?.title || "")}</span>
                      <span>
                        <span class="entry-title${entry.title?.trim() ? "" : " is-untitled"}">${esc(titleOf(entry))}</span>
                        <span class="entry-excerpt">${esc(stripBody(entry.body))}</span>
                      </span>
                      <span class="entry-meta">
                        <button class="entry-menu-btn" type="button" data-menu="${esc(entry.id)}"
                          aria-label="More for ${esc(titleOf(entry))}" aria-haspopup="menu">⋯</button>
                      </span>
                    </li>
                  `;
                })
                .join("")}
            </ol>`
          : `<div class="empty">
              <h2 class="display">Nothing written on this day.</h2>
              <p>It is not too late to remember it.</p>
              <div class="empty-actions">
                <button class="btn btn--primary" type="button" data-action="new-entry">Write for this day</button>
                <a class="btn" href="#/">Back home</a>
              </div>
            </div>`
      }
    `;
  }
}

function stripBody(html) {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text.length > 160 ? `${text.slice(0, 160).trimEnd()}…` : text;
}
