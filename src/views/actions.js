/* ============================================================
   APPY — product actions
   The rules live here: what creating, moving, and deleting
   actually do, and what the person is told afterwards.
   ============================================================ */

import { h, esc } from "../ui/dom.js";
import { confirmDialog, menu, modal, toast } from "../ui/kit.js";
import { navigate } from "../ui/router.js";
import * as store from "../core/store.js";
import { COVER_ACCENTS, COVER_STYLES, FOLDER_COLORS, titleOf } from "../core/model.js";

const STYLE_LABELS = {
  linen: "Linen",
  cloth: "Cloth",
  leather: "Leather",
  paper: "Paper",
  night: "Midnight",
};

const STYLE_DEFAULT = {
  linen: "#6a6250",
  cloth: "#3f4f5c",
  leather: "#6b3a2a",
  paper: "#b8a884",
  night: "#232833",
};

/* ---------- writing ---------- */

export function startNewEntry({ bookId = null, date = null, folderId = null } = {}) {
  const preferred =
    (bookId && store.bookById(bookId)) ||
    store.bookById(store.settings().lastBookId) ||
    store.bookOptions()[0];

  if (!preferred) {
    return createBookFlow({ thenWrite: true, date });
  }

  const query = new URLSearchParams();
  if (preferred.id) query.set("book", preferred.id);
  if (date) query.set("date", date);
  if (folderId) query.set("folder", folderId);
  navigate(`/write?${query.toString()}`);
  return null;
}

export function openEntry(id) {
  navigate(`/write/${encodeURIComponent(id)}`);
}

export function readBook(bookId, entryId = null) {
  navigate(
    `/read/${encodeURIComponent(bookId)}${
      entryId ? `?entry=${encodeURIComponent(entryId)}` : ""
    }`
  );
}

export function bookMenu(book, anchor) {
  menu(anchor, [
    { label: "Open book", onSelect: () => navigate(`/book/${book.id}`) },
    { label: "Read book", onSelect: () => readBook(book.id) },
    "-",
    { label: "Book settings", onSelect: () => bookSettingsFlow(book) },
    { label: "Delete book", danger: true, onSelect: () => deleteBookFlow(book) },
  ]);
}

export function folderMenu(folder, anchor) {
  menu(anchor, [
    { label: "Open folder", onSelect: () => navigate(`/folder/${folder.id}`) },
    { label: "Folder settings", onSelect: () => folderSettingsFlow(folder) },
    "-",
    { label: "Delete folder", danger: true, onSelect: () => deleteFolderFlow(folder) },
  ]);
}

/* ---------- entries ---------- */

export function entryMenu(entryId, anchor) {
  const entry = store.entryById(entryId);
  if (!entry) return;

  menu(anchor, [
    { label: "Open entry", onSelect: () => openEntry(entry.id) },
    { label: "Read in book", onSelect: () => readBook(entry.bookId, entry.id) },
    { label: "Move…", onSelect: () => moveEntryDialog(entry) },
    "-",
    { label: "Move to trash", danger: true, onSelect: () => trashEntryWithUndo(entry) },
  ]);
}

export async function trashEntryWithUndo(entry) {
  const label = titleOf(entry);
  await store.trashEntry(entry.id);
  toast(`“${label}” moved to the trash.`, {
    action: {
      label: "Undo",
      onClick: () => {
        store.restoreEntry(entry.id);
        toast("Entry restored.");
      },
    },
    duration: 6000,
  });
}

export function moveEntryDialog(entry) {
  const books = store.bookOptions();
  const folders = store.folders();

  const bookField = h("label", { class: "field" });
  bookField.append(h("span", { class: "label", text: "Book" }));
  const bookSelect = h(
    "select",
    { class: "select" },
    books.map((book) =>
      h("option", { value: book.id, selected: book.id === entry.bookId }, esc(book.title))
    )
  );
  bookField.append(bookSelect);

  const folderField = h("label", { class: "field" });
  folderField.append(h("span", { class: "label", text: "Folder" }));
  const folderSelect = h(
    "select",
    { class: "select" },
    h("option", { value: "", selected: !entry.folderId }, "No folder"),
    folders.map((folder) =>
      h("option", { value: folder.id, selected: folder.id === entry.folderId }, esc(folder.name))
    )
  );
  folderField.append(folderSelect);

  return modal({
    title: "Move entry",
    lede: "An entry lives in exactly one book. Folders group it by subject, across books.",
    body: h("div", { class: "stack" }, bookField, folderField),
    submitLabel: "Move",
    onSubmit: async () => {
      const bookId = bookSelect.value;
      const folderId = folderSelect.value || null;
      await store.moveEntry(entry.id, { bookId, folderId });
      toast("Entry moved.");
      return true;
    },
  });
}

/* ---------- books ---------- */

