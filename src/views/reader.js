/* ============================================================
   APPY — the reading room
   The cover opens, the spread settles, and one page turns at a
   time. State changes first; the motion is decoration on top, so
   a dropped frame never leaves the book in the wrong place.
   ============================================================ */

import { clamp, esc, focusSoft, h, prefersReducedMotion } from "../ui/dom.js";
import { icon, toast } from "../ui/kit.js";
import { groupByMonth } from "../ui/entry-list.js";
import { navigate } from "../ui/router.js";
import * as store from "../core/store.js";
import { formatDate, moodLabel, monthLabel, sanitize, titleOf } from "../core/model.js";
import { missingView } from "./missing.js";
import { startNewEntry } from "./actions.js";

const SCALES = [1, 1.12, 1.24];

export function readerView(route) {
  const book = store.bookById(route.params[0]);

  if (!book) {
    return missingView({
      title: "That book is not on the shelf",
      message: "It may have been deleted. Any entries it held were moved or placed in the trash.",
      back: "/library",
      backLabel: "Back to the library",
    });
  }

  const entries = store.entriesIn({ bookId: book.id, sort: "oldest" });
  const root = h("div", {
    class: "reader",
    tabindex: "-1",
    role: "region",
    "aria-label": `Reading ${book.title}`,
    dataset: { state: "opening", view: "spread" },
  });

  let index = 0;
  if (route.query.entry) {
    const found = entries.findIndex((entry) => entry.id === route.query.entry);
    if (found !== -1) index = found;
  }

  let busy = false;
  let tocOpen = false;
  let listMode = store.settings().readerView === "list";
  const timers = [];

  document.body.dataset.immersive = "true";
  root.style.setProperty("--reader-scale", String(store.settings().readerScale || 1));

  if (!entries.length) {
    root.dataset.state = "open";
    root.innerHTML = emptyBookHTML();
    // The empty room still has a way out and a way in.
    root.addEventListener("click", onClickEmpty);
    document.addEventListener("keydown", onKeyEmpty);
    focusSoft(root.querySelector('[data-action="close"]') || root);
  } else {
    root.innerHTML = template();
    afterTemplate();
  }

  return {
    root,
    title: book.title,
    destroy,
  };

  /* ---------- markup ---------- */

  function template() {
    return `
      <header class="reader-bar">
        <div class="reader-bar-start">
          <button class="reader-tool" type="button" data-action="close" aria-label="Close the book and go back">
            ${icon("arrowLeft")} <span class="reader-tool-label">Back</span>
          </button>
        </div>
        <h1 class="reader-title">
          ${esc(book.title)}
          <span>${esc(book.subtitle || "A diary")}</span>
        </h1>
        <div class="reader-bar-end">
          <button class="reader-tool" type="button" data-action="toc" aria-expanded="false" aria-controls="tocPanel">
            ${icon("contents")} <span class="reader-tool-label">Contents</span>
          </button>
          <button class="reader-tool reader-tool--list" type="button" data-action="list" aria-pressed="${listMode}">
            ${icon("list")} <span class="reader-tool-label">List</span>
          </button>
          <button class="reader-tool" type="button" data-action="scale" aria-label="Change text size">
            <span aria-hidden="true" style="font-family:var(--serif);font-size:0.95rem">Aa</span>
          </button>
          <button class="reader-tool" type="button" data-action="full" aria-pressed="false">
            ${icon("expand")} <span class="sr-only">Full screen</span>
          </button>
        </div>
      </header>

      <div class="reader-stage" data-stage>
        <div class="book" data-book>
          <section class="page page--left" aria-label="Left page">
            <div class="page-inner" data-page="left"></div>
            <span class="folio" data-folio="left"></span>
          </section>
          <section class="page page--right" aria-label="Right page">
            <div class="page-inner" data-page="right"></div>
            <span class="folio" data-folio="right"></span>
          </section>
        </div>
        <button class="turn turn--prev" type="button" data-action="prev" aria-label="Previous page">
          ${icon("chevronLeft")}
        </button>
        <button class="turn turn--next" type="button" data-action="next" aria-label="Next page">
          ${icon("chevronRight")}
        </button>
      </div>

      <footer class="reader-foot" data-foot>
        <span class="reader-count" data-page-count></span>
        <span class="progress" aria-hidden="true"><span class="progress-fill" data-progress></span></span>
      </footer>

      <div class="reader-list" data-list hidden>
        <div class="reader-list-inner">
          ${entries.map((entry) => entryPageHTML(entry)).join("")}
        </div>
      </div>

      <aside class="toc" id="tocPanel" data-toc hidden aria-label="Contents">
        <div class="toc-head">
          <h2 class="display" style="font-size:1.1rem">Contents</h2>
          <button class="icon-btn" type="button" data-action="close-toc" aria-label="Close contents">
            ${icon("close")}
          </button>
        </div>
        <div class="toc-list">
          ${tocHTML()}
        </div>
      </aside>

      <div class="reader-cover" data-cover>
        <div class="cover cover--lg" data-style="${esc(book.cover?.style || "cloth")}"
          ${book.cover?.accent ? `style="--cover:${esc(book.cover.accent)}"` : ""}>
          <span class="cover-kicker">Diary</span>
          <span class="cover-title">${esc(book.title)}</span>
          <span>
            <span class="cover-rule" aria-hidden="true"></span>
            <span class="cover-foot">${esc(book.subtitle || `${entries.length} entries`)}</span>
          </span>
        </div>
      </div>

      <p class="sr-only" aria-live="polite" data-announce></p>
    `;
  }

  function tocHTML() {
    return groupByMonth(entries)
      .map(
        (group) => `
          <p class="toc-month">${esc(monthLabel(group.key))}</p>
          ${group.entries
            .map((entry) => {
              const position = entries.indexOf(entry);
              return `
                <button class="toc-item" type="button" data-goto="${position}">
                  <span class="toc-item-day">${esc(formatDate(entry.date, "day"))}</span>
                  <span class="toc-item-title">${esc(titleOf(entry))}</span>
                </button>
              `;
            })
            .join("")}
        `
      )
      .join("");
  }

  function emptyBookHTML() {
    return `
      <header class="reader-bar">
        <div class="reader-bar-start">
          <button class="reader-tool" type="button" data-action="close" aria-label="Close the book and go back">
            ${icon("arrowLeft")} <span class="reader-tool-label">Back</span>
          </button>
        </div>
        <h1 class="reader-title">${esc(book.title)}<span>${esc(book.subtitle || "A diary")}</span></h1>
        <div class="reader-bar-end"></div>
      </header>
      <div class="reader-stage">
        <div class="reader-empty">
          <div class="cover" data-style="${esc(book.cover?.style || "cloth")}"
            ${book.cover?.accent ? `style="--cover:${esc(book.cover.accent)}"` : ""}>
            <span class="cover-kicker">Diary</span>
            <span class="cover-title">${esc(book.title)}</span>
            <span><span class="cover-rule"></span></span>
          </div>
          <h2 class="display">The book is empty, for now.</h2>
          <p>An entry is all it takes to give this cover a page.</p>
          <button class="btn btn--primary" type="button" data-action="write">Write the first entry</button>
        </div>
      </div>
    `;
  }

  /* ---------- after mount ---------- */

  function afterTemplate() {
    const coverEl = root.querySelector("[data-cover]");
    const reduced = prefersReducedMotion();

    if (reduced) {
      coverEl?.remove();
      root.dataset.state = "open";
    } else {
      timers.push(
        setTimeout(() => {
          root.dataset.state = "open";
          if (coverEl) coverEl.dataset.opening = "true";
        }, 60)
      );
      timers.push(
        setTimeout(() => {
          root.dataset.state = "open";
          coverEl?.remove();
        }, 1000)
      );
    }

    render();
    if (listMode) applyList(true);
    updateTOC();

    root.addEventListener("click", onClick);
    root.addEventListener("pointerdown", onPointerDown, { passive: true });
    root.addEventListener("pointerup", onPointerUp, { passive: true });
    document.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFullscreenChange);

    focusSoft(root.querySelector('[data-action="close"]') || root);

    if (route.query.entry) {
      const announce = root.querySelector("[data-announce]");
      if (announce) announce.textContent = `Opened at ${titleOf(entries[index])}.`;
    }
  }

  /* ---------- paging ---------- */

  function isSingle() {
    return window.matchMedia("(max-width: 60rem)").matches;
  }

  function render() {
    const single = isSingle();
    const leftEntry = entries[index];
    const rightIndex = single ? index : index + 1;
    const rightEntry = entries[rightIndex];

    const left = root.querySelector('[data-page="left"]');
    const right = root.querySelector('[data-page="right"]');
    if (!left || !right) return;

    left.innerHTML = single ? "" : entryPageHTML(leftEntry);
    right.innerHTML = rightEntry
      ? entryPageHTML(rightEntry)
      : `<div class="page-blank">The end</div>`;

    root.querySelector('[data-folio="left"]').textContent = single ? "" : String(index + 1);
    root.querySelector('[data-folio="right"]').textContent = String(rightIndex + 1);

    const count = root.querySelector("[data-page-count]");
    const visible = single ? 1 : Math.min(2, entries.length - index);
    if (count) {
      count.textContent =
        visible > 1 ? `${index + 1}–${index + visible} of ${entries.length}` : `${index + 1} of ${entries.length}`;
    }

    const progress = root.querySelector("[data-progress]");
    if (progress) {
      const ratio = (index + visible) / entries.length;
      progress.style.width = `${Math.min(100, Math.round(ratio * 100))}%`;
    }

    const prev = root.querySelector('[data-action="prev"]');
    const next = root.querySelector('[data-action="next"]');
    if (prev) prev.disabled = index === 0;
    if (next) next.disabled = index >= entries.length - 1;

    const announce = root.querySelector("[data-announce]");
    if (announce && !tocOpen) {
      announce.textContent = `Page ${index + 1} of ${entries.length}. ${titleOf(leftEntry)}`;
    }

    updateTOC();
  }

  function turn(direction) {
    if (busy || listMode) return;
    const next = clamp(index + direction, 0, entries.length - 1);
    if (next === index) return;

    if (prefersReducedMotion()) {
      index = next;
      render();
      return;
    }

    const single = isSingle();
    const source = root.querySelector(direction > 0 ? ".page--right" : ".page--left");
    if (!source) {
      index = next;
      render();
      return;
    }

    busy = true;

    const clone = source.cloneNode(true);
    clone.removeAttribute("aria-label");
    clone.setAttribute("aria-hidden", "true");
    clone.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
    clone.classList.add("leaf", direction > 0 ? "leaf--right" : "leaf--left");
    if (single) clone.classList.add("leaf--single");

    const bookEl = root.querySelector("[data-book]");
    bookEl.append(clone);

    index = next;
    render();

    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      clone.remove();
      busy = false;
    };

    const angle = direction > 0 ? -178 : 178;
    try {
      const animation = clone.animate(
        [{ transform: "rotateY(0deg)" }, { transform: `rotateY(${angle}deg)` }],
        { duration: 560, easing: "cubic-bezier(.2, .7, .2, 1)", fill: "forwards" }
      );
      animation.finished.then(settle).catch(settle);
    } catch {
      settle();
    }

    timers.push(setTimeout(settle, 820));
  }

  /* ---------- entry rendering ---------- */

  function entryPageHTML(entry) {
    if (!entry) return "";
    const body = sanitize(entry.body);
    const titled = Boolean(entry.title?.trim());

    return `
      <article class="reader-entry" data-entry="${esc(entry.id)}">
        <header class="re-head">
          <p class="re-date">${esc(formatDate(entry.date, "full"))}</p>
          ${entry.mood ? `<p class="re-mood">${esc(moodLabel(entry.mood))}</p>` : ""}
        </header>
        <h2 class="re-title${titled ? "" : " is-untitled"}">${esc(titleOf(entry))}</h2>
        <div class="re-body">${body}</div>
        <p class="re-end">End of entry</p>
      </article>
    `;
  }

  /* ---------- contents ---------- */

  function updateTOC() {
    root.querySelectorAll("[data-goto]").forEach((button) => {
      const position = Number(button.dataset.goto);
      if (position === index) button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
    });
  }

  function toggleTOC(force) {
    tocOpen = typeof force === "boolean" ? force : !tocOpen;
    const panel = root.querySelector("[data-toc]");
    const trigger = root.querySelector('[data-action="toc"]');
    if (!panel) return;

    panel.hidden = !tocOpen;
    trigger?.setAttribute("aria-expanded", String(tocOpen));

    if (tocOpen) {
      const current = panel.querySelector('[aria-current="true"]') || panel.querySelector("button");
      focusSoft(current);
    } else {
      focusSoft(trigger);
    }
  }

  /* ---------- list ---------- */

  function applyList(initial = false) {
    const stage = root.querySelector("[data-stage]");
    const foot = root.querySelector("[data-foot]");
    const list = root.querySelector("[data-list]");
    const button = root.querySelector('[data-action="list"]');

    root.dataset.view = listMode ? "list" : "spread";
    if (stage) stage.hidden = listMode;
    if (foot) foot.hidden = listMode;
    if (list) list.hidden = !listMode;
    button?.setAttribute("aria-pressed", String(listMode));

    if (listMode && list) {
      window.requestAnimationFrame(() => {
        const target = list.querySelector(`[data-entry="${CSS.escape(entries[index].id)}"]`);
        if (target) target.scrollIntoView({ block: "start" });
        if (!initial) focusSoft(list);
      });
    }
  }

  function toggleList() {
    listMode = !listMode;
    store.updateSettings({ readerView: listMode ? "list" : "spread" }, { silent: true });
    applyList();
  }

  /* ---------- text size ---------- */

  function cycleScale() {
    const current = store.settings().readerScale || 1;
    const position = SCALES.indexOf(current);
    const next = SCALES[(position + 1) % SCALES.length] || 1;
    root.style.setProperty("--reader-scale", String(next));
    store.updateSettings({ readerScale: next }, { silent: true });
  }

  /* ---------- full screen ---------- */

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (root.requestFullscreen) {
        await root.requestFullscreen();
      } else {
        toast("This browser has no full-screen mode. The pages still read well.");
      }
    } catch {
      toast("The browser would not open full screen. The pages still read well.");
    }
  }

  function onFullscreenChange() {
    const button = root.querySelector('[data-action="full"]');
    const active = Boolean(document.fullscreenElement);
    button?.setAttribute("aria-pressed", String(active));
    if (button) {
      button.innerHTML = `${icon(active ? "collapse" : "expand")} <span class="sr-only">${
        active ? "Leave full screen" : "Full screen"
      }</span>`;
    }
  }

  /* ---------- events ---------- */

  function onClick(event) {
    const target = event.target.closest("[data-action], [data-goto]");
    if (!target) {
      if (tocOpen && !event.target.closest("[data-toc]")) toggleTOC(false);
      return;
    }

    if (target.dataset.goto) {
      const position = Number(target.dataset.goto);
      if (Number.isInteger(position)) {
        index = clamp(position, 0, entries.length - 1);
        render();
        toggleTOC(false);
        if (listMode) applyList();
      }
      return;
    }

    const action = target.dataset.action;
    if (action === "close") close();
    if (action === "prev") turn(-1);
    if (action === "next") turn(1);
    if (action === "toc") toggleTOC();
    if (action === "close-toc") toggleTOC(false);
    if (action === "list") toggleList();
    if (action === "scale") cycleScale();
    if (action === "full") toggleFullscreen();
    if (action === "write") {
      startNewEntry({ bookId: book.id });
    }
  }

  function onClickEmpty(event) {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "close") close();
    if (action === "write") startNewEntry({ bookId: book.id });
  }

  function onKeyEmpty(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  }

  function onKey(event) {
    const active = document.activeElement;
    if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable)) {
      return;
    }

    switch (event.key) {
      case "ArrowRight":
      case "PageDown":
        event.preventDefault();
        turn(1);
        break;
      case "ArrowLeft":
      case "PageUp":
        event.preventDefault();
        turn(-1);
        break;
      case "Home":
        event.preventDefault();
        index = 0;
        render();
        break;
      case "End":
        event.preventDefault();
        index = entries.length - 1;
        render();
        break;
      case "Escape":
        event.preventDefault();
        if (tocOpen) toggleTOC(false);
        else close();
        break;
      case "t":
      case "T":
        event.preventDefault();
        toggleTOC();
        break;
      case "l":
      case "L":
        event.preventDefault();
        toggleList();
        break;
      case "f":
      case "F":
        event.preventDefault();
        toggleFullscreen();
        break;
      default:
        break;
    }
  }

  let startX = 0;
  let startY = 0;
  let tracking = false;

  function onPointerDown(event) {
    if (event.pointerType === "mouse") return;
    tracking = true;
    startX = event.clientX;
    startY = event.clientY;
  }

  function onPointerUp(event) {
    if (!tracking) return;
    tracking = false;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) turn(dx < 0 ? 1 : -1);
  }

  function close() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    navigate(`/book/${book.id}`);
  }

  /* ---------- teardown ---------- */

  function destroy() {
    timers.forEach((timer) => clearTimeout(timer));

    root.removeEventListener("click", onClick);
    root.removeEventListener("click", onClickEmpty);
    root.removeEventListener("pointerdown", onPointerDown);
    root.removeEventListener("pointerup", onPointerUp);
    document.removeEventListener("keydown", onKey);
    document.removeEventListener("keydown", onKeyEmpty);
    document.removeEventListener("fullscreenchange", onFullscreenChange);

    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    document.body.dataset.immersive = "false";
  }
}
