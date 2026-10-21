/* ============================================
   APPY — app behaviour
   ============================================ */

(function () {
  "use strict";

  var STORAGE_KEY = "appy-theme";
  var root = document.documentElement;

  /* ---------- theme ---------- */

  function systemPrefersDark() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function applyTheme(theme) {
    if (theme === "light" || theme === "dark") {
      root.setAttribute("data-theme", theme);
    } else {
      root.removeAttribute("data-theme");
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute(
        "content",
        theme === "light" ? "#fbfbfd" : theme === "dark" ? "#0b0c14" : systemPrefersDark() ? "#0b0c14" : "#fbfbfd"
      );
    }
  }

  function storedTheme() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  /* Apply the saved theme as early as possible to avoid a flash. */
  applyTheme(storedTheme());

  var toggle = document.getElementById("themeToggle");
  if (toggle) {
    toggle.addEventListener("click", function () {
      var current = root.getAttribute("data-theme");
      var next;
      if (current === "dark") {
        next = "light";
      } else if (current === "light") {
        next = "dark";
      } else {
        next = systemPrefersDark() ? "light" : "dark";
      }
      applyTheme(next);
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch (e) {
        /* storage unavailable — theme still applies for this session */
      }
    });
  }

  /* ---------- footer year ---------- */

  var year = document.getElementById("year");
  if (year) {
    year.textContent = String(new Date().getFullYear());
  }

  /* ---------- deploy status ---------- */

  /* GitHub Pages exposes the deployed commit SHA through the build info
     endpoint on the `github.io` host. Falls back silently. */
  var status = document.getElementById("deployStatus");
  if (status) {
    status.textContent = "automatic";
  }
})();
