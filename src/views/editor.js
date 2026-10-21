/* ============================================================
   APPY — the writing room
   One page, autosaved as you type, with a draft kept in the
   corner in case the browser leaves without saying goodbye.
   ============================================================ */

import { debounce, esc, h } from "../ui/dom.js";
import { icon, menu, toast } from "../ui/kit.js";
import { pageHead } from "../ui/shell.js";
import * as store from "../core/store.js";
import { MOODS, isISODate, plainText, readingMinutes, todayISO, wordCount } from "../core/model.js";
import { clearDraft, readDraft, saveDraft } from "../core/draft.js";
import { missingView } from "./missing.js";
import {
  createBookFlow,
  moveEntryDialog,
  readBook,
  trashEntryWithUndo,
} from "./actions.js";

export function editorView(route) {
  const entryId = route.params[0] || null;
  const existing = entryId ? store.entryById(entryId) : null;

  if (entryId && (!existing || existing.deletedAt)) {
    return missingView({
      title: "That entry is not here",
      message: existing?.deletedAt
        ? "It is in the trash. Restore it from there and it will open again."
        : "It may have been deleted on another tab.",
      back: "/trash",
      backLabel: "Open the trash",
    });
  }

  let book = existing ? store.bookById(existing.bookId) : null;
  if (!book) {
    const wanted = route.query.book || store.settings().lastBookId;
    book = store.bookById(wanted) || store.bookOptions()[0] || null;
  }

  if (!book) return noBookView();

  const draft = readDraft();
  const canRecover =
    draft &&
    draft.entryId === (existing?.id || null) &&
    draft.at > (existing?.updatedAt || 0) &&
    (draft.title || draft.body);

  let model = {
    id: existing?.id || null,
    bookId: existing?.bookId || book.id,
    folderId:
      existing?.folderId ||
      (route.query.folder && store.folderById(route.query.folder)?.id) ||
      null,
    title: canRecover ? draft.title || "" : existing?.title || "",
    body: canRecover ? draft.body || "" : existing?.body || "",
    date:
      existing?.date ||
      (isISODate(route.query.date) ? route.query.date : todayISO()),
    mood: existing?.mood || null,
    createdAt: existing?.createdAt || Date.now(),
    updatedAt: existing?.updatedAt || Date.now(),
  };

  if (canRecover) {
    model.date = isISODate(draft.date) ? draft.date : model.date;
    model.mood = draft.mood || model.mood;
    clearDraft();
  }

  let createdHere = false;
  let dirty = false;
  let gone = false;
  let saving = false;
  let pending = false;
  let serial = 0;

  const root = h("div", { class: "editor" });
  root.innerHTML = template();
  root.addEventListener("input", onInput);
  root.addEventListener("change", onChange);
  root.addEventListener("click", onClick);
  root.addEventListener("paste", onPaste);
  root.addEventListener("drop", onDrop);

  const titleEl = root.querySelector('[data-field="title"]');
  const bodyEl = root.querySelector('[data-field="body"]');
  const dateEl = root.querySelector('[data-field="date"]');
  const bookEl = root.querySelector('[data-field="book"]');
  const folderEl = root.querySelector('[data-field="folder"]');
  const moodEl = root.querySelector('[data-field="mood"]');
  const stateEl = root.querySelector("[data-save-state]");
  const wordsEl = root.querySelector("[data-words]");
  const minutesEl = root.querySelector("[data-minutes]");
  const backEl = root.querySelector("[data-back]");

  const updateCounts = debounce(() => {
    const words = wordCount(model.body);
    if (wordsEl) wordsEl.textContent = `${words} ${words === 1 ? "word" : "words"}`;
    if (minutesEl) {
      const minutes = readingMinutes(words);
      minutesEl.textContent = words ? `${minutes} min read` : "Not started";
    }
  }, 160);

  const saveSoon = debounce(() => persist(), 450);
  const draftSoon = debounce(() => writeDraft(), 600);

  bodyEl.innerHTML = model.body;
  titleEl.value = model.title;
  dateEl.value = model.date;
  bookEl.value = model.bookId;
  folderEl.value = model.folderId || "";
  moodEl.value = model.mood || "";

  resizeTitle();
  refreshPlaceholder();
  updateCounts();
  setState(existing ? "saved" : "idle", existing ? "Saved" : "New entry");

  try {
    document.execCommand("defaultParagraphSeparator", false, "p");
  } catch {
    /* older engines keep their own default */
  }

  document.addEventListener("selectionchange", onSelectionChange);
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", onPageHide);

  if (canRecover) {
    toast("Unsaved writing was recovered from the last session.");
    // Recovered words deserve to be saved for real, not just held on screen.
    markDirty();
    setState("idle", "Recovered");
  }

  if (!existing) window.setTimeout(() => titleEl.focus(), 30);

  return {
    root,
    title: existing ? "Edit entry" : "New entry",
    destroy,
  };

  /* ---------- template ---------- */

  function template() {
    const bookOptions = store
      .bookOptions()
      .map(
        (item) =>
          `<option value="${esc(item.id)}" ${item.id === model.bookId ? "selected" : ""}>${esc(item.title)}</option>`
      )
      .join("");

    const folderOptions = store
      .folders()
      .map(
        (folder) =>
          `<option value="${esc(folder.id)}" ${folder.id === model.folderId ? "selected" : ""}>${esc(
            folder.name
          )}</option>`
      )
      .join("");

    const moodOptions = MOODS.map(
      (mood) =>
        `<option value="${esc(mood.id)}" ${mood.id === model.mood ? "selected" : ""}>${esc(mood.label)}</option>`
    ).join("");

    return `
      <h1 class="sr-only">${existing ? "Edit entry" : "New entry"}</h1>

      <div class="editor-bar">
        <a class="btn btn--ghost btn--sm" data-back href="#/book/${esc(model.bookId)}">${icon("arrowLeft")} Book</a>
        <span class="save-state" data-save-state data-state="idle">New entry</span>
        <span class="spacer"></span>
        <button class="btn btn--ghost btn--sm" type="button" data-action="read">${icon("book")} Read</button>
        <button class="btn btn--ghost btn--sm" type="button" data-action="more" aria-label="Entry actions" aria-haspopup="menu">⋯</button>
        <button class="btn btn--primary btn--sm" type="button" data-action="done">Done</button>
      </div>

      <div class="editor-meta">
        <label class="field">
          <span class="label">Date</span>
          <input class="input" type="date" data-field="date" value="${esc(model.date)}" />
        </label>
        <label class="field">
          <span class="label">Book</span>
          <select class="select" data-field="book">${bookOptions}</select>
        </label>
        <label class="field">
          <span class="label">Folder</span>
          <select class="select" data-field="folder">
            <option value="">No folder</option>
            ${folderOptions}
          </select>
        </label>
        <label class="field">
          <span class="label">Mood</span>
          <select class="select" data-field="mood">
            <option value="">Not saying</option>
            ${moodOptions}
          </select>
        </label>
      </div>

      <textarea
        class="editor-title"
        data-field="title"
        rows="1"
        maxlength="180"
        placeholder="Give this day a title"
        aria-label="Entry title"
      ></textarea>

      <div class="toolbar" role="toolbar" aria-label="Formatting">
        <button class="tool" type="button" data-cmd="bold" aria-label="Bold" aria-pressed="false"><b>B</b></button>
        <button class="tool" type="button" data-cmd="italic" aria-label="Italic" aria-pressed="false"><i>I</i></button>
        <span class="tool-sep" aria-hidden="true"></span>
        <button class="tool" type="button" data-cmd="h3" aria-label="Heading" aria-pressed="false">H</button>
        <button class="tool" type="button" data-cmd="blockquote" aria-label="Quotation" aria-pressed="false">❝</button>
        <button class="tool" type="button" data-cmd="insertUnorderedList" aria-label="Bulleted list" aria-pressed="false">•</button>
        <button class="tool" type="button" data-cmd="insertOrderedList" aria-label="Numbered list" aria-pressed="false">1.</button>
      </div>

      <div
        class="editor-body"
        data-field="body"
        contenteditable="true"
        role="textbox"
        aria-multiline="true"
        aria-label="Entry body"
        data-placeholder="Write what happened. Nobody else will read it unless you export it."
        spellcheck="true"
      ></div>

      <footer class="editor-foot">
        <span data-words></span>
        <span aria-hidden="true">·</span>
        <span data-minutes></span>
        <span class="spacer"></span>
        <span class="dim">Saved automatically</span>
      </footer>
    `;
  }

  /* ---------- events ---------- */

  function onInput(event) {
    if (gone) return;

    if (event.target === titleEl) resizeTitle();
    if (event.target === bodyEl) {
      refreshPlaceholder();
      bodyEl.style.minHeight = "";
    }

    model.title = titleEl.value;
    model.body = bodyEl.innerHTML;
    model.date = dateEl.value || model.date;

    markDirty();
  }

  function onChange(event) {
    if (gone) return;

    if (event.target === dateEl) {
      model.date = dateEl.value || model.date;
      markDirty();
      persist();
      return;
    }
    if (event.target === bookEl) {
      model.bookId = bookEl.value;
      backEl.setAttribute("href", `#/book/${model.bookId}`);
      markDirty();
      persist();
      return;
    }
    if (event.target === folderEl) {
      model.folderId = folderEl.value || null;
      markDirty();
      persist();
      return;
    }
    if (event.target === moodEl) {
      model.mood = moodEl.value || null;
      markDirty();
      persist();
    }
  }

  function onClick(event) {
    const tool = event.target.closest("[data-cmd]");
    if (tool) {
      event.preventDefault();
      applyCommand(tool.dataset.cmd);
      return;
    }

    const button = event.target.closest("[data-action]");
    if (!button) return;

    const action = button.dataset.action;

    if (action === "done") {
      finish();
    }

    if (action === "read") {
      persist().then(() => {
        if (model.id) readBook(model.bookId, model.id);
        else readBook(model.bookId);
      });
    }

    if (action === "more") {
      if (!model.id) {
        toast("Nothing to move yet — start writing first.");
        return;
      }
      const entry = store.entryById(model.id);
      menu(button, [
        {
          label: "Move…",
          onSelect: async () => {
            const moved = await moveEntryDialog(entry);
            if (!moved) return;
            // The dialog moved the stored entry; the open page has to agree,
            // or the next autosave would quietly move it back.
            const fresh = store.entryById(entry.id);
            if (!fresh) return;
            model.bookId = fresh.bookId;
            model.folderId = fresh.folderId;
            bookEl.value = fresh.bookId;
            folderEl.value = fresh.folderId || "";
            backEl.setAttribute("href", `#/book/${fresh.bookId}`);
          },
        },
        "-",
        {
          label: "Move to trash",
          danger: true,
          onSelect: async () => {
            gone = true;
            saveSoon.cancel();
            draftSoon.cancel();
            clearDraft();
            await trashEntryWithUndo(entry);
            location.hash = `#/book/${entry.bookId}`;
          },
        },
      ]);
    }
  }

  function onSelectionChange() {
    if (!root.isConnected) return;
    const selection = document.getSelection();
    if (!selection || !selection.anchorNode || !bodyEl.contains(selection.anchorNode)) return;

    root.querySelectorAll("[data-cmd]").forEach((button) => {
      const cmd = button.dataset.cmd;
      let pressed = false;
      try {
        if (cmd === "h3" || cmd === "blockquote") {
          const block = String(document.queryCommandValue("formatBlock") || "")
            .toLowerCase()
            .replace(/[<>]/g, "");
          pressed = block === cmd;
        } else {
          pressed = document.queryCommandState(cmd);
        }
      } catch {
        pressed = false;
      }
      button.setAttribute("aria-pressed", String(pressed));
    });
  }

  function onVisibility() {
    if (document.visibilityState === "hidden" && dirty) {
      writeDraft();
      persist();
    }
  }

  /**
   * Paste as plain text. It keeps the words, drops the styling, and never
   * pulls in remote images or event handlers from another page.
   */
  function onPaste(event) {
    if (event.target !== bodyEl) return;
    const text = event.clipboardData?.getData("text/plain") || "";
    if (!text) return;

    event.preventDefault();
    const html = text
      .replace(/\r\n?/g, "\n")
      .split(/\n{2,}/)
      .map((block) => `<p>${esc(block).replace(/\n/g, "<br>")}</p>`)
      .join("");
    const ok = document.execCommand("insertHTML", false, html);
    if (!ok) document.execCommand("insertText", false, text);
    model.body = bodyEl.innerHTML;
    markDirty();
    refreshPlaceholder();
  }

  function onDrop(event) {
    // A dropped HTML fragment would bypass the plain-text rule.
    if (event.dataTransfer?.types?.includes("text/html")) {
      event.preventDefault();
      toast("Drop text, not a web page. Paste keeps the words.");
    }
  }

  function onPageHide() {
    if (dirty) writeDraft();
  }

  /* ---------- editing ---------- */

  function applyCommand(cmd) {
    bodyEl.focus();

    if (cmd === "h3" || cmd === "blockquote") {
      const current = String(document.queryCommandValue("formatBlock") || "")
        .toLowerCase()
        .replace(/[<>]/g, "");
      const next = current === cmd ? "p" : cmd;
      document.execCommand("formatBlock", false, `<${next}>`);
    } else {
      document.execCommand(cmd, false, null);
    }

    model.body = bodyEl.innerHTML;
    markDirty();
    refreshPlaceholder();
    onSelectionChange();
  }

  function resizeTitle() {
    titleEl.style.height = "auto";
    titleEl.style.height = `${titleEl.scrollHeight}px`;
  }

  function refreshPlaceholder() {
    const empty = !bodyEl.textContent.trim() && !bodyEl.querySelector("img");
    bodyEl.dataset.empty = String(empty);
  }

  function markDirty() {
    serial += 1;
    dirty = true;
    if (!createdHere && !model.id) setState("idle", "Draft");
    updateCounts();
    saveSoon();
    draftSoon();
  }

  function hasContent() {
    return Boolean(String(model.title || "").trim() || plainText(model.body).trim());
  }

  /* ---------- saving ---------- */

  async function persist() {
    if (gone) return;
    if (saving) {
      pending = true;
      return;
    }

    if (!hasContent() && !model.id) {
      setState("idle", "Draft");
      return;
    }

    const hadId = Boolean(model.id);
    saving = true;
    const ticket = serial;
    setState("saving", "Saving…");

    try {
      const saved = await store.saveEntry(
        {
          ...model,
          id: model.id || undefined,
          createdAt: model.createdAt,
        },
        { silent: true }
      );

      model = { ...saved };
      if (!hadId) {
        createdHere = true;
        // The entry exists now; a reload should reopen it, not start another blank one.
        history.replaceState(null, "", `#/write/${model.id}`);
      }
      backEl.setAttribute("href", `#/book/${model.bookId}`);

      if (ticket === serial) {
        dirty = false;
        clearDraft();
        setState("saved", "Saved");
      }
    } catch (error) {
      setState("error", error?.code === "quota" ? "No room" : "Not saved");
      toast(error?.message || "Could not save. Your writing is still on screen.", {
        tone: "error",
        duration: 8000,
      });
    } finally {
      saving = false;
      if (pending) {
        pending = false;
        persist();
      }
    }
  }

  function writeDraft() {
    if (gone) return;
    if (!dirty && model.id) return;

    saveDraft({
      entryId: model.id,
      bookId: model.bookId,
      folderId: model.folderId,
      title: model.title,
      body: model.body,
      date: model.date,
      mood: model.mood,
    });
  }

  function setState(state, label) {
    if (!stateEl) return;
    stateEl.dataset.state = state;
    stateEl.textContent = label;
    stateEl.title =
      state === "error"
        ? "The last save failed. Your writing is still here — try again."
        : label;
  }

  /* ---------- leaving ---------- */

  async function finish() {
    saveSoon.cancel();
    draftSoon.cancel();

    if (dirty || (!createdHere && hasContent())) {
      await persist();
    }

    if (gone) return;

    if (createdHere && !hasContent() && model.id) {
      await store.purgeEntry(model.id);
    }

    if (model.bookId) location.hash = `#/book/${model.bookId}`;
    else location.hash = "#/library";
  }

  function destroy() {
    document.removeEventListener("selectionchange", onSelectionChange);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("pagehide", onPageHide);
    root.removeEventListener("paste", onPaste);
    root.removeEventListener("drop", onDrop);

    saveSoon.cancel();
    draftSoon.cancel();

    if (gone) return;

    if (dirty && hasContent()) {
      // Best effort on the way out; the draft is the backstop.
      writeDraft();
      store
        .saveEntry({ ...model, id: model.id || undefined }, { silent: true })
        .then(() => clearDraft())
        .catch(() => {});
    } else if (createdHere && model.id && !hasContent()) {
      store.purgeEntry(model.id).catch(() => {});
    }
  }
}

function noBookView() {
  const root = h("div");
  root.innerHTML = `
    ${pageHead({ eyebrow: "Writing", title: "A book comes first." })}
    <div class="empty">
      <p>An entry has to live in a book, so that it has a cover to sit behind and a shelf to come home to.</p>
      <div class="empty-actions">
        <button class="btn btn--primary" type="button" data-action="new-book">Create a book</button>
      </div>
    </div>
  `;
  root.addEventListener("click", (event) => {
    if (event.target.closest('[data-action="new-book"]')) createBookFlow({ thenWrite: true });
  });
  return { root, title: "Writing", destroy() {} };
}
