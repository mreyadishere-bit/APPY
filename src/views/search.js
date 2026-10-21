/* ============================================================
   APPY — search
   Instant, local, and honest: every word must appear somewhere,
   titles count for more than prose, and the reason for a match is
   shown rather than guessed at.
   ============================================================ */

import { esc, h } from "../ui/dom.js";
import { icon } from "../ui/kit.js";
import { pageHead } from "../ui/shell.js";
import * as store from "../core/store.js";
import { formatDate, titleOf, wordCount } from "../core/model.js";
import { highlight, searchEntries, snippet } from "../core/search.js";

export function searchView(route) {
  const root = h("div");
  const state = {
    q: route.query.q || "",
    book: route.query.book || "",
    folder: route.query.folder || "",
    sort: route.query.sort || "",
    from: route.query.from || "",
    to: route.query.to || "",
  };

  const books = store.bookOptions();
  const folders = store.folders();

  root.innerHTML = `
    ${pageHead({
      eyebrow: "Find a memory",
      title: "Search",
      intro: "Titles, prose, books, and folders — all of it on this device.",
    })}

    <div class="filter-bar" role="search">
      <div class="search-field">
        ${icon("search")}
        <input class="input" type="search" data-field="q" autocomplete="off"
          placeholder="A word, a place, a name…" aria-label="Search entries" value="${esc(state.q)}" />
      </div>

      <label class="field">
        <span class="label">Book</span>
        <select class="select" data-field="book">
          <option value="">All books</option>
          ${books
            .map(
              (book) =>
                `<option value="${esc(book.id)}" ${book.id === state.book ? "selected" : ""}>${esc(
                  book.title
                )}</option>`
            )
            .join("")}
        </select>
      </label>

      <label class="field">
        <span class="label">Folder</span>
        <select class="select" data-field="folder">
          <option value="">All folders</option>
          ${folders
            .map(
              (folder) =>
                `<option value="${esc(folder.id)}" ${folder.id === state.folder ? "selected" : ""}>${esc(
                  folder.name
                )}</option>`
            )
            .join("")}
        </select>
      </label>

      <label class="field">
        <span class="label">Sort</span>
        <select class="select" data-field="sort">
          <option value="">${state.q ? "Best match" : "Newest first"}</option>
          <option value="oldest" ${state.sort === "oldest" ? "selected" : ""}>Oldest first</option>
          <option value="updated" ${state.sort === "updated" ? "selected" : ""}>Recently edited</option>
        </select>
      </label>

      <label class="field">
        <span class="label">From</span>
        <input class="input" type="date" data-field="from" value="${esc(state.from)}" />
      </label>

      <label class="field">
        <span class="label">To</span>
        <input class="input" type="date" data-field="to" value="${esc(state.to)}" />
      </label>
    </div>

    <p class="result-count" data-result-count role="status" aria-live="polite"></p>
    <div data-results></div>
  `;

  const input = root.querySelector('[data-field="q"]');
  const results = root.querySelector("[data-results]");
  const count = root.querySelector("[data-result-count]");
  const sortSelect = root.querySelector('[data-field="sort"]');

  root.addEventListener("input", onInput);
  root.addEventListener("change", onChange);
  root.addEventListener("click", onClick);

  let timer = 0;

  updateResults();
  window.setTimeout(() => {
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }, 40);

  return {
    root,
    title: "Search",
    destroy() {
      clearTimeout(timer);
      root.removeEventListener("input", onInput);
      root.removeEventListener("change", onChange);
      root.removeEventListener("click", onClick);
    },
  };

  function onInput(event) {
    if (event.target !== input) return;
    state.q = input.value;
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      updateResults();
      syncURL();
    }, 130);
  }

  function onChange(event) {
    const field = event.target.closest("[data-field]");
    if (!field || field === input) return;
    state[field.dataset.field] = field.value;
    updateResults();
    syncURL();
  }

  function onClick(event) {
    if (event.target.closest('[data-action="clear"]')) {
      state.q = "";
      state.book = "";
      state.folder = "";
      state.sort = "";
      state.from = "";
      state.to = "";
      input.value = "";
      root.querySelectorAll("[data-field]").forEach((field) => {
        if (field !== input) field.value = "";
      });
      updateResults();
      syncURL();
      input.focus();
    }
  }

  function syncURL() {
    const query = new URLSearchParams();
    if (state.q) query.set("q", state.q);
    if (state.book) query.set("book", state.book);
    if (state.folder) query.set("folder", state.folder);
    if (state.sort) query.set("sort", state.sort);
    if (state.from) query.set("from", state.from);
    if (state.to) query.set("to", state.to);

    const suffix = query.toString() ? `?${query.toString()}` : "";
    history.replaceState(null, "", `${location.pathname}${location.search}#/search${suffix}`);
  }

  function updateResults() {
    const query = state.q.trim();
    let rows = store.liveEntries();

    if (state.book) rows = rows.filter((entry) => entry.bookId === state.book);
    if (state.folder) rows = rows.filter((entry) => entry.folderId === state.folder);
    if (state.from) rows = rows.filter((entry) => entry.date >= state.from);
    if (state.to) rows = rows.filter((entry) => entry.date <= state.to);

    if (query) {
      const ranked = searchEntries(rows, query, { books, folders });
      rows = ranked.map((result) => result.entry);
    }

    if (state.sort === "newest") {
      rows = [...rows].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt));
    } else if (state.sort === "oldest") {
      rows = [...rows].sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : a.createdAt - b.createdAt));
    } else if (state.sort === "updated") {
      rows = [...rows].sort((a, b) => b.updatedAt - a.updatedAt);
    } else if (!query) {
      rows = [...rows].sort((a, b) => (a.date < b.date ? 1 : -1));
    }

    const filtered = Boolean(state.book || state.folder || state.from || state.to);

    syncSortOptions(query);

    count.textContent = query
      ? `${rows.length} ${rows.length === 1 ? "result" : "results"} for “${query}”`
      : `${rows.length} ${rows.length === 1 ? "entry" : "entries"}${filtered ? " match these filters" : ""}`;

    if (!rows.length) {
      results.innerHTML = `
        <div class="empty">
          <h2 class="display">${query ? "Nothing found." : store.liveEntries().length ? "Nothing here." : "Nothing to search yet."}</h2>
          <p>${
            query
              ? "Try a shorter word, or loosen the filters. Search looks at titles, prose, book names, and folders."
              : store.liveEntries().length
                ? "These filters leave nothing behind. Clear them and try again."
                : "Write an entry first — even one sentence gives search something to hold."
          }</p>
          <div class="empty-actions">
            ${
              filtered || query
                ? `<button class="btn" type="button" data-action="clear">Clear search</button>`
                : `<a class="btn btn--primary" href="#/library">Go to the library</a>`
            }
          </div>
        </div>
      `;
      return;
    }

    results.innerHTML = `
      <ol class="entries">
        ${rows
          .map((entry) => {
            const book = store.bookById(entry.bookId);
            const folder = store.folderById(entry.folderId);
            const label = titleOf(entry);
            const titleHTML = query ? highlight(entry.title?.trim() ? entry.title : label, query) : esc(label);
            const body = query ? highlight(snippet(entry, query), query) : esc(snippet(entry, ""));
            const words = wordCount(entry.body);

            return `
              <li class="entry-row">
                <a class="entry-link" href="#/write/${esc(entry.id)}" aria-label="Open ${esc(label)}"></a>
                <span class="entry-date">${esc(formatDate(entry.date, "short"))}</span>
                <span>
                  <span class="entry-title">${titleHTML}</span>
                  ${body ? `<span class="entry-excerpt">${body}</span>` : ""}
                </span>
                <span class="entry-meta">
                  <span class="entry-book">${esc(book?.title || "")}</span>
                  ${folder ? `<span aria-hidden="true">·</span><span>${esc(folder.name)}</span>` : ""}
                  <span aria-hidden="true">·</span>
                  <span>${words} ${words === 1 ? "word" : "words"}</span>
                  <button class="entry-menu-btn" type="button" data-menu="${esc(entry.id)}"
                    aria-label="More for ${esc(label)}" aria-haspopup="menu">⋯</button>
                </span>
              </li>
            `;
          })
          .join("")}
      </ol>
    `;
  }

  /**
   * "Newest first" is only a real choice once a query exists; without one it
   * is the default and the first option already says so. Keeping one option
   * per label avoids the confusing duplicate the select used to show.
   */
  function syncSortOptions(query) {
    if (!sortSelect) return;
    const first = sortSelect.options[0];
    if (first) first.textContent = query ? "Best match" : "Newest first";

    let newest = sortSelect.querySelector('option[value="newest"]');
    if (query && !newest) {
      newest = document.createElement("option");
      newest.value = "newest";
      newest.textContent = "Newest first";
      sortSelect.insertBefore(newest, sortSelect.options[1] || null);
      if (state.sort === "newest") newest.selected = true;
    } else if (!query && newest) {
      if (sortSelect.value === "newest") sortSelect.value = "";
      newest.remove();
    }
  }
}
