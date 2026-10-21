/* ============================================================
   APPY — behaviour
   Theme persistence, the page turn, and small courtesies.
   No dependencies.
   ============================================================ */

(function () {
  "use strict";

  var STORAGE_KEY = "appy-theme";
  var root = document.documentElement;

  /* ---------- theme ---------- */

  function systemPrefersDark() {
    return window.matchMedia
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : false;
  }

  function readStoredTheme() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function effectiveTheme() {
    var stored = root.getAttribute("data-theme");
    if (stored === "light" || stored === "dark") return stored;
    return systemPrefersDark() ? "dark" : "light";
  }

  function paintTheme(theme) {
    if (theme === "light" || theme === "dark") {
      root.setAttribute("data-theme", theme);
    } else {
      root.removeAttribute("data-theme");
    }

    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute("content", effectiveTheme() === "dark" ? "#14120e" : "#f7f4ee");
    }

    var toggle = document.getElementById("themeToggle");
    if (toggle) {
      var label = toggle.querySelector(".toggle-label");
      var current = effectiveTheme();
      toggle.setAttribute("data-theme-mode", current);
      if (label) label.textContent = current === "dark" ? "Dark" : "Light";
      toggle.setAttribute(
        "aria-label",
        current === "dark" ? "Switch to light theme" : "Switch to dark theme"
      );
    }
  }

  /* Paint before first meaningfully visible frame to avoid a flash. */
  paintTheme(readStoredTheme());

  var toggle = document.getElementById("themeToggle");
  if (toggle) {
    toggle.addEventListener("click", function () {
      var next = effectiveTheme() === "dark" ? "light" : "dark";
      paintTheme(next);
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch (e) {
        /* storage blocked — the choice still holds for this session */
      }
    });
  }

  /* Follow the system only while the reader has not chosen for themselves. */
  if (window.matchMedia) {
    var query = window.matchMedia("(prefers-color-scheme: dark)");
    var onSystemChange = function () {
      if (!readStoredTheme()) paintTheme(null);
    };
    if (query.addEventListener) {
      query.addEventListener("change", onSystemChange);
    } else if (query.addListener) {
      query.addListener(onSystemChange);
    }
  }

  /* ---------- the page turn ---------- */

  var book = document.getElementById("book");
  var pageTurn = document.getElementById("pageTurn");

  if (book && pageTurn) {
    var turn = function () {
      var turned = book.classList.toggle("is-turned");
      pageTurn.setAttribute("aria-label", turned ? "Turn back the page" : "Turn the page");
    };

    pageTurn.addEventListener("click", turn);

    /* Space or Enter on the focused turn target is handled natively by
       the button; this only adds Escape to undo. */
    pageTurn.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && book.classList.contains("is-turned")) {
        turn();
      }
    });
  }

  /* ---------- footer year ---------- */

  var year = document.getElementById("year");
  if (year) {
    year.textContent = String(new Date().getFullYear());
  }
})();
