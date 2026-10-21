/* ============================================================
   APPY — boot
   One shell, one router, one store. Views are plain modules that
   hand back a node and a way to clean themselves up.
   ============================================================ */

import { $, esc } from "./ui/dom.js";
import * as store from "./core/store.js";
import { loadSettings, paintTheme } from "./core/settings.js";
import { createRouter, navigate } from "./ui/router.js";
import { mountShell, updateShell } from "./ui/shell.js";
import { seedWelcome } from "./core/seed.js";
import { entryMenu } from "./views/actions.js";
import { homeView } from "./views/home.js";
import { landingView } from "./views/landing.js";
import { dayView, folderView, libraryView } from "./views/library.js";
import { bookView } from "./views/book.js";
import { editorView } from "./views/editor.js";
import { readerView } from "./views/reader.js";
import { searchView } from "./views/search.js";
import { trashView } from "./views/trash.js";
import { settingsView } from "./views/settings.js";
import { missingView } from "./views/missing.js";

const routes = {
  home: () => landingView(),
  today: () => homeView(),
  library: () => libraryView(),
  book: (route) => bookView(route.params[0]),
  folder: (route) => folderView(route.params[0]),
  day: (route) => dayView(route.params[0]),
  write: (route) => editorView(route),
  read: (route) => readerView(route),
  search: (route) => searchView(route),
  trash: () => trashView(),
  settings: () => settingsView(),
};

const viewElement = $("#view");

paintTheme(loadSettings().theme);
mountShell();

const router = createRouter({
  routes,
  mount: viewElement,
  fallback: () =>
    missingView({
      title: "That page is not here",
      message: "The address does not match anything in APPY. The library is a good place to start again.",
      back: "/library",
      backLabel: "Open the library",
    }),
  onRoute: (route) => updateShell(route),
});

viewElement.innerHTML = `<p class="dim" style="padding:1rem 0">Opening your diary…</p>`;

document.addEventListener("click", (event) => {
  // The hash belongs to the router, so the skip link cannot be a real
  // fragment. Focus the view directly instead of navigating to #view.
  const skip = event.target.closest(".skip-link");
  if (skip) {
    event.preventDefault();
    const target = viewElement.querySelector("[data-skip-target]") || viewElement;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: "start" });
    return;
  }

  const trigger = event.target.closest("[data-menu]");
  if (!trigger) return;
  event.preventDefault();
  entryMenu(trigger.dataset.menu, trigger);
});

document.addEventListener("keydown", (event) => {
  if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
  if (event.key.toLowerCase() !== "k") return;

  event.preventDefault();
  const current = (location.hash || "#/").replace(/^#\//, "").split("?")[0];
  if (current === "search") {
    document.querySelector('[data-field="q"]')?.focus();
  } else {
    navigate("/search");
  }
});

boot();

async function boot() {
  try {
    await store.init();
    await seedWelcome();
    router.render();
  } catch (error) {
    fatal(error);
  }
}

function fatal(error) {
  console.error("APPY could not open the diary", error);

  const message =
    error?.message ||
    "The diary could not be opened. Reloading the page usually helps.";
  const quota = error?.code === "quota";

  viewElement.innerHTML = `
    <div style="max-width:34rem;padding:clamp(2rem,6vw,4rem) 0">
      <p class="label is-accent">Storage</p>
      <h1 class="display" style="margin:0.5rem 0 0.8rem">${
        quota ? "There is no room left on this device." : "The diary could not be opened."
      }</h1>
      <p class="dim">${esc(message)}</p>
      <p class="dim" style="margin-top:0.8rem">
        Nothing has been deleted. If this browser is in a private window, storage may be blocked entirely.
        Opening APPY in a normal window usually fixes it.
      </p>
      <div class="empty-actions">
        <button class="btn btn--primary" type="button" data-retry>Try again</button>
      </div>
    </div>
  `;

  viewElement.querySelector("[data-retry]")?.addEventListener("click", () => location.reload());
}
