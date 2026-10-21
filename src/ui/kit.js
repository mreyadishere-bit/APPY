/* ============================================================
   APPY — interface kit
   Dialogs, toasts, menus, covers, entry rows, icons. One place
   to change how a repeated thing looks or behaves.
   ============================================================ */

import { $, esc, h, focusSoft } from "./dom.js";
import { excerpt, formatDate, readingMinutes, titleOf, wordCount } from "../core/model.js";

/* ---------- icons ---------- */

const ICONS = {
  arrowLeft: '<path d="M19 12H5"/><path d="m11 18-6-6 6-6"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  more: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  contents: '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h10"/>',
  expand: '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/><path d="M8 21H5a2 2 0 0 1-2-2v-3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>',
  collapse: '<path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M16 3v3a2 2 0 0 0 2 2h3"/><path d="M8 21v-3a2 2 0 0 0-2-2H3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>',
  list: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.9 4.9 1.4 1.4"/><path d="m17.7 17.7 1.4 1.4"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m4.9 19.1 1.4-1.4"/><path d="m17.7 6.3 1.4-1.4"/>',
  moon: '<path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  trash: '<path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
  pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2z"/><path d="M8 3v18"/>',
  folder: '<path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.5-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 4.6a2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 21 11a2 2 0 1 1 0 4z"/>',
  restore: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',
  download: '<path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M4 21h16"/>',
  upload: '<path d="M12 21V9"/><path d="m7 13 5-5 5 5"/><path d="M4 3h16"/>',
  move: '<path d="M5 9h9a3 3 0 0 1 0 6H5"/><path d="m8 6-3 3 3 3"/>',
};

export function icon(name, className = "") {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" class="${className}">${ICONS[name] || ""}</svg>`;
}

/* ---------- toasts ---------- */

let toastTimer = 0;

export function toast(message, { tone = "info", action = null, duration = 4200 } = {}) {
  const root = $("#toastRoot");
  if (!root) return;

  const node = h("div", { class: "toast", dataset: { tone }, role: "status" });
  node.append(h("span", { text: message }));

  if (action) {
    const button = h("button", {
      class: "btn btn--sm btn--ghost",
      type: "button",
      text: action.label,
      onclick: () => {
        remove();
        action.onClick();
      },
    });
    node.append(button);
  }

  const remove = () => {
    clearTimeout(toastTimer);
    node.style.opacity = "0";
    node.style.transform = "translateY(6px)";
    node.style.transition = "opacity 160ms ease, transform 160ms ease";
    setTimeout(() => node.remove(), 170);
  };

  root.append(node);
  toastTimer = setTimeout(remove, duration);
  return remove;
}

/* ---------- modal ---------- */

/**
 * One dialog for every job. `onSubmit` receives the form; if it throws the
 * dialog stays open and shows the message. Resolves with its return value,
 * or null when cancelled.
 */
export function modal({
  title,
  lede = "",
  body = null,
  submitLabel = "Save",
  cancelLabel = "Cancel",
  danger = false,
  wide = false,
  onSubmit = null,
  initialFocus = null,
  closeValue = null,
}) {
  return new Promise((resolve) => {
    const form = h("form", { class: "modal-form", novalidate: true });
    const dialog = h("dialog", { class: "modal", "aria-labelledby": "modalTitle" });
    if (wide) dialog.style.width = "min(38rem, calc(100vw - 2rem))";

    const heading = h("h2", { class: "modal-title", id: "modalTitle", text: title });
    form.append(heading);
    if (lede) form.append(h("p", { class: "modal-lede", text: lede }));

    if (body) {
      const bodyWrap = h("div", { class: "modal-body" });
      if (typeof body === "string") bodyWrap.innerHTML = body;
      else bodyWrap.append(body);
      form.append(bodyWrap);
    }

    const errorLine = h("p", {
      class: "modal-lede",
      role: "alert",
      style: { color: "var(--danger)", margin: "0.8rem 0 0" },
    });
    errorLine.hidden = true;
    form.append(errorLine);

    const actions = h("div", { class: "modal-actions" });
    const cancel = h("button", {
      class: "btn btn--ghost",
      type: "button",
      text: cancelLabel,
    });
    const submit = h("button", {
      class: `btn ${danger ? "btn--danger" : "btn--primary"}`,
      type: "submit",
      text: submitLabel,
    });

    if (onSubmit) {
      actions.append(cancel, submit);
    } else {
      submit.textContent = submitLabel === "Save" ? "Close" : submitLabel;
      actions.append(submit);
      submit.type = "button";
    }

    form.append(actions);
    dialog.append(form);

    let settled = false;

    const finish = (value) => {
      if (settled) return;
      settled = true;
      document.removeEventListener("keydown", onKey, true);
      if (dialog.open) dialog.close();
      dialog.remove();
      resolve(value);
    };

    const onKey = (event) => {
      if (event.key === "Escape" && dialog.open) {
        event.preventDefault();
        finish(closeValue);
      }
    };

    cancel.addEventListener("click", () => finish(closeValue));
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      finish(closeValue);
    });
    document.addEventListener("keydown", onKey, true);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      errorLine.hidden = true;

      if (!onSubmit) {
        finish(closeValue);
        return;
      }

      submit.disabled = true;
      try {
        const value = await onSubmit(form);
        finish(value === undefined ? true : value);
      } catch (error) {
        errorLine.textContent = error?.message || "That did not work. Try again.";
        errorLine.hidden = false;
        submit.disabled = false;
      }
    });

    document.body.append(dialog);
    dialog.showModal();

    const target =
      initialFocus ||
      form.querySelector("input:not([type=hidden]), textarea, select") ||
      submit;
    focusSoft(target);
    if (target.select && target.tagName === "INPUT") target.select();
  });
}

