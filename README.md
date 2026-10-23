# APPY

A private diary for everyday life. Write entries into books, group them with
folders, search everything instantly, and read your days back as pages that
turn. Everything stays in your own browser.

**Live:** https://mreyadishere-bit.github.io/APPY/

No account, no server, no sync, no analytics. The site is a set of static files;
the diary lives in IndexedDB on the device that wrote it.

## What it is

APPY organises writing the way a shelf organises books, not the way a feed
organises posts:

- **Books** are diaries — a year, a trip, a difficult month. Each has a title,
  a subtitle, and a cover (material + colour).
- **Entries** belong to exactly one book and, optionally, one folder. An entry
  has a title, a date, a body, and an optional mood.
- **Folders** group entries by subject across books; they never hide writing.
- The **reading room** opens a book as an animated spread with pages you can
  turn, a table of contents, and a plain list for anyone who would rather
  scroll.

The **front door** at `#/` is the editorial landing page: a masthead, an open
book that shows the newest entries and turns through them, three numbered notes
on how the diary works, and a pull quote. Its buttons lead into the app; the
rail is hidden there so the page can own the whole window. The dashboard lives
at `#/today`.

## Routes

The app is one page; routes live in the hash so GitHub Pages needs no rewrite
rules.

| Route | What it is |
| --- | --- |
| `#/` | The front door — masthead, hero, three notes, a quote |
| `#/today` | Today — greeting, continue writing, shelf, recent entries, calendar |
| `#/library` | Every book and folder, with all entries |
| `#/book/:id` | One book: cover, facts, entry list |
| `#/folder/:id` | Entries filed in one folder |
| `#/day/:date` | Everything written on one day (`YYYY-MM-DD`) |
| `#/write` | A new entry |
| `#/write/:id` | Edit an entry |
| `#/read/:bookId` | The reading room (`?entry=<id>` opens at that entry) |
| `#/search` | Instant search with filters and sorting |
| `#/trash` | Soft-deleted entries, with restore and permanent delete |
| `#/settings` | Theme, name, reading preferences, backup, storage, wipe |

`/write.html` and `/read.html` are kept as small redirect stubs so old links and
bookmarks still land in the right place.

## Storage

One IndexedDB database, `appy`, version 2, with four stores:

| Store | Key | Shape |
| --- | --- | --- |
| `books` | `id` | `{ id, title, subtitle, cover: { style, accent }, createdAt, updatedAt }` |
| `folders` | `id` | `{ id, name, color, createdAt }` |
| `entries` | `id` | `{ id, bookId, folderId, title, date, body, mood, createdAt, updatedAt, deletedAt }` |
| `meta` | `key` | `{ key, value }` — schema version, one-time flags |

`date` is a local `YYYY-MM-DD` string, so an entry keeps the day it was written
even if the device changes timezone. Timestamps are epoch milliseconds. The body
is sanitised HTML from a small allowlist (`p`, `h3`, `h4`, `blockquote`, lists,
`strong`, `em`, `u`, `s`, links, `mark`).

Preferences — theme, name, last book and entry, reader scale and view — are
small values in `localStorage` under `appy:settings`. The diary itself is never
in `localStorage`.

### Where the diary lives

IndexedDB is scoped to the origin. Entries written at `http://localhost:8123`
are not visible at `https://mreyadishere-bit.github.io`, and a diary written in
one browser is not readable in another. That is the point, and it is also why
export exists: it is the only way to move a diary between devices or to keep a
copy that survives clearing site data.

Settings → **Export a backup** writes one JSON file with every book, folder, and
entry, including trashed entries. **Import a backup** can merge (keep what is
here, add unseen ids) or replace (wipe first, then restore the file). A backup
is validated before anything is touched; entries that point at a missing book
are collected into a recovered book instead of disappearing.

### Recovery

The editor autosaves the real entry after a short pause. It also keeps a
synchronous draft in `localStorage` (`appy:draft`) while you type, so a crashed
tab or an accidental reload can offer the words back on the next visit. A draft
is cleared as soon as the entry is safely stored.

### Deleting

- An entry goes to the **trash** first; it can be restored, and a toast offers
  an undo immediately after.
- Deleting a **folder** only unfiles its entries.
- Deleting a **book** forces a choice: move its entries into another book, or
  send them to the trash. Writing is never silently destroyed.
- Wiping the diary asks twice, including typing a confirmation, and tells you
  how many entries will go.

## The reading room

`#/read/:bookId` is an overlay over the whole window: a closed cover that opens
into a spread.

- Two entries per spread on wide screens, one on narrow ones.
- One page turn per keypress; the outgoing leaf is cloned and rotated with the
  Web Animations API, then removed.
- Arrow keys page, `Home` / `End` jump, `Esc` closes, `T` opens the table of
  contents, `L` toggles the list, `F` toggles fullscreen.
- `Aa` changes the reading scale; the choice is remembered.
- Swipe left/right on touch screens.
- `#/read/:bookId?entry=<id>` opens at a specific entry.
- Every animation is skipped under `prefers-reduced-motion`, and focus is
  returned to the control that opened the room.

## Accessibility

- Semantic landmarks, one `h1` per view, labelled controls, `aria-current` on
  navigation and contents.
- Visible focus rings; a skip link; focus is moved into dialogs and restored on
  close.
- Toasts are `aria-live` regions; the reader announces its current spread.
- Contrast is checked against both themes; colour is never the only signal.
- Reduced motion removes page turns, cover openings, and view transitions.

