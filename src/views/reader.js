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

  let leaf = null;
  let drag = null;
  let frame = 0;
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
        <span class="reader-hint">Drag a page edge to turn · ← →</span>
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
    root.addEventListener("pointerdown", onPointerDown);
    root.addEventListener("pointermove", onPointerMove, { passive: false });
    root.addEventListener("pointercancel", onPointerUp);
    root.addEventListener("lostpointercapture", onPointerUp);
    window.addEventListener("resize", onResize);
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
    if (!single) index -= index % 2;
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
    root.querySelector('[data-folio="right"]').textContent = rightEntry ? String(rightIndex + 1) : "";

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
    if (next) next.disabled = destination(1) === index;

    const announce = root.querySelector("[data-announce]");
    if (announce && !tocOpen) {
      announce.textContent = `Page ${index + 1} of ${entries.length}. ${titleOf(leftEntry)}`;
    }

    updateTOC();
  }


  function destination(direction) {
    return clamp(index + direction * (isSingle() ? 1 : 2), 0,
      isSingle() ? entries.length - 1 : Math.floor((entries.length - 1) / 2) * 2);
  }

  function beginTurn(direction) {
    if (busy || listMode || tocOpen || destination(direction) === index) return false;
    busy = true;
    const single = isSingle();
    const bookEl = root.querySelector("[data-book]");
    const source = root.querySelector(single || direction > 0 ? ".page--right" : ".page--left");
    const next = destination(direction);
    const width = source.getBoundingClientRect().width;
    const height = source.getBoundingClientRect().height;
    const sheet = h("div", { class: "paper-turn", "aria-hidden": "true" });
    sheet.style.cssText = `width:${width}px;height:${height}px;left:${single || direction < 0 ? 0 : width}px`;
    sheet.inert = true;
    const backIndex = single ? next : direction > 0 ? next : next + 1;
    const reverse = source.cloneNode(true);
    reverse.querySelector(".page-inner").innerHTML = entryPageHTML(entries[backIndex]);
    reverse.querySelector(".folio").textContent = String(backIndex + 1);
    const strips = [];
    for (let i = 0; i < 20; i++) {
      const strip = h("div", { class: "paper-strip" });
      strip.style.cssText = `width:${width / 20 + 0.7}px;height:${height}px`;
      for (const [node, side] of [[source, "front"], [reverse, "back"]]) {
        const face = h("div", { class: `paper-face paper-face--${side}` });
        const copy = node.cloneNode(true);
        copy.querySelectorAll("[id]").forEach(n => n.removeAttribute("id"));
        copy.style.cssText = `display:block;width:${width}px;height:${height}px;position:absolute;left:${-(side === "back" ? 19 - i : i) * width / 20}px`;
        copy.querySelectorAll(".reader-entry").forEach(n => n.style.animation = "none");
        face.append(copy);
        strip.append(face);
      }
      sheet.append(strip);
      strips.push(strip);
    }
    bookEl.append(sheet);
    // Reveal the next page under the lifting sheet. Commit the spread only on release.
    const underIndex = single ? next : direction > 0 ? next + 1 : next;
    source.querySelector(".page-inner").innerHTML = entryPageHTML(entries[underIndex]) || '<div class="page-blank">The end</div>';
    source.querySelector(".folio").textContent = underIndex < entries.length ? String(underIndex + 1) : "";
    leaf = { sheet, strips, width, direction, next, progress: 0, single };
    bookEl.dataset.turning = "true";
    paintTurn(0);
    return true;
  }

  function paintTurn(progress) {
    if (!leaf) return;
    leaf.progress = progress;
    const { strips, width, direction } = leaf;
    const bend = Math.sin(progress * Math.PI) * 0.7;
    let x = direction > 0 ? 0 : width;
    let z = 0;
    const step = width / strips.length;
    const ordered = direction > 0 ? strips : [...strips].reverse();
    ordered.forEach((strip, i) => {
      const angle = -direction * (progress * Math.PI + bend * (i / strips.length - 0.5));
      const dx = direction * step * Math.cos(angle);
      const dz = -direction * step * Math.sin(angle);
      const start = direction > 0 ? x : x + dx;
      const depth = direction > 0 ? z : z + dz;
      strip.style.transform = `translate3d(${start}px,0,${depth}px) rotateY(${angle}rad)`;
      strip.style.setProperty("--shade", String(Math.abs(Math.sin(angle)) * 0.24));
      x += dx;
      z += dz;
    });
  }

  function finishTurn(commit, immediate = false) {
    if (!leaf) return;
    cancelAnimationFrame(frame);
    const from = leaf.progress;
    const to = commit ? 1 : 0;
    const started = performance.now();
    const duration = immediate || prefersReducedMotion() ? 0 : 180 + Math.abs(to - from) * 380;
    function tick(now) {
      if (!leaf) return;
      const t = duration ? Math.min(1, (now - started) / duration) : 1;
      paintTurn(from + (to - from) * (1 - Math.pow(1 - t, 3)));
      if (t < 1) { frame = requestAnimationFrame(tick); return; }
      if (commit) index = leaf.next;
      leaf.sheet.remove();
      leaf = null;
      busy = false;
      delete root.querySelector("[data-book]").dataset.turning;
      render();
    }
    frame = requestAnimationFrame(tick);
  }

  function turn(direction) {
    if (beginTurn(direction)) finishTurn(true);
  }

  function onResize() {
    drag = null;
    if (leaf) {
      cancelAnimationFrame(frame);
      leaf.sheet.remove();
      leaf = null;
      busy = false;
      delete root.querySelector("[data-book]").dataset.turning;
    }
    if (!isSingle()) index -= index % 2;
    render();
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
    if (busy) return;
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
    if (busy) return;
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

  function onPointerDown(event) {
    const page = event.target.closest(".page");
    if (!page || event.button !== 0 || !event.isPrimary || busy || listMode || tocOpen ||
        event.target.closest("a,button,input,textarea")) return;
    const rect = page.getBoundingClientRect();
    const offset = event.clientX - rect.left;
    // Reserve the outer margins for turning; prose remains selectable and scrollable.
    const edge = Math.min(80, rect.width * 0.2);
    let direction = page.classList.contains("page--right") ? 1 : -1;
    if (isSingle()) direction = offset < edge ? -1 : 1;
    if (direction > 0 ? offset < rect.width - edge : offset > edge) return;
    if (destination(direction) === index) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, direction, width: rect.width, started: performance.now(), active: false };
    root.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event) {
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.active) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { drag = null; return; }
      if (-dx * drag.direction < 5) return;
      if (!beginTurn(drag.direction)) { drag = null; return; }
      drag.active = true;
    }
    event.preventDefault();
    paintTurn(clamp(-dx * drag.direction / drag.width, 0, 1));
  }

  function onPointerUp(event) {
    if (!drag || drag.id !== event.pointerId) return;
    const current = drag;
    drag = null;
    if (root.hasPointerCapture(event.pointerId)) root.releasePointerCapture(event.pointerId);
    if (!current.active) return;
    const distance = -(event.clientX - current.x) * current.direction;
    const quick = distance > 45 && performance.now() - current.started < 280;
    finishTurn(event.type === "pointerup" && (leaf.progress > 0.33 || quick));
  }

  function close() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    navigate(`/book/${book.id}`);
  }

  /* ---------- teardown ---------- */

  function destroy() {
    timers.forEach((timer) => clearTimeout(timer));
    cancelAnimationFrame(frame);
    leaf?.sheet.remove();
    window.removeEventListener("resize", onResize);
    root.removeEventListener("pointermove", onPointerMove);
    root.removeEventListener("pointercancel", onPointerUp);
    root.removeEventListener("lostpointercapture", onPointerUp);

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
