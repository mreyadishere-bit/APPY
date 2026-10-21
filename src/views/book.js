/* ============================================================
   APPY — one book
   Its cover, its numbers, and every entry inside it, by month.
   ============================================================ */

import { esc, h } from "../ui/dom.js";
import { coverHTML, coverStyle, icon, plural } from "../ui/kit.js";
import * as store from "../core/store.js";
import { formatDate } from "../core/model.js";
import { entriesGroupedHTML, moreLink } from "../ui/entry-list.js";
import { missingView } from "./missing.js";
import { bookMenu, bookSettingsFlow, readBook, startNewEntry } from "./actions.js";

const PAGE = 30;

export function bookView(bookId) {
  const book = store.bookById(bookId);

  if (!book) {
    return missingView({
      title: "That book is gone",
      message: "It may have been deleted. Entries that lived in it were moved or placed in the trash.",
      back: "/library",
      backLabel: "Back to the library",
    });
  }

  const root = h("div");
  let expanded = false;

  const unsubscribe = store.subscribe((reason) => {
    // The book can be renamed or deleted from its own dialog.
    if (reason === "book:deleted" && !store.bookById(bookId)) {
      return;
    }
    render();
  });
  root.addEventListener("click", onClick);

  render();

  return {
    root,
    title: book.title,
    destroy() {
      unsubscribe();
      root.removeEventListener("click", onClick);
    },
  };

  function onClick(event) {
    const action = event.target.closest("[data-action]");
    if (action) {
      const name = action.dataset.action;
      if (name === "read") readBook(book.id);
      if (name === "new-entry") startNewEntry({ bookId: book.id });
      if (name === "settings") bookSettingsFlow(store.bookById(book.id));
      if (name === "menu") bookMenu(store.bookById(book.id), action);
      if (name === "show-more") {
        expanded = true;
        render();
      }
    }
  }

  function render() {
    const current = store.bookById(book.id);
    if (!current) return;

    const stats = store.bookStats(current.id);
    const entries = store.entriesIn({ bookId: current.id, sort: "newest" });
    const visible = expanded ? entries : entries.slice(0, PAGE);

    root.innerHTML = `
      <header class="book-head">
        <div class="cover cover--lg" ${coverStyle(current)} aria-hidden="true">
          ${coverHTML(current, { count: stats.entries })}
        </div>
        <div>
          <p class="label">Book</p>
          <h1 class="display book-title">${esc(current.title)}</h1>
          ${current.subtitle ? `<p class="dim">${esc(current.subtitle)}</p>` : ""}
          <p class="book-facts">
            <span>${plural(stats.entries, "entry", "entries")}</span>
            <span>${stats.words.toLocaleString()} words</span>
            ${
              stats.first
                ? `<span>${esc(formatDate(stats.first, "short"))} – ${esc(formatDate(stats.last, "short"))}</span>`
                : "<span>Not started</span>"
            }
          </p>
          <div class="book-actions">
            <button class="btn btn--primary" type="button" data-action="read" ${
              stats.entries ? "" : "disabled"
            }>${icon("book")} Read this book</button>
            <button class="btn" type="button" data-action="new-entry">${icon("pen")} New entry</button>
            <button class="btn btn--ghost" type="button" data-action="settings">${icon("settings")} Settings</button>
            <button class="btn btn--ghost" type="button" data-action="menu" aria-label="More book actions" aria-haspopup="menu">⋯</button>
          </div>
        </div>
      </header>

      ${
        entries.length
          ? entriesGroupedHTML(visible) + moreLink(entries.length - visible.length, entries.length)
          : `<div class="empty">
              <h2 class="display">This book is still blank.</h2>
              <p>The first entry can be one sentence. It only has to be true.</p>
              <div class="empty-actions">
                <button class="btn btn--primary" type="button" data-action="new-entry">Write the first entry</button>
              </div>
            </div>`
      }
    `;
  }
}
