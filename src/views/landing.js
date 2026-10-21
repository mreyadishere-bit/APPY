/* ============================================================
   APPY — the front door
   Masthead, hero, three notes, and a quote. The open book shows
   the newest entries and turns through them, one spread at a
   time. Everything shown here is reachable from here.
   ============================================================ */

import { esc, h } from "../ui/dom.js";
import { plural } from "../ui/kit.js";
import * as store from "../core/store.js";
import { excerpt, formatDate, titleOf, todayISO } from "../core/model.js";
import { resolveTheme } from "../core/settings.js";

const INK_LINES = {
  left: [90, 76, 84, 52, 88, 64, 40],
  right: [84, 92, 58, 80, 70, 34],
};

export function landingView() {
  const root = h("div", { class: "landing" });

  const recent = store.liveEntries();
  const pages = recent.slice(0, 8);
  const latestBook =
    (pages[0] && store.bookById(pages[0].bookId)) || store.bookOptions()[0] || null;
  const total = store.liveEntries().length;
  const bookCount = store.bookOptions().length;
  const today = todayISO();
  const todayEntry = recent.find((entry) => entry.date === today) || null;

  const primary = todayEntry
    ? {
        label: "Continue today’s entry",
        href: `#/write/${encodeURIComponent(todayEntry.id)}`,
      }
    : { label: total ? "Write today’s entry" : "Start a diary", href: "#/write" };

  const secondary = latestBook
    ? {
        label: "Read a book",
        href: `#/read/${encodeURIComponent(latestBook.id)}`,
      }
    : { label: "Open the library", href: "#/library" };

  const readingHref = latestBook
    ? `#/read/${encodeURIComponent(latestBook.id)}`
    : "#/library";

  const spreads = Math.max(1, Math.ceil(pages.length / 2));
  let spread = 0;
  let turning = false;
  const timers = new Set();

  const reduceMotion = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;

  root.innerHTML = `
    <header class="l-masthead">
      <div class="l-wrap l-masthead-inner">
        <a class="l-wordmark" href="#/">APPY</a>
        <p class="l-masthead-meta">A diary, kept well</p>
        <nav class="l-nav" aria-label="Main">
          <a href="#/today">Today</a>
          <a href="#/library">Library</a>
          <a href="#/write">Write</a>
        </nav>
        <button class="l-theme" type="button" data-landing-theme data-theme-mode="light"
          aria-label="Switch to dark theme">
          <span class="l-toggle-dot" aria-hidden="true"></span>
          <span class="l-toggle-label">Light</span>
        </button>
      </div>
    </header>

    <section class="l-hero" aria-labelledby="landing-title">
      <div class="l-wrap l-hero-grid">
        <div class="l-hero-text">
          <p class="l-label">Everyday life, written down</p>
          <h1 id="landing-title">Your days,<br />kept in books.</h1>
          <p class="l-lede">
            APPY is a diary for the ordinary days. Write into folders,
            fill books page by page, and read it all back as something
            you can hold — not a feed you scroll past.
          </p>
          <p class="l-hero-actions">
            <a class="l-text-link" href="${esc(primary.href)}">
              ${esc(primary.label)} <span aria-hidden="true">→</span>
            </a>
            <a class="l-text-link is-quiet" href="${esc(secondary.href)}">${esc(
              secondary.label
            )}</a>
          </p>
          <p class="l-hero-note">
            ${total ? `${plural(total, "entry", "entries")} in ${plural(bookCount, "book")}, all on this device.`
              : "No account, no server, no feed. Just the books you make."}
          </p>
        </div>

        <figure class="l-figure">
          <div class="l-book" data-book>
            <div class="l-spread">
              <div class="l-page l-page-left" data-page-left></div>
              <div class="l-page l-page-right" data-page-right></div>
              <button class="l-page-turn" type="button" data-turn aria-label="Turn the page">
                <span class="l-turn-hint">Turn</span>
              </button>
              <div class="l-spine" aria-hidden="true"></div>
            </div>
            <figcaption class="l-caption">Reading back, one page at a time.</figcaption>
          </div>
        </figure>
      </div>
    </section>

    <main data-skip-target tabindex="-1">
      <section class="l-section" aria-labelledby="l-shelf">
        <div class="l-wrap l-section-grid">
          <p class="l-num" aria-hidden="true">01</p>
          <div class="l-section-body">
            <h2 id="l-shelf">A shelf, not a search box</h2>
            <p>
              Diaries are organised the way you actually think about them.
              Books hold the entries; folders gather them by subject, across
              books. A book can be a year, a trip, a difficult month, or the
              week you moved house.
            </p>
            <p class="l-aside">
              Nothing is buried in an endless feed, and nothing is sorted by
              a machine that knows better than you.
            </p>
            <p class="l-section-link">
              <a class="l-text-link is-quiet" href="#/library">Browse the library</a>
            </p>
          </div>
        </div>
      </section>

      <section class="l-section" aria-labelledby="l-device">
        <div class="l-wrap l-section-grid is-flip">
          <p class="l-num" aria-hidden="true">02</p>
          <div class="l-section-body">
            <h2 id="l-device">It stays on your device</h2>
            <p>
              Your entries are saved on the device you write them on, in the
              books you made. The diary is yours in the plain sense: it lives
              where you do.
            </p>
            <p class="l-aside">
              Write on the bus, in a quiet room, or with the wifi off. Once
              the page is open, nothing waits for a signal.
            </p>
            <p class="l-section-link">
              <a class="l-text-link is-quiet" href="#/settings">How your diary is stored</a>
            </p>
          </div>
        </div>
      </section>

      <section class="l-section" aria-labelledby="l-read">
        <div class="l-wrap l-section-grid">
          <p class="l-num" aria-hidden="true">03</p>
          <div class="l-section-body">
            <h2 id="l-read">Read it like it was printed</h2>
            <p>
              The same diary opens as a book you can turn through — covers
              that open, pages that move. Reading back what you wrote should
              feel like reading, not like scrolling through your own archive.
            </p>
            <p class="l-section-link">
              <a class="l-text-link is-quiet" href="${esc(readingHref)}">Open the reading room</a>
            </p>
          </div>
        </div>
      </section>

      <section class="l-pull" aria-label="A note on diaries">
        <div class="l-wrap">
          <blockquote>
            <p>A diary should be a place you return to, not a file you maintain.</p>
          </blockquote>
        </div>
      </section>
    </main>

    <footer class="l-footer">
      <div class="l-wrap l-footer-inner">
        <p class="l-footer-mark">APPY</p>
        <p class="l-footer-note">Written on your device, read at your pace.</p>
        <p class="l-footer-copy">
          © ${new Date().getFullYear()}
          · <a class="l-footer-link" href="#/search">Search</a>
          · <a class="l-footer-link" href="#/trash">Trash</a>
          · <a class="l-footer-link" href="#/settings">Settings</a>
          · <a class="l-footer-link" href="https://github.com/mreyadishere-bit/APPY"
              target="_blank" rel="noopener">Source</a>
        </p>
      </div>
    </footer>
  `;

  const leftEl = root.querySelector("[data-page-left]");
  const rightEl = root.querySelector("[data-page-right]");
  const bookEl = root.querySelector("[data-book]");

  paintPages();
  paintThemeControl();

  root.addEventListener("click", onClick);
  const unsubscribe = store.subscribe((reason) => {
    if (reason === "settings") paintThemeControl();
  });

  return {
    root,
    // An empty title lets the router keep the front door's own title.
    title: "",
    destroy() {
      stopTimers();
      unsubscribe();
      root.removeEventListener("click", onClick);
    },
  };

  /* ---------- the open book ---------- */

  function paintPages() {
    if (!pages.length) {
      leftEl.innerHTML = inkPage("left");
      rightEl.innerHTML = inkPage("right");
      return;
    }

    const right = pages[spread * 2] || null;
    const left = pages[spread * 2 + 1] || null;
    rightEl.innerHTML = right ? entryPage(right) : inkPage("right");
    leftEl.innerHTML = left ? entryPage(left) : bookPage(right);
  }

  function entryPage(entry) {
    const book = store.bookById(entry.bookId);
    const text = excerpt(entry.body, 240);
    return `
      <span class="l-page-date">${esc(formatDate(entry.date))}</span>
      <h2 class="l-page-title">${esc(titleOf(entry))}</h2>
      ${text ? `<p class="l-page-text">${esc(text)}</p>` : ""}
      <span class="l-page-foot">${esc(book?.title || "APPY")}</span>
    `;
  }

  function bookPage(right) {
    const book = right ? store.bookById(right.bookId) : latestBook;
    if (!book) return inkPage("left");
    const stats = store.bookStats(book.id);
    return `
      <span class="l-page-date">From the shelf</span>
      <h2 class="l-page-title">${esc(book.title)}</h2>
      <p class="l-page-text">${plural(stats.entries, "entry", "entries")}, kept on this device.</p>
      <a class="l-page-link" href="#/read/${encodeURIComponent(book.id)}">Open the book <span aria-hidden="true">→</span></a>
    `;
  }

  function inkPage(side) {
    const date = side === "left" ? "14 March" : "15 March";
    return `
      <span class="l-page-date">${date}</span>
      ${INK_LINES[side]
        .map((width) => `<span class="l-ink" style="width:${width}%"></span>`)
        .join("")}
    `;
  }

  function turnPage() {
    if (turning) return;

    const paint = () => {
      spread = (spread + 1) % spreads;
      paintPages();
    };

    if (reduceMotion?.matches) {
      paint();
      return;
    }

    turning = true;
    bookEl.classList.add("is-turned");
    later(() => paint(), 430);
    later(() => {
      bookEl.classList.remove("is-turned");
      turning = false;
    }, 960);
  }

  function later(work, delay) {
    const id = window.setTimeout(() => {
      timers.delete(id);
      work();
    }, delay);
    timers.add(id);
  }

  function stopTimers() {
    timers.forEach((id) => window.clearTimeout(id));
    timers.clear();
  }

  /* ---------- theme, close at hand ---------- */

  function paintThemeControl() {
    const button = root.querySelector("[data-landing-theme]");
    if (!button) return;
    const theme = resolveTheme(store.settings().theme);
    button.dataset.themeMode = theme;
    button.setAttribute(
      "aria-label",
      theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
    );
    const label = button.querySelector(".l-toggle-label");
    if (label) label.textContent = theme === "dark" ? "Dark" : "Light";
  }

  function onClick(event) {
    if (event.target.closest("[data-turn]")) {
      turnPage();
      return;
    }

    if (event.target.closest("[data-landing-theme]")) {
      const theme = resolveTheme(store.settings().theme);
      store.updateSettings({ theme: theme === "dark" ? "light" : "dark" });
    }
  }
}
