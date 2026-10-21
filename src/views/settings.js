/* ============================================================
   APPY — settings
   Appearance, reading defaults, and the honest conversation
   about where the writing lives and how to get it back out.
   ============================================================ */

import { esc, h } from "../ui/dom.js";
import { modal, toast } from "../ui/kit.js";
import { pageHead } from "../ui/shell.js";
import { navigate } from "../ui/router.js";
import * as store from "../core/store.js";
import { db } from "../core/db.js";
import { todayISO } from "../core/model.js";

const THEMES = [
  { id: "system", label: "System" },
  { id: "light", label: "Paper" },
  { id: "dark", label: "Lamplight" },
];

const SCALES = [
  { value: "1", label: "Small" },
  { value: "1.12", label: "Medium" },
  { value: "1.24", label: "Large" },
];

export function settingsView() {
  const root = h("div", { class: "settings" });
  const settings = store.settings();
  const counts = store.state.counts;

  root.innerHTML = `
    ${pageHead({
      eyebrow: "APPY",
      title: "Settings",
      intro: `${counts.entries.toLocaleString()} entries · ${counts.books} books · ${counts.words.toLocaleString()} words, all on this device.`,
    })}

    <section aria-labelledby="lookHeading">
      <h2 class="display" id="lookHeading" style="font-size:1.25rem;margin-bottom:0.4rem">The look</h2>

      <div class="settings-row">
        <div>
          <strong>Theme</strong>
          <p>Warm paper, or lamplight. Follow the system unless you would rather choose.</p>
        </div>
        <div class="controls">
          <div class="segmented" role="group" aria-label="Theme">
            ${THEMES.map(
              (theme) => `
                <button type="button" data-theme-choice="${theme.id}"
                  aria-pressed="${settings.theme === theme.id}">${theme.label}</button>
              `
            ).join("")}
          </div>
        </div>
      </div>

      <div class="settings-row">
        <div>
          <strong>What should APPY call you?</strong>
          <p>Used only in the greeting on the home screen. It stays on this device.</p>
        </div>
        <div class="controls">
          <input class="input" type="text" data-field="name" maxlength="60" autocomplete="off"
            placeholder="Your name" value="${esc(settings.name)}" aria-label="Your name" />
        </div>
      </div>
    </section>

    <section aria-labelledby="readingHeading">
      <h2 class="display" id="readingHeading" style="font-size:1.25rem;margin-bottom:0.4rem">Reading</h2>

      <div class="settings-row">
        <div>
          <strong>When a book opens</strong>
          <p>Pages to turn, or one quiet column. You can switch inside the reading room at any time.</p>
        </div>
        <div class="controls">
          <select class="select" data-field="readerView" aria-label="Default reading view">
            <option value="spread" ${settings.readerView === "spread" ? "selected" : ""}>Book pages</option>
            <option value="list" ${settings.readerView === "list" ? "selected" : ""}>List</option>
          </select>
        </div>
      </div>

      <div class="settings-row">
        <div>
          <strong>Text size</strong>
          <p>Applies to the reading room. Serif at a comfortable measure.</p>
        </div>
        <div class="controls">
          <select class="select" data-field="readerScale" aria-label="Reading text size">
            ${SCALES.map(
              (scale) =>
                `<option value="${scale.value}" ${
                  Number(settings.readerScale) === Number(scale.value) ? "selected" : ""
                }>${scale.label}</option>`
            ).join("")}
          </select>
        </div>
      </div>
    </section>

    <section aria-labelledby="dataHeading">
      <h2 class="display" id="dataHeading" style="font-size:1.25rem;margin-bottom:0.4rem">Your data</h2>

      <div class="settings-row">
        <div style="flex:1">
          <strong>Stored in this browser</strong>
          <p data-storage-note>Checking how much room this diary is using…</p>
          <div class="storage-bar" aria-hidden="true"><span class="storage-fill" data-storage-fill style="width:0"></span></div>
        </div>
        <div class="controls" style="align-self:center">
          <span class="chip" data-persist>Checking…</span>
        </div>
      </div>

      <div class="settings-row">
        <div>
          <strong>Backups</strong>
          <p>
            Export writes a single JSON file with every book, folder, and entry. Import can replace this
            diary or merge another one into it. Keep the file somewhere you trust.
          </p>
        </div>
        <div class="controls">
          <button class="btn" type="button" data-action="export">Export a backup</button>
          <button class="btn" type="button" data-action="import">Import a backup</button>
        </div>
      </div>

      <input type="file" accept="application/json,.json" data-file hidden />

      <div class="settings-row">
        <div>
          <strong>Ask the browser to keep it</strong>
          <p>
            Browsers may clear storage when a device runs low on space. Persistence asks yours not to. It is
            a request, not a guarantee — exports are the real guarantee.
          </p>
        </div>
        <div class="controls">
          <button class="btn" type="button" data-action="persist">Request persistence</button>
        </div>
      </div>
    </section>

    <section aria-labelledby="dangerHeading">
      <h2 class="display" id="dangerHeading" style="font-size:1.25rem;margin-bottom:0.4rem">Leaving</h2>

      <div class="settings-row">
        <div>
          <strong>Delete every book and entry</strong>
          <p>This empties the diary in this browser. It cannot be undone, and the trash goes too.</p>
        </div>
        <div class="controls">
          <button class="btn btn--danger" type="button" data-action="wipe">Delete all writing</button>
        </div>
      </div>
    </section>

    <section aria-labelledby="aboutHeading">
      <h2 class="display" id="aboutHeading" style="font-size:1.25rem;margin-bottom:0.4rem">About APPY</h2>
      <p class="dim" style="max-width:38rem">
        APPY keeps books, folders, and entries in IndexedDB, inside this browser, on this device. Nothing is
        uploaded and there is no account. Preferences such as theme and text size live in local storage.
        Clearing site data for this page erases the diary, and a different browser or device starts empty.
      </p>
      <p class="dim" style="max-width:38rem;margin-top:0.8rem">
        APPY makes no network requests with your writing. Export before clearing anything.
      </p>
      <p class="rail-note" style="margin-top:1rem">APPY · version 2 · built to be kept</p>
    </section>
  `;

  root.addEventListener("click", onClick);
  root.addEventListener("input", onInput);
  root.addEventListener("change", onChange);

  const unsubscribe = store.subscribe((reason) => {
    if (reason === "settings") paintThemeChoices();
  });

  let nameTimer = 0;

  refreshStorage();

  return {
    root,
    title: "Settings",
    destroy() {
      window.clearTimeout(nameTimer);
      unsubscribe();
      root.removeEventListener("click", onClick);
      root.removeEventListener("input", onInput);
      root.removeEventListener("change", onChange);
    },
  };

  /* ---------- events ---------- */

  function paintThemeChoices() {
    const theme = store.settings().theme;
    root.querySelectorAll("[data-theme-choice]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.themeChoice === theme));
    });
  }

  function onInput(event) {
    const field = event.target.closest('[data-field="name"]');
    if (!field) return;
    const value = field.value.trim();
    window.clearTimeout(nameTimer);
    nameTimer = window.setTimeout(() => {
      store.updateSettings({ name: value }, { silent: true });
    }, 350);
  }

  function onClick(event) {
    const themeButton = event.target.closest("[data-theme-choice]");
    if (themeButton) {
      store.updateSettings({ theme: themeButton.dataset.themeChoice });
      paintThemeChoices();
      return;
    }

    const action = event.target.closest("[data-action]")?.dataset.action;
    if (!action) return;

    if (action === "export") exportBackup();
    if (action === "import") root.querySelector("[data-file]")?.click();
    if (action === "persist") requestPersistence();
    if (action === "wipe") wipeEverything();
  }

  function onChange(event) {
    const field = event.target.closest("[data-field]");
    if (field) {
      if (field.dataset.field === "name") {
        store.updateSettings({ name: field.value.trim() }, { silent: true });
        toast(field.value.trim() ? "The greeting will use your name." : "The greeting will stay impersonal.");
      }
      if (field.dataset.field === "readerView") {
        store.updateSettings({ readerView: field.value }, { silent: true });
        toast("Reading default saved.");
      }
      if (field.dataset.field === "readerScale") {
        store.updateSettings({ readerScale: Number(field.value) }, { silent: true });
        toast("Text size saved.");
      }
      return;
    }

    if (event.target.matches("[data-file]")) {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (file) importBackup(file);
    }
  }

  /* ---------- storage ---------- */

  async function refreshStorage() {
    const note = root.querySelector("[data-storage-note]");
    const fill = root.querySelector("[data-storage-fill]");
    const chip = root.querySelector("[data-persist]");

    const [estimate, persisted] = await Promise.all([db.estimate(), db.persistenceState()]);

    if (!note || !fill || !chip) return;

    if (!estimate || !estimate.quota) {
      note.textContent =
        "This browser will not report storage figures. Your diary is still saved locally in this browser.";
      fill.style.width = "0";
    } else {
      const percent = Math.min(100, (estimate.usage / estimate.quota) * 100);
      note.textContent = `About ${formatBytes(estimate.usage)} used, of roughly ${formatBytes(
        estimate.quota
      )} available to this site.`;
      fill.style.width = `${Math.max(percent, 0.6)}%`;
    }

    chip.textContent =
      persisted === "granted"
        ? "Kept by the browser"
        : persisted === "denied"
          ? "May be cleared"
          : "Persistence unavailable";
  }

  async function requestPersistence() {
    const state = await db.requestPersistence();
    if (state === "granted") toast("The browser agreed to keep this diary.");
    else if (state === "unsupported") toast("This browser does not offer persistent storage.", { tone: "error" });
    else toast("The browser declined. Export a backup instead.", { tone: "error" });
    refreshStorage();
  }

  /* ---------- backup ---------- */

  async function exportBackup() {
    try {
      const data = await store.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `appy-backup-${todayISO()}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast(
        `Backup exported: ${data.entries.length} ${
          data.entries.length === 1 ? "entry" : "entries"
        }, ${data.books.length} ${data.books.length === 1 ? "book" : "books"}.`
      );
    } catch (error) {
      toast(error?.message || "The backup could not be written.", { tone: "error" });
    }
  }

  async function importBackup(file) {
    let data;
    try {
      data = JSON.parse(await file.text());
    } catch {
      toast("That file is not valid JSON.", { tone: "error" });
      return;
    }

    const problem = store.validateBackup(data);
    if (problem) {
      toast(problem, { tone: "error" });
      return;
    }

    const entryCount = data.entries.length;
    const bookCount = data.books.length;

    const replace = h("input", { type: "radio", name: "import-mode", value: "replace" });
    const merge = h("input", { type: "radio", name: "import-mode", value: "merge", checked: true });

    const body = h("div", { class: "stack" });
    body.append(
      h(
        "p",
        { class: "dim", style: { fontSize: "0.9rem" } },
        `The file holds ${entryCount} ${entryCount === 1 ? "entry" : "entries"} and ${bookCount} ${
          bookCount === 1 ? "book" : "books"
        }.`
      )
    );

    [
      [merge, "Merge into this diary", "Keeps what is here. Adds anything with an id it has not seen."],
      [replace, "Replace this diary", "Wipes what is here first, then restores the file exactly."],
    ].forEach(([input, title, description]) => {
      const label = h("label", {
        style: {
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          gap: "0.6rem",
          alignItems: "start",
          padding: "0.7rem",
          border: "1px solid var(--rule)",
          borderRadius: "3px",
          cursor: "pointer",
        },
      });
      label.append(input);
      const copy = h("span");
      copy.append(h("strong", { text: title, style: { display: "block" } }));
      copy.append(h("span", { class: "dim", text: description, style: { fontSize: "0.84rem" } }));
      label.append(copy);
      body.append(label);
    });

    const mode = await modal({
      title: "Import a backup",
      lede: "Choose how this file should meet the diary already here.",
      body,
      submitLabel: "Import",
      onSubmit: () => (replace.checked ? "replace" : "merge"),
      closeValue: null,
    });

    if (!mode) return;

    try {
      const stats = await store.importAll(data, mode);
      toast(`Imported. ${stats.entries} entries and ${stats.books} books are in the diary now.`);
      refreshStorage();
      if (mode === "replace") navigate("/");
    } catch (error) {
      toast(error?.message || "The import failed.", { tone: "error" });
    }
  }

  /* ---------- leaving ---------- */

  async function wipeEverything() {
    const first = await modal({
      title: "Delete every book and entry?",
      lede: `This removes ${counts.entries.toLocaleString()} entries from this browser. Export a backup first if there is any doubt.`,
      submitLabel: "Choose what happens",
      danger: true,
      onSubmit: () => true,
      closeValue: false,
    });

    if (!first) return;

    const confirmInput = h("input", {
      class: "input",
      type: "text",
      placeholder: "DELETE",
      autocomplete: "off",
      "aria-label": "Type DELETE to confirm",
    });

    const field = h("label", { class: "field" });
    field.append(h("span", { class: "label", text: "Type DELETE to confirm" }));
    field.append(confirmInput);

    const confirmed = await modal({
      title: "This cannot be undone",
      lede: "The trash is emptied too. There is no copy inside APPY after this.",
      body: field,
      submitLabel: "Delete everything",
      danger: true,
      onSubmit: () => {
        if (confirmInput.value.trim().toUpperCase() !== "DELETE") {
          throw new Error("Type DELETE to confirm.");
        }
        return true;
      },
      closeValue: false,
    });

    if (!confirmed) return;

    await store.wipeDiary();
    toast("APPY is empty again.");
    navigate("/");
  }
}

function formatBytes(bytes) {
  if (!bytes) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  const power = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** power;
  return `${value.toFixed(power === 0 ? 0 : 1)} ${units[power]}`;
}