export function confirmDialog({
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  danger = true,
}) {
  return modal({
    title,
    lede: message,
    submitLabel: confirmLabel,
    cancelLabel,
    danger,
    onSubmit: () => true,
    closeValue: false,
  });
}

export function promptDialog({ title, lede = "", label, value = "", placeholder = "", submitLabel = "Save" }) {
  const field = h("label", { class: "field" });
  field.append(h("span", { class: "label", text: label }));
  const input = h("input", {
    class: "input",
    type: "text",
    value,
    placeholder,
    maxlength: "120",
    required: true,
    autocomplete: "off",
  });
  field.append(input);

  return modal({
    title,
    lede,
    body: field,
    submitLabel,
    onSubmit: () => {
      const text = input.value.trim();
      if (!text) throw new Error("Please write something first.");
      return text;
    },
    initialFocus: input,
    closeValue: null,
  });
}

/* ---------- popover menu ---------- */

let openMenu = null;

export function closeMenu() {
  if (!openMenu) return;
  const { element, cleanup } = openMenu;
  element.remove();
  cleanup();
  openMenu = null;
}

export function menu(anchor, items) {
  closeMenu();

  const element = h("div", { class: "menu", role: "menu" });
  items.forEach((item) => {
    if (item === "-") {
      element.append(h("hr"));
      return;
    }
    element.append(
      h("button", {
        type: "button",
        role: "menuitem",
        class: item.danger ? "is-danger" : "",
        text: item.label,
        onclick: () => {
          closeMenu();
          item.onSelect();
        },
      })
    );
  });

  document.body.append(element);

  const rect = anchor.getBoundingClientRect();
  const width = element.offsetWidth;
  const height = element.offsetHeight;
  let left = Math.min(rect.right - width, window.innerWidth - width - 12);
  left = Math.max(12, left);
  let top = rect.bottom + 6;
  if (top + height > window.innerHeight - 12) top = Math.max(12, rect.top - height - 6);

  element.style.left = `${left}px`;
  element.style.top = `${top}px`;

  const onPointerDown = (event) => {
    if (!element.contains(event.target) && !anchor.contains(event.target)) closeMenu();
  };
  const onKey = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
      focusSoft(anchor);
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const buttons = [...element.querySelectorAll("button")];
      const index = buttons.indexOf(document.activeElement);
      const next =
        event.key === "ArrowDown"
          ? buttons[(index + 1) % buttons.length]
          : buttons[(index - 1 + buttons.length) % buttons.length];
      focusSoft(next);
    }
  };

  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("keydown", onKey);
  window.addEventListener("scroll", closeMenu, { passive: true });

  openMenu = {
    element,
    cleanup: () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", closeMenu);
    },
  };

  focusSoft(element.querySelector("button"));
  return element;
}

/* ---------- covers ---------- */

export function coverHTML(book, { count = null, kicker = "Diary" } = {}) {
  const foot =
    count === null ? book.subtitle || "" : `${count} ${count === 1 ? "entry" : "entries"}`;

  return `
    <span class="cover-kicker">${esc(kicker)}</span>
    <span class="cover-title">${esc(book.title)}</span>
    <span>
      <span class="cover-rule" aria-hidden="true"></span>
      <span class="cover-foot">${esc(foot)}</span>
    </span>
  `;
}

export function coverStyle(book) {
  const style = book.cover?.style || "cloth";
  const accent = book.cover?.accent;
  return `data-style="${esc(style)}"${accent ? ` style="--cover:${esc(accent)}"` : ""}`;
}

/* ---------- entry rows ---------- */

export function entryRowHTML(entry, { highlight = null, book = null } = {}) {
  const title = titleOf(entry);
  const titled = Boolean(entry.title?.trim());
  const words = wordCount(entry.body);
  const minutes = readingMinutes(words);
  const body = highlight !== null ? highlight : esc(excerpt(entry.body, 150));
  const titleHTML = highlight !== null && titled ? highlight : esc(title);

  return `
    <li class="entry-row">
      <a class="entry-link" href="#/write/${encodeURIComponent(entry.id)}" aria-label="Open ${esc(title)}"></a>
      <span class="entry-date">${esc(formatDate(entry.date, "short"))}</span>
      <span>
        <span class="entry-title${titled ? "" : " is-untitled"}">${titleHTML}</span>
        <span class="entry-excerpt">${body}</span>
      </span>
      <span class="entry-meta">
        ${book ? `<span class="entry-book">${esc(book)}</span><span aria-hidden="true">·</span>` : ""}
        <span>${words} ${words === 1 ? "word" : "words"}</span>
        <span aria-hidden="true">·</span>
        <span>${minutes} min</span>
        <button class="entry-menu-btn" type="button" data-menu="${esc(entry.id)}"
          aria-label="More for ${esc(title)}" aria-haspopup="menu">⋯</button>
      </span>
    </li>
  `;
}

/* ---------- misc ---------- */

export function plural(count, singular, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}