function bookForm({ title = "", subtitle = "", cover = {} } = {}) {
  const style = COVER_STYLES.includes(cover.style) ? cover.style : "cloth";
  let accent = cover.accent || STYLE_DEFAULT[style];

  const preview = h("span", { class: "cover", dataset: { style }, "aria-hidden": "true" });
  Object.assign(preview.style, { width: "5.4rem", aspectRatio: "3 / 4.3", flex: "0 0 auto" });
  preview.innerHTML = `
    <span class="cover-kicker">Diary</span>
    <span class="cover-title"></span>
    <span><span class="cover-rule"></span><span class="cover-foot"></span></span>
  `;
  const previewTitle = preview.querySelector(".cover-title");
  const previewFoot = preview.querySelector(".cover-foot");
  previewTitle.textContent = title || "Untitled";
  previewFoot.textContent = subtitle || "New book";

  const paint = () => {
    preview.dataset.style = style;
    preview.style.setProperty("--cover", accent);
  };
  paint();

  const titleInput = h("input", {
    class: "input",
    type: "text",
    value: title,
    placeholder: "Spring, slowly",
    maxlength: "120",
    autocomplete: "off",
    required: true,
  });
  titleInput.addEventListener("input", () => {
    previewTitle.textContent = titleInput.value.trim() || "Untitled";
  });

  const subtitleInput = h("input", {
    class: "input",
    type: "text",
    value: subtitle,
    placeholder: "A daily diary",
    maxlength: "120",
    autocomplete: "off",
  });
  subtitleInput.addEventListener("input", () => {
    previewFoot.textContent = subtitleInput.value.trim() || "New book";
  });

  const styleField = h("label", { class: "field" });
  styleField.append(h("span", { class: "label", text: "Cover material" }));
  const styleSelect = h(
    "select",
    { class: "select" },
    COVER_STYLES.map((id) => h("option", { value: id, selected: id === style }, STYLE_LABELS[id]))
  );
  styleField.append(styleSelect);

  const swatchRow = h("div", { class: "swatches", role: "group", "aria-label": "Cover colour" });
  const swatches = COVER_ACCENTS.map((color) => {
    const button = h("button", {
      class: "swatch",
      type: "button",
      "aria-label": `Cover colour ${color}`,
      "aria-pressed": String(color.toLowerCase() === accent.toLowerCase()),
      style: { "--swatch": color },
    });
    button.addEventListener("click", () => {
      accent = color;
      swatches.forEach((swatch) => swatch.setAttribute("aria-pressed", "false"));
      button.setAttribute("aria-pressed", "true");
      paint();
    });
    return button;
  });
  swatchRow.append(...swatches);

  styleSelect.addEventListener("change", () => {
    const next = styleSelect.value;
    preview.dataset.style = next;
    accent = STYLE_DEFAULT[next];
    paint();
    swatches.forEach((swatch) => {
      const color = swatch.style.getPropertyValue("--swatch").trim().toLowerCase();
      swatch.setAttribute("aria-pressed", String(color === accent.toLowerCase()));
    });
  });

  const colourField = h("div", { class: "field" });
  colourField.append(h("span", { class: "label", text: "Cover colour" }));
  colourField.append(swatchRow);

  const titleField = h("label", { class: "field" });
  titleField.append(h("span", { class: "label", text: "Title" }));
  titleField.append(titleInput);

  const subtitleField = h("label", { class: "field" });
  subtitleField.append(h("span", { class: "label", text: "Subtitle" }));
  subtitleField.append(subtitleInput);

  const layout = h(
    "div",
    { style: { display: "flex", gap: "1.25rem", alignItems: "flex-start" } },
    preview,
    h("div", { class: "stack", style: { flex: "1", minWidth: "0" } }, titleField, subtitleField)
  );

  return {
    body: h("div", { class: "stack" }, layout, styleField, colourField),
    read: () => {
      const cleanTitle = titleInput.value.trim();
      if (!cleanTitle) throw new Error("Give the book a title.");
      return {
        title: cleanTitle,
        subtitle: subtitleInput.value.trim(),
        cover: { style: styleSelect.value, accent },
      };
    },
    focus: titleInput,
  };
}

export async function createBookFlow({ thenWrite = false, date = null } = {}) {
  const form = bookForm();

  const created = await modal({
    title: "New book",
    lede: "A book is a diary you write in. Make one for a year, a trip, or a season of your life.",
    body: form.body,
    submitLabel: "Create book",
    onSubmit: () => store.createBook(form.read()),
    initialFocus: form.focus,
    closeValue: null,
  });

  if (!created) return null;
  toast(`“${created.title}” created.`);
  if (thenWrite) {
    const query = new URLSearchParams({ book: created.id });
    if (date) query.set("date", date);
    navigate(`/write?${query.toString()}`);
  }
  return created;
}

export async function bookSettingsFlow(book) {
  const form = bookForm(book);

  const result = await modal({
    title: "Book settings",
    lede: "Title, subtitle, and cover. Changes appear everywhere the book does.",
    body: form.body,
    submitLabel: "Save changes",
    onSubmit: () => store.updateBook(book.id, form.read()),
    initialFocus: form.focus,
    closeValue: null,
  });

  if (result) toast("Book updated.");
  return result;
}

