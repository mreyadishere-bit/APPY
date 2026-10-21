# APPY

A diary for everyday life. Write into folders and books, keep everything on
your own device, and read it back as pages that turn.

**Live:** https://mreyadishere-bit.github.io/APPY/

## What it is

APPY organises daily writing the way a shelf organises books, not the way a
feed organises posts:

- **Folders** hold books.
- **Books** hold pages — a year, a trip, a difficult month.
- **Entries** are saved on the device you wrote them on.
- The **reading view** presents a book as an open spread with pages you can turn.

## Design

Warm editorial. Paper and ink, one clay accent (`#9a4a2f`), a serif voice for
prose and small sans-serif capitals for labels. Hairline rules instead of
cards; no gradients, no iconography, no emoji.

- Light: paper `#f7f4ee` on ink `#17150f`
- Dark: warm charcoal `#14120e`, not blue-black
- Display type: Iowan Old Style → Palatino → Georgia stack
- Layout: asymmetric, left-aligned, numbered sections

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The page — masthead, hero, three sections, pull quote |
| `style.css` | Whole design system in CSS custom properties |
| `src/app.js` | Theme persistence, the page-turn interaction, quiet reveals |
| `404.html` | Styled not-found page |

## The book

The open book in the hero is drawn entirely in CSS — no images, no SVG, no
canvas. It is a two-page spread with a spine, inset shadows for the gutter,
and a page that rotates on `rotateY` when clicked. The `Turn` hint appears on
hover, and Escape reverses it.

## Deploy

Every push to `main` runs `.github/workflows/pages.yml`:

1. `node --check src/app.js`
2. assembles `_site/` and cache-busts assets with the commit SHA
3. asserts the required files exist before publishing
4. deploys to GitHub Pages

A broken script fails the build instead of taking the site down.

## Local preview

```bash
python -m http.server 8000
# http://localhost:8000/
```

Paths are rooted at `/APPY/` because this is a project site, not a user site.
