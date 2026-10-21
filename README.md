# APPY

A diary for everyday life. Write into folders and books, keep everything on
your own device, and read it back as pages that turn.

**Live:** https://mreyadishere-bit.github.io/APPY/
**Reading room:** https://mreyadishere-bit.github.io/APPY/read.html

## What it is

APPY organises daily writing the way a shelf organises books, not the way a
feed organises posts:

- **Folders** hold books.
- **Books** hold pages — a year, a trip, a difficult month.
- **Entries** are saved on the device you wrote them on.
- The **reading room** presents a book as an open spread with pages you can turn.

## Pages

| Route | What it is |
| --- | --- |
| `/` | The landing page — masthead, hero, three sections, pull quote |
| `/read.html` | The reading room — a shelf of three sample books and a working reader |
| `/404.html` | Styled not-found page |

## The reading room

`read.html` holds three sample books as plain, semantic HTML. `src/reader.js`
turns them into a two-page spread reader:

- two entries per spread on wide screens, one on narrow screens
- previous / next controls, a progress rule, and page folios
- ArrowLeft / ArrowRight to page, Escape to return to the shelf
- an `aria-live` region announcing the current spread
- deep links — `/read.html#book-winter` opens that book directly
- a `leaf-turn` animation, disabled under `prefers-reduced-motion`

**Without JavaScript** the reader never activates and the books render as a
plain, readable sequence of entries. Nothing is hidden behind a script.

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
read.html               reading room (shelf + reader + source entries)
404.html                not-found page
style.css               the whole design system
src/app.js              theme persistence, hero page turn
src/reader.js           shelf / spread reader
og.png                  1200x630 social card
robots.txt              crawl rules
sitemap.xml             both routes
.github/workflows/pages.yml   build, validate, deploy
```

## Deploy

Every push to `main` runs `.github/workflows/pages.yml`:

1. `node --check` on both scripts
2. assembles `_site/` and cache-busts assets with the commit SHA
3. asserts every expected file exists, the meta tags are present, and no
   template markers survived
4. deploys to GitHub Pages

A broken script or a missing page fails the build instead of shipping.

## Local preview

```bash
python -m http.server 8000
# http://localhost:8000/
```

Paths are rooted at `/APPY/` because this is a project site, not a user site.

## Still to come

The reader is a sample. A real APPY needs the writing side — creating folders,
creating books, and saving entries to the device.