export async function deleteBookFlow(book) {
  const stats = store.bookStats(book.id);
  const others = store.bookOptions().filter((other) => other.id !== book.id);

  if (!stats.entries) {
    const ok = await confirmDialog({
      title: `Delete “${book.title}”?`,
      message: "This book is empty, so nothing will be lost.",
      confirmLabel: "Delete book",
    });
    if (!ok) return false;

    await store.deleteBook(book.id);
    toast(`“${book.title}” deleted.`);
    navigate("/library");
    return true;
  }

  const select = h(
    "select",
    { class: "select" },
    others.map((other) => h("option", { value: other.id }, esc(other.title))),
    h("option", { value: "trash" }, "Move them to the trash")
  );

  const field = h("label", { class: "field" });
  field.append(h("span", { class: "label", text: "Where should the entries go?" }));
  field.append(select);
  field.append(
    h("p", {
      class: "dim",
      style: { fontSize: "0.8rem", marginTop: "0.4rem" },
      text: `${stats.entries} ${stats.entries === 1 ? "entry" : "entries"} will move. Nothing is destroyed.`,
    })
  );

  const confirmed = await modal({
    title: `Delete “${book.title}”?`,
    lede: "The book goes away. Its writing has to land somewhere.",
    body: field,
    submitLabel: "Delete book",
    danger: true,
    onSubmit: () => true,
    closeValue: false,
  });

  if (!confirmed) return false;

  await store.deleteBook(book.id, { moveEntriesTo: select.value });
  toast(
    select.value === "trash"
      ? `“${book.title}” deleted. Its entries are in the trash.`
      : `“${book.title}” deleted. Its entries moved.`
  );
  navigate("/library");
  return true;
}

/* ---------- folders ---------- */

function colourSwatches(initial, onChange) {
  let current = initial;
  const row = h("div", { class: "swatches", role: "group", "aria-label": "Folder colour" });
  const buttons = FOLDER_COLORS.map((color) => {
    const button = h("button", {
      class: "swatch",
      type: "button",
      "aria-label": `Folder colour ${color}`,
      "aria-pressed": String(color.toLowerCase() === current.toLowerCase()),
      style: { "--swatch": color },
    });
    button.addEventListener("click", () => {
      current = color;
      buttons.forEach((item) => item.setAttribute("aria-pressed", "false"));
      button.setAttribute("aria-pressed", "true");
      onChange?.(color);
    });
    return button;
  });
  row.append(...buttons);
  return { row, get: () => current };
}

export async function createFolderFlow() {
  const field = h("label", { class: "field" });
  field.append(h("span", { class: "label", text: "Name" }));
  const input = h("input", {
    class: "input",
    type: "text",
    placeholder: "Travel, Dreams, Studies…",
    maxlength: "80",
    autocomplete: "off",
    required: true,
  });
  field.append(input);

  const colours = colourSwatches(FOLDER_COLORS[0]);
  const colourField = h("div", { class: "field" });
  colourField.append(h("span", { class: "label", text: "Colour" }));
  colourField.append(colours.row);

  const created = await modal({
    title: "New folder",
    lede: "Folders group entries by subject, across every book.",
    body: h("div", { class: "stack" }, field, colourField),
    submitLabel: "Create folder",
    onSubmit: () => {
      const name = input.value.trim();
      if (!name) throw new Error("Give the folder a name.");
      return store.createFolder({ name, color: colours.get() });
    },
    initialFocus: input,
    closeValue: null,
  });

  if (created) toast(`“${created.name}” created.`);
  return created;
}

export async function folderSettingsFlow(folder) {
  const field = h("label", { class: "field" });
  field.append(h("span", { class: "label", text: "Name" }));
  const input = h("input", {
    class: "input",
    type: "text",
    value: folder.name,
    maxlength: "80",
    autocomplete: "off",
    required: true,
  });
  field.append(input);

  const colours = colourSwatches(folder.color);
  const colourField = h("div", { class: "field" });
  colourField.append(h("span", { class: "label", text: "Colour" }));
  colourField.append(colours.row);

  const changed = await modal({
    title: "Folder settings",
    lede: "Renaming or recolouring never moves the entries inside it.",
    body: h("div", { class: "stack" }, field, colourField),
    submitLabel: "Save changes",
    onSubmit: () => {
      const name = input.value.trim();
      if (!name) throw new Error("Give the folder a name.");
      return store.updateFolder(folder.id, { name, color: colours.get() });
    },
    initialFocus: input,
    closeValue: null,
  });

  if (changed) toast("Folder updated.");
  return changed;
}

export async function deleteFolderFlow(folder) {
  const count = store.folderCount(folder.id);
  const ok = await confirmDialog({
    title: `Delete “${folder.name}”?`,
    message:
      count === 0
        ? "This folder is empty. Nothing else changes."
        : `${count} ${
            count === 1 ? "entry becomes" : "entries become"
          } unfiled. The writing itself stays exactly where it is.`,
    confirmLabel: "Delete folder",
  });
  if (!ok) return false;

  await store.deleteFolder(folder.id);
  toast(
    count
      ? `“${folder.name}” deleted. ${count} ${
          count === 1 ? "entry is" : "entries are"
        } now unfiled.`
      : `“${folder.name}” deleted.`
  );
  return true;
}