## Design

Warm editorial: paper and ink, one clay accent, a serif voice for prose and small
sans-serif capitals for labels. Hairline rules instead of cards.

- Light: paper `#f5f1e6`, ink `#1a1710`, clay `#9c4a2f`
- Dark: warm charcoal `#131210`, not blue-black
- Type: Iowan Old Style → Palatino → Georgia for prose; the system sans stack for
  labels (no webfonts, no external requests)
- The covers and the open book are drawn in CSS

## Files

```
index.html                    the app shell (theme boot, five stylesheets, module entry)
404.html                      styled not-found page
write.html, read.html         redirect stubs for old links
styles/tokens.css             colours, type, spacing, motion
styles/base.css               reset, typography, buttons, fields, chips, dialogs, toasts
styles/app.css                rail, home, library, editor, search, settings
styles/reader.css             the reading room: covers, spreads, leaves, contents
styles/landing.css            the front door: masthead, hero, notes, quote, footer

src/main.js                   boot, routes, global handlers, fatal screen
src/core/db.js                IndexedDB, transactions, StorageError
src/core/model.js             shapes, dates, sanitising, plain text, word counts
src/core/store.js             in-memory state + every mutation + import/export
src/core/search.js            scoring, snippets, filters
src/core/settings.js          preferences in localStorage
src/core/draft.js             crash-safe drafts
src/core/seed.js              the one-time Welcome book

src/ui/dom.js                 tiny DOM helpers (h, esc, debounce, focus)
src/ui/kit.js                 dialogs, menus, toasts, covers, entry rows, icons
src/ui/router.js              hash parsing, one mounted view, teardown
src/ui/shell.js               rail, mobile bar, theme, counts
src/ui/entry-list.js          the shared entry list

src/views/home.js             Today: greeting, shelf, recent entries, calendar
src/views/landing.js          the front door: masthead, live hero book, notes
src/views/library.js          books, folders, everything
src/views/book.js             one book
src/views/editor.js           writing, autosave, formatting, move, trash
src/views/reader.js           covers, spreads, page turns, contents, list
src/views/search.js           instant search
src/views/trash.js            restore and permanent delete
src/views/settings.js         theme, name, reading, backup, storage, wipe
src/views/actions.js          create/move/delete flows and their copy
src/views/missing.js          not-found view inside the app
```

No build step, no dependencies, no framework. ES modules load directly.

## Deploy

Every push to `main` runs `.github/workflows/pages.yml`:

1. `node --check` on every `src/**/*.js` file.
2. Assembles `_site/` and cache-busts the stylesheets, the module entry, and
   every relative `from "./….js"` import with the commit SHA.
3. Asserts that every module and stylesheet shipped, the redirect stubs and
   404 exist, the entry is cache-busted, and no template markers survived.
4. Deploys to GitHub Pages.

A broken module or a missing file fails the build instead of shipping.

## Local preview

```bash
python -m http.server 8123
# http://127.0.0.1:8123/
```

Use a local server rather than opening `index.html` directly: ES modules and
IndexedDB both need an origin. Storage at `http://127.0.0.1:8123` is separate
from the live site.

## Flexible page turns

Drag the outer edge of either page with a mouse, pen, or touch. The sheet follows
horizontal movement; release past one third of its width to complete the turn,
or pull back to let it settle. A short, quick flick also completes a turn.
The middle of each page remains available for text selection and vertical scrolling.
Desktop spreads advance two entries at a time; narrow screens advance one.
Keyboard and button controls remain available, including reduced-motion support.
Long entries can be scrolled within their page or read in List mode.

`tests/reader.spec.mjs` exercises drag completion and cancellation, keyboard
navigation, book boundaries, and resizing at desktop and mobile widths. The
Reader interaction checks workflow runs it in Chromium for pull requests.

## Use a subdomain of your existing domain

For example, to publish APPY at `appy.example.com`:

1. Open this repository's **Settings → Pages**. Keep **Source: GitHub Actions**.
2. Enter `appy.example.com` in **Custom domain**, then **Save**.
3. In the DNS service that manages `example.com`, add:

   | Type | Name / Host | Target / Value | TTL |
   | --- | --- | --- | --- |
   | CNAME | appy | mreyadishere-bit.github.io | Auto or 3600 |

   Some providers require `appy.example.com` as the record name. The target must
   have no `https://` and no `/APPY`. Replace a conflicting record for this exact
   subdomain only. Your main domain's existing records stay as they are.
4. Wait for the DNS check in GitHub Pages to succeed, then enable **Enforce HTTPS**
   once the certificate is available. DNS propagation may take up to 24 hours.
5. Open `https://appy.example.com` and test the library, writing, reading, and backup.
6. Change the old GitHub Pages URL in `index.html`, `404.html`, `read.html`,
   `write.html`, `robots.txt`, and `sitemap.xml` to the new public root URL.
   Keep the trailing slash where present. These files contain canonical/social
   URLs and crawler metadata; internal app links already use relative paths.

This project deploys through Actions; a `CNAME` file is not required by that mode.
Official instructions:
https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site

**Before moving:** export a backup from Settings on the old URL. Browser storage
is scoped to an origin, so the new subdomain will initially have a separate diary.
Import the backup in Settings on the new URL. Verify your entries there before
clearing anything on the old URL. Each visitor's diary stays in their own browser.
