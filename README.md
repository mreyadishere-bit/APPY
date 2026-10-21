# APPY

A diary for everyday life. Write into folders and books, keep everything on
your own device, and read it back as pages that turn.

**Live:** https://mreyadishere-bit.github.io/APPY/
**Writing room:** https://mreyadishere-bit.github.io/APPY/write.html
**Reading room:** https://mreyadishere-bit.github.io/APPY/read.html

## What it is

APPY organises daily writing the way a shelf organises books, not the way a
feed organises posts:

- **Folders** hold books.
- **Books** hold entries — a year, a trip, a difficult month.
- **Entries** are saved in the browser on the device you wrote them on.
- The **reading room** presents a book as an open spread with pages you can turn.

There is no account, no server, and no sync. Nothing you write is uploaded
anywhere; the site is static files.

## Pages

| Route | What it is |
| --- | --- |
| `/` | The landing page — masthead, hero, three sections, pull quote |
| `/write.html` | The writing room — library, entry list, editor |
| `/read.html` | The reading room — your books, three samples, and the reader |
| `/404.html` | Styled not-found page |

## The writing room

`write.html` is the working app. Everything happens against IndexedDB on the
device, so it keeps working offline once the page has loaded.

- **Library** — folders with their books, in the order you made them.
- **Books** — create, rename, delete. Deleting a book takes its entries with it.
- **Entries** — a date and a page of prose. Sorted oldest first, the way a
  diary reads.
- **Autosave** — writing stops for 700ms and the entry is stored. `Ctrl`/`Cmd`+`S`
  saves immediately. A brand-new entry that is still empty is never stored.
- **Delete** — removing a folder removes its books and their entries; both
  actions ask first.
- **Export / import** — a single JSON backup of the whole diary. Import replaces
  what is currently stored, after a confirmation.

## Storage

`src/store.js` wraps IndexedDB as `window.AppyStore`. One database, `appy`,
version 1, with three object stores:

| Store | Key | Shape |
| --- | --- | --- |
| `folders` | `id` | `{ id, name, createdAt }` |
| `books` | `id` | `{ id, folderId, title, createdAt }` |
| `entries` | `id` | `{ id, bookId, date, text, createdAt, updatedAt }` |

`date` is a local `YYYY-MM-DD` string, so an entry keeps the day it was written
even if the device changes timezone. `createdAt` / `updatedAt` are epoch
milliseconds.

IndexedDB is scoped to the origin: entries written at
`http://localhost:8000` are not visible at `https://mreyadishere-bit.github.io`,
and a diary written in one browser is not readable in another. That is the
point, and it is also why the export exists — it is the only way to move a
diary between devices.

## The reading room

`read.html` shows your own books first, built from IndexedDB at load, then three
sample books that live as plain semantic HTML in the page. `src/reader.js`
turns each into a two-page spread reader:

- two entries per spread on wide screens, one on narrow screens
- previous / next controls, a progress rule, and page folios
- ArrowLeft / ArrowRight to page, Escape to return to the shelf
- an `aria-live` region announcing the current spread
- deep links — `/read.html#book-winter` opens that book directly, and a book of
  yours opens at `#user-<id>`
- a `leaf-turn` animation, disabled under `prefers-reduced-motion`

**Without JavaScript** the reader never activates and the books render as a
plain, readable sequence of entries. Nothing is hidden behind a script. A book
with no entries is not shown on the shelf, because there would be nothing to
read.

## Design

Warm editorial. Paper and ink, one clay accent (`#9a4a2f`), a serif voice for
prose and small sans-serif capitals for labels. Hairline rules instead of
cards; no gradients, no iconography, no emoji.

- Light: paper `#f7f4ee` on ink `#17150f`
- Dark: warm charcoal `#14120e`, not blue-black
- Display type: Iowan Old Style → Palatino → Georgia stack
- Layout: asymmetric, left-aligned, numbered sections

The open book on the landing page is drawn entirely in CSS — no image, no SVG,
no canvas.

## Files

```
index.html              landing page
read.html               reading room (shelf + reader + sample entries)
write.html              writing room (library + editor)
404.html                not-found page
style.css               the whole design system
src/app.js              theme persistence, hero page turn
src/store.js            IndexedDB: folders, books, entries, export/import
src/writing.js          library tree, editor, autosave
src/reader.js           shelf / spread reader
og.png                  1200x630 social card
robots.txt              crawl rules
sitemap.xml             all three routes
.github/workflows/pages.yml   build, validate, deploy
```

## Deploy

Every push to `main` runs `.github/workflows/pages.yml`:

1. `node --check` on all four scripts
2. assembles `_site/` and cache-busts assets with the commit SHA
3. asserts every expected file exists, every page ships its scripts already
   cache-busted, the meta tags are present, and no template markers survived
4. deploys to GitHub Pages

A broken script or a missing page fails the build instead of shipping.

## Local preview

```bash
python -m http.server 8000
# http://localhost:8000/
```

Paths are rooted at `/APPY/` because this is a project site, not a user site.
Use `http://localhost:8000/` for development; the storage you create there is
separate from the live site.
