# APPY

A fast, dependency-free static site that deploys itself to GitHub Pages.

**Live:** https://mreyadishere-bit.github.io/APPY/

## How it works

Every push to `main` triggers `.github/workflows/pages.yml`, which:

1. validates `src/app.js` with `node --check`
2. assembles `_site/` from the source files
3. cache-busts `style.css` and `src/app.js` with the commit SHA
4. publishes to GitHub Pages

No build tools, no install step, no dependencies.

## Editing

| File | Purpose |
| --- | --- |
| `index.html` | Page structure and content |
| `style.css` | All styling (CSS variables for theming) |
| `src/app.js` | Theme toggle, year, small behaviours |
| `404.html` | Not-found page |

Paths are rooted at `/APPY/` because this is a project site, not a user site.

## Local preview

```bash
python -m http.server 8000
# open http://localhost:8000/
```

## Theme

Light and dark are both supported. The `◐` button in the nav cycles
system → dark → light. The choice is stored in `localStorage` under
`appy-theme`, and a `data-theme` attribute on `<html>` overrides the
system preference.
