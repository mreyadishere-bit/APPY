/* ============================================================
   APPY — search
   Every word must match somewhere; titles weigh more than prose.
   Small enough to run on every keystroke, cached so it stays that
   way as the diary grows.
   ============================================================ */

import { excerpt, plainText, titleOf } from "./model.js";
import { esc } from "../ui/dom.js";

const cache = new Map();

function cachedText(entry) {
  const key = `${entry.id}:${entry.updatedAt}:${entry.body.length}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const text = plainText(entry.body);
  cache.set(key, text);
  if (cache.size > 4000) {
    const first = cache.keys().next().value;
    cache.delete(first);
  }
  return text;
}

export function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function tokenize(query) {
  return normalize(query)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 0)
    .slice(0, 8);
}

export function searchEntries(entries, query, { books = [], folders = [] } = {}) {
  const tokens = tokenize(query);
  if (!tokens.length) return [];

  const bookNames = new Map(books.map((book) => [book.id, normalize(book.title)]));
  const folderNames = new Map(folders.map((folder) => [folder.id, normalize(folder.name)]));
  const today = Date.now();

  const results = [];

  for (const entry of entries) {
    const title = normalize(entry.title);
    const body = normalize(cachedText(entry));
    const book = bookNames.get(entry.bookId) || "";
    const folder = folderNames.get(entry.folderId) || "";

    let score = 0;
    let matchedAll = true;

    for (const token of tokens) {
      let tokenScore = 0;
      if (title.startsWith(token)) tokenScore += 16;
      else if (title.includes(token)) tokenScore += 11;

      if (body.includes(token)) tokenScore += 4;
      if (book.includes(token)) tokenScore += 3;
      if (folder.includes(token)) tokenScore += 3;

      if (tokenScore === 0) {
        matchedAll = false;
        break;
      }
      score += tokenScore;
    }

    if (!matchedAll) continue;

    const ageDays = Math.max(0, (today - (Date.parse(entry.date) || today)) / 86400000);
    score += Math.max(0, 5 - ageDays / 90);

    results.push({ entry, score });
  }

  return results.sort((a, b) => b.score - a.score || (a.entry.date < b.entry.date ? 1 : -1));
}

/** Wrap matched words in <mark> without letting raw HTML through. */
export function highlight(text, query) {
  const tokens = tokenize(query);
  const source = String(text || "");
  if (!tokens.length) return esc(source);

  const pattern = new RegExp(`(${tokens.map(escapeRegExp).join("|")})`, "gi");
  let out = "";
  let last = 0;

  for (const match of source.matchAll(pattern)) {
    out += esc(source.slice(last, match.index));
    out += `<mark>${esc(match[0])}</mark>`;
    last = match.index + match[0].length;
  }
  out += esc(source.slice(last));
  return out;
}

/** A body excerpt centred on the first hit, so results show why they matched. */
export function snippet(entry, query, length = 180) {
  const text = cachedText(entry);
  if (!text) return "";
  const tokens = tokenize(query);
  if (!tokens.length) return excerpt(entry.body, length);

  const lower = text.toLowerCase();
  let position = -1;
  for (const token of tokens) {
    const index = lower.indexOf(token);
    if (index !== -1 && (position === -1 || index < position)) position = index;
  }
  if (position === -1) return text.slice(0, length) + (text.length > length ? "…" : "");

  const start = Math.max(0, position - 50);
  const end = Math.min(text.length, start + length);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

export const labelFor = (entry) => titleOf(entry);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
