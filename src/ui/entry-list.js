/* ============================================================
   APPY — entry lists
   The one repeated shape: entries, grouped by month, with a
   quiet month rule between them.
   ============================================================ */

import { esc } from "./dom.js";
import { entryRowHTML } from "./kit.js";
import { monthLabel } from "../core/model.js";
import * as store from "../core/store.js";

export function groupByMonth(entries) {
  const groups = [];
  let current = null;

  for (const entry of entries) {
    const key = entry.date.slice(0, 7);
    if (!current || current.key !== key) {
      current = { key, entries: [] };
      groups.push(current);
    }
    current.entries.push(entry);
  }

  return groups;
}

export function entriesGroupedHTML(entries, { showBook = false, highlight = null } = {}) {
  if (!entries.length) return "";

  return groupByMonth(entries)
    .map((group) => {
      const label = monthLabel(group.key);
      return `
        <section aria-label="${esc(label)}">
          <h3 class="month-head">${esc(label)}</h3>
          <ol class="entries">
            ${group.entries
              .map((entry) =>
                entryRowHTML(entry, {
                  highlight,
                  book: showBook ? store.bookById(entry.bookId)?.title || "" : null,
                })
              )
              .join("")}
          </ol>
        </section>
      `;
    })
    .join("");
}

/** A "show the rest" control for long diaries. */
export function moreLink(hidden, total, action = "show-more") {
  if (!hidden) return "";
  return `
    <p style="margin-top:1.2rem">
      <button class="btn btn--sm" type="button" data-action="${esc(action)}">
        Show the other ${hidden} of ${total}
      </button>
    </p>
  `;
}
