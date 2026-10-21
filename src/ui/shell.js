/* ============================================================
   APPY — the shell
   One quiet rail, one mobile bar. Everything else is a view.
   ============================================================ */

import { $, esc } from "./dom.js";
import { icon } from "./kit.js";
import * as store from "../core/store.js";
import { paintTheme, resolveTheme } from "../core/settings.js";
import { startNewEntry } from "../views/actions.js";

let rail = null;
let mobile = null;

export function mountShell() {
  rail = $("#rail");
  mobile = $("#mobileBar");

  renderRail();
  renderMobile();

  rail.addEventListener("click", onShellClick);
  mobile.addEventListener("click", onShellClick);

  store.subscribe((reason) => {
    if (reason === "settings") {
      paintTheme(store.settings().theme);
      paintThemeButton();
    }
    updateCounts();
  });

  paintThemeButton();
  updateCounts();
}

function renderRail() {
  rail.innerHTML = `
    <a class="brand" href="#/" aria-label="APPY, home">
      <span class="brand-mark">APPY</span>
      <span class="brand-sub">a private diary</span>
    </a>

    <button class="btn btn--primary btn--wide" type="button" data-action="new-entry">
      ${icon("pen")} New entry
    </button>

    <nav class="rail-nav" aria-label="Sections">
      <a href="#/" data-nav="home">Home</a>
      <a href="#/today" data-nav="today">Today</a>
      <a href="#/library" data-nav="library">Library <span class="rail-count" data-count="books"></span></a>
      <a href="#/search" data-nav="search">Search</a>
      <a href="#/trash" data-nav="trash">Trash <span class="rail-count" data-count="trash"></span></a>
      <a href="#/settings" data-nav="settings">Settings</a>
    </nav>

    <div class="rail-foot">
      <div class="rail-foot-row">
        <span class="rail-note">On this device</span>
        <button class="theme-btn" type="button" data-action="theme">
          <span data-theme-icon></span>
          <span data-theme-label></span>
        </button>
      </div>
      <p class="rail-note">Your diary is stored in this browser. Export a backup from Settings.</p>
    </div>
  `;
}

function renderMobile() {
  mobile.innerHTML = `
    <a class="brand" href="#/" aria-label="APPY, home">
      <span class="brand-mark">APPY</span>
    </a>
    <button class="btn btn--primary btn--sm" type="button" data-action="new-entry">
      ${icon("pen")} Write
    </button>
  `;
}

function onShellClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  if (button.dataset.action === "new-entry") {
    startNewEntry();
  }

  if (button.dataset.action === "theme") {
    const current = resolveTheme(store.settings().theme);
    store.updateSettings({ theme: current === "dark" ? "light" : "dark" });
  }
}

export function updateShell(route) {
  const section = sectionFor(route.name);

  rail.querySelectorAll(".rail-nav a").forEach((link) => {
    if (link.dataset.nav === section) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });

  updateCounts();
}

function sectionFor(name) {
  if (name === "book" || name === "folder" || name === "day" || name === "write" || name === "read") {
    return "library";
  }
  return name;
}

export function updateCounts() {
  if (!rail) return;
  const counts = store.state.counts;
  const trash = store.trashedEntries().length;

  const books = rail.querySelector('[data-count="books"]');
  if (books) books.textContent = counts.books ? String(counts.books) : "";

  const trashNode = rail.querySelector('[data-count="trash"]');
  if (trashNode) trashNode.textContent = trash ? String(trash) : "";
}

export function paintThemeButton() {
  if (!rail) return;
  const resolved = resolveTheme(store.settings().theme);
  const iconSlot = rail.querySelector("[data-theme-icon]");
  const label = rail.querySelector("[data-theme-label]");
  const button = rail.querySelector('[data-action="theme"]');

  if (iconSlot) iconSlot.innerHTML = icon(resolved === "dark" ? "sun" : "moon");
  if (label) label.textContent = resolved === "dark" ? "Light" : "Dark";
  if (button) {
    button.setAttribute(
      "aria-label",
      resolved === "dark" ? "Switch to the light theme" : "Switch to the dark theme"
    );
  }
}

/** Small helper for views that want the section heading pattern. */
export function pageHead({ eyebrow, title, intro = "", actions = "" }) {
  return `
    <header class="page-head">
      <div>
        ${eyebrow ? `<p class="label">${esc(eyebrow)}</p>` : ""}
        <h1 class="display">${esc(title)}</h1>
        ${intro ? `<p class="page-intro">${esc(intro)}</p>` : ""}
      </div>
      ${actions ? `<div class="page-head-actions">${actions}</div>` : ""}
    </header>
  `;
}
