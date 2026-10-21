/* ============================================================
   APPY — the trash
   Deletion is soft until it is not. Everything here can come
   back, right up until the moment it is emptied.
   ============================================================ */

import { esc, h } from "../ui/dom.js";
import { confirmDialog, toast } from "../ui/kit.js";
import { pageHead } from "../ui/shell.js";
import * as store from "../core/store.js";
import { excerpt, relativeTime, titleOf } from "../core/model.js";

export function trashView() {
  const root = h("div");
  const unsubscribe = store.subscribe(render);
  root.addEventListener("click", onClick);
  render();

  return {
    root,
    title: "Trash",
    destroy() {
      unsubscribe();
      root.removeEventListener("click", onClick);
    },
  };

  async function onClick(event) {
    const restore = event.target.closest("[data-restore]");
    if (restore) {
      await store.restoreEntry(restore.dataset.restore);
      toast("Entry restored to its book.");
      return;
    }

    const purge = event.target.closest("[data-purge]");
    if (purge) {
      const entry = store.entryById(purge.dataset.purge);
      const ok = await confirmDialog({
        title: "Delete this entry forever?",
        message: `“${titleOf(entry)}” will be gone. There is no undo after this.`,
        confirmLabel: "Delete forever",
      });
      if (!ok) return;
      await store.purgeEntry(purge.dataset.purge);
      toast("Entry deleted for good.");
      return;
    }

    if (event.target.closest('[data-action="empty"]')) {
      const count = store.trashedEntries().length;
      if (!count) return;
      const ok = await confirmDialog({
        title: "Empty the trash?",
        message: `${count} ${count === 1 ? "entry" : "entries"} will be deleted forever. Export a backup first if you are unsure.`,
        confirmLabel: "Empty the trash",
      });
      if (!ok) return;
      await store.emptyTrash();
      toast("The trash is empty.");
    }
  }

  function render() {
    const rows = store.trashedEntries();

    root.innerHTML = `
      ${pageHead({
        eyebrow: "Recovery",
        title: "Trash",
        intro: "Deleted entries wait here until you empty the trash. Books and folders never delete writing on their own.",
        actions: rows.length
          ? `<button class="btn btn--danger" type="button" data-action="empty">Empty the trash</button>`
          : "",
      })}

      ${
        rows.length
          ? `<ol class="entries">
              ${rows
                .map((entry) => {
                  const book = store.bookById(entry.bookId);
                  return `
                    <li class="entry-row" style="grid-template-columns:8.5rem minmax(0,1fr) auto">
                      <span class="entry-date">${esc(relativeTime(entry.deletedAt))}</span>
                      <span>
                        <span class="entry-title">${esc(titleOf(entry))}</span>
                        <span class="entry-excerpt">${esc(excerpt(entry.body, 120))}</span>
                      </span>
                      <span class="entry-meta">
                        <span>${esc(book?.title || "No book")}</span>
                        <button class="btn btn--sm" type="button" data-restore="${esc(entry.id)}">Restore</button>
                        <button class="btn btn--sm btn--danger" type="button" data-purge="${esc(entry.id)}">Delete</button>
                      </span>
                    </li>
                  `;
                })
                .join("")}
            </ol>`
          : `<div class="empty">
              <h2 class="display">Nothing in the trash.</h2>
              <p>That is a good sign. Deleted entries appear here so you can change your mind.</p>
              <div class="empty-actions">
                <a class="btn" href="#/library">Back to the library</a>
              </div>
            </div>`
      }
    `;
  }
}
