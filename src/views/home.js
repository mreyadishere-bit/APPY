/* ============================================================
   APPY — home
   A date, a greeting, the page you were just writing, and a way
   back into any day of the month.
   ============================================================ */

import { esc, h } from "../ui/dom.js";
import { coverHTML, coverStyle, entryRowHTML, icon, plural } from "../ui/kit.js";
import { pageHead } from "../ui/shell.js";
import * as store from "../core/store.js";
import {
  excerpt,
  formatDate,
  formatWeekday,
  monthKey,
  monthLabel,
  monthMatrix,
  relativeTime,
  titleOf,
  todayISO,
  wordCount,
} from "../core/model.js";
import { createBookFlow, startNewEntry } from "./actions.js";

export function homeView() {
  const root = h("div", { class: "home" });
  const now = new Date();
  let calYear = now.getFullYear();
  let calMonth = now.getMonth();

  const unsubscribe = store.subscribe(render);
  root.addEventListener("click", onClick);

  render();

  return {
    root,
    title: "",
    destroy() {
      unsubscribe();
      root.removeEventListener("click", onClick);
    },
  };

  function onClick(event) {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const action = button.dataset.action;
    if (action === "new") startNewEntry();
    if (action === "new-book") createBookFlow();
    if (action === "cal-prev") {
      const date = new Date(calYear, calMonth - 1, 1);
      calYear = date.getFullYear();
      calMonth = date.getMonth();
      render();
    }
    if (action === "cal-next") {
      const date = new Date(calYear, calMonth + 1, 1);
      calYear = date.getFullYear();
      calMonth = date.getMonth();
      render();
    }
  }

  function render() {
    root.innerHTML = template();
  }

  function template() {
    const today = todayISO();
    const live = store.liveEntries();
    const name = store.settings().name.trim();
    const hour = new Date().getHours();
    const part = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
    const greeting = `Good ${part}${name ? `, ${name}` : ""}.`;
    const todaysEntry = live.find((entry) => entry.date === today);

    if (!store.books().length && !live.length) return onboarding(greeting);

    const recent = store.recentEntries(4);
    const continueEntry = recent[0] || null;
    const books = store.books().slice(0, 5);
    const primary = todaysEntry
      ? `<a class="btn btn--primary" href="#/write/${esc(todaysEntry.id)}">Continue today’s entry</a>`
      : `<button class="btn btn--primary" type="button" data-action="new">Write today’s entry</button>`;

    return `
      ${pageHead({
        eyebrow: `${formatWeekday(today)}, ${formatDate(today, "full")}`,
        title: greeting,
        actions: primary,
      })}

      <div class="home-grid">
        <div class="home-main">
          ${
            continueEntry
              ? `<section aria-labelledby="continueHeading">
                  <div class="section-head">
                    <h2 class="display" id="continueHeading" style="font-size:1.2rem">Pick up where you left off</h2>
                    <span class="label">${esc(store.bookById(continueEntry.bookId)?.title || "")}</span>
                  </div>
                  <a class="continue-card" href="#/write/${esc(continueEntry.id)}">
                    <p class="label is-accent">${esc(formatDate(continueEntry.date, "long"))} · edited ${esc(
                      relativeTime(continueEntry.updatedAt)
                    )}</p>
                    <h3 class="continue-title">${esc(titleOf(continueEntry))}</h3>
                    <p class="continue-excerpt">${esc(excerpt(continueEntry.body, 180))}</p>
                  </a>
                </section>`
              : ""
          }

          <section aria-labelledby="recentHeading">
            <div class="section-head">
              <h2 class="display" id="recentHeading" style="font-size:1.2rem">Recent entries</h2>
              <a class="linkish" href="#/search">All entries</a>
            </div>
            ${
              recent.length
                ? `<ol class="entries">${recent.map((entry) => entryRowHTML(entry)).join("")}</ol>`
                : `<p class="dim">Nothing written yet. The first page is the hardest.</p>`
            }
          </section>

          <section aria-labelledby="booksHeading">
            <div class="section-head">
              <h2 class="display" id="booksHeading" style="font-size:1.2rem">Your books</h2>
              <a class="linkish" href="#/library">Library</a>
            </div>
            <div class="book-strip">
              ${books
                .map((book) => {
                  const stats = store.bookStats(book.id);
                  return `<a class="cover" href="#/book/${esc(book.id)}" ${coverStyle(book)}>
                    ${coverHTML(book, { count: stats.entries })}
                  </a>`;
                })
                .join("")}
              <button class="cover cover--new" type="button" data-action="new-book">
                <span class="plus" aria-hidden="true">+</span>
                <span>New book</span>
              </button>
            </div>
          </section>
        </div>

        <aside class="home-side" aria-label="Calendar and totals">
          ${calendar(today, live)}
          ${onThisDay(today, live)}
          ${stats(live)}
        </aside>
      </div>
    `;
  }

  function calendar(today, live) {
    const cells = monthMatrix(calYear, calMonth);
    const dated = new Set(live.map((entry) => entry.date));
    const key = monthKey(`${calYear}-${String(calMonth + 1).padStart(2, "0")}-01`);

    return `
      <section aria-labelledby="calHeading">
        <div class="cal-head">
          <h2 class="cal-title" id="calHeading">${esc(monthLabel(key))}</h2>
          <div class="cal-nav">
            <button type="button" data-action="cal-prev" aria-label="Previous month">${icon("chevronLeft")}</button>
            <button type="button" data-action="cal-next" aria-label="Next month">${icon("chevronRight")}</button>
          </div>
        </div>
        <div class="cal-grid">
          ${["M", "T", "W", "T", "F", "S", "S"]
            .map((day) => `<span class="cal-dow" aria-hidden="true">${day}</span>`)
            .join("")}
          ${cells
            .map((cell) => {
              if (!cell.inMonth) return `<span class="cal-day is-outside" aria-hidden="true">${cell.day}</span>`;
              const has = dated.has(cell.iso);
              return `<a class="cal-day${has ? " has-entry" : ""}${cell.isToday ? " is-today" : ""}"
                href="#/day/${cell.iso}"
                aria-label="${esc(formatDate(cell.iso, "full"))}${has ? ", has entries" : ""}${
                  cell.isToday ? ", today" : ""
                }">${cell.day}</a>`;
            })
            .join("")}
        </div>
      </section>
    `;
  }

  function onThisDay(today, live) {
    const monthDay = today.slice(5);
    const memories = live
      .filter((entry) => entry.date.slice(5) === monthDay && entry.date.slice(0, 4) !== today.slice(0, 4))
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 3);

    if (!memories.length) return "";

    return `
      <section aria-labelledby="otdHeading">
        <div class="cal-head">
          <h2 class="cal-title" id="otdHeading">On this day</h2>
        </div>
        <ol class="entries">
          ${memories
            .map(
              (entry) => `
            <li class="entry-row" style="grid-template-columns:3.2rem minmax(0,1fr)">
              <a class="entry-link" href="#/write/${esc(entry.id)}" aria-label="Open ${esc(titleOf(entry))}"></a>
              <span class="entry-date">${esc(entry.date.slice(0, 4))}</span>
              <span class="entry-title">${esc(titleOf(entry))}</span>
            </li>`
            )
            .join("")}
        </ol>
      </section>
    `;
  }

  function stats(live) {
    const words = live.reduce((total, entry) => total + wordCount(entry.body), 0);
    const monthPrefix = todayISO().slice(0, 7);
    const days = new Set(live.filter((entry) => entry.date.startsWith(monthPrefix)).map((entry) => entry.date)).size;

    return `
      <section aria-labelledby="statsHeading">
        <div class="cal-head">
          <h2 class="cal-title" id="statsHeading">So far</h2>
        </div>
        <div class="stat-list">
          <div class="stat"><span class="stat-label">Entries</span><span class="stat-value num">${live.length}</span></div>
          <div class="stat"><span class="stat-label">Words written</span><span class="stat-value num">${words.toLocaleString()}</span></div>
          <div class="stat"><span class="stat-label">Books</span><span class="stat-value num">${store.books().length}</span></div>
          <div class="stat"><span class="stat-label">Days written this month</span><span class="stat-value num">${days}</span></div>
        </div>
        <p class="rail-note" style="margin-top:0.8rem">About ${plural(
          Math.max(1, Math.round(words / 220)),
          "minute"
        )} of reading.</p>
      </section>
    `;
  }

  function onboarding(greeting) {
    return `
      ${pageHead({
        eyebrow: `${formatWeekday(todayISO())}, ${formatDate(todayISO(), "full")}`,
        title: greeting,
      })}
      <div class="empty">
        <p class="label is-accent">Begin</p>
        <h2 class="display">A diary is just a few sentences, kept.</h2>
        <p>APPY keeps your writing on this device, inside a book you choose. No account, no feed, no one reading over your shoulder.</p>
        <ol class="empty-steps">
          <li>Make a book — a year, a trip, a season of your life.</li>
          <li>Write an entry. Title, date, and as much or as little as you like.</li>
          <li>Open the book when you want to read your days back as pages.</li>
        </ol>
        <div class="empty-actions">
          <button class="btn btn--primary" type="button" data-action="new-book">Create your first book</button>
          <a class="btn" href="#/settings">About your data</a>
        </div>
      </div>
    `;
  }
}


