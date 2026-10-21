/* ============================================================
   APPY — the data model
   Shapes, dates, text, and the one place that decides what is
   safe to put back on the page.
   ============================================================ */

import { uid } from "../ui/dom.js";

export const SCHEMA = 2;

export const MOODS = [
  { id: "calm", label: "Calm" },
  { id: "bright", label: "Bright" },
  { id: "grateful", label: "Grateful" },
  { id: "heavy", label: "Heavy" },
  { id: "restless", label: "Restless" },
];

export const COVER_STYLES = ["linen", "cloth", "leather", "paper", "night"];

export const COVER_ACCENTS = [
  "#6a6250",
  "#3f4f5c",
  "#6b3a2a",
  "#b8a884",
  "#232833",
  "#4f5c45",
  "#5a4a6b",
  "#8a5a3c",
  "#2f4a4a",
  "#7a3b3b",
];

export const FOLDER_COLORS = [
  "#9c4a2f",
  "#58654a",
  "#3e4a62",
  "#9d7f42",
  "#6b4a6b",
  "#3f5f5a",
];

/* ---------- dates ---------- */

export function todayISO() {
  return isoOf(new Date());
}

export function isoOf(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function parseISO(iso) {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isISODate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const date = parseISO(value);
  return !!date && isoOf(date) === value;
}

const MONTHS = "January February March April May June July August September October November December".split(" ");

export function formatDate(iso, style = "long") {
  const date = parseISO(iso);
  if (!date) return "";
  const day = date.getDate();
  const month = MONTHS[date.getMonth()];
  const year = date.getFullYear();
  const thisYear = new Date().getFullYear();

  if (style === "short") return `${day} ${month.slice(0, 3)}`;
  if (style === "day") return String(day);
  if (style === "month") return month;
  if (style === "monthYear") return `${month} ${year}`;
  if (style === "full") return `${day} ${month} ${year}`;
  // long: drop the year when it is the current one
  return year === thisYear ? `${day} ${month}` : `${day} ${month} ${year}`;
}

export function formatWeekday(iso) {
  const date = parseISO(iso);
  if (!date) return "";
  return date.toLocaleDateString("en-GB", { weekday: "long" });
}

export function monthKey(iso) {
  return String(iso || "").slice(0, 7);
}

export function monthLabel(key) {
  const [y, m] = String(key || "").split("-").map(Number);
  if (!y || !m) return "";
  return `${MONTHS[m - 1]} ${y}`;
}

/** A 6x7 grid of days for a month, Monday first. */
export function monthMatrix(year, monthIndex) {
  const first = new Date(year, monthIndex, 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(year, monthIndex, 1 - offset);
  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    cells.push({
      iso: isoOf(date),
      day: date.getDate(),
      inMonth: date.getMonth() === monthIndex,
      isToday: isoOf(date) === todayISO(),
    });
  }
  return cells;
}

export function relativeTime(timestamp) {
  if (!timestamp) return "";
  const diff = Date.now() - Number(timestamp);
  const minute = 60000;
  const hour = minute * 60;
  const day = hour * 24;

  if (diff < minute) return "just now";
  if (diff < hour) return `${Math.floor(diff / minute)} min ago`;
  if (diff < day) return `${Math.floor(diff / hour)} h ago`;
  if (diff < day * 2) return "yesterday";
  if (diff < day * 7) return `${Math.floor(diff / day)} days ago`;
  return formatDate(isoOf(new Date(Number(timestamp))), "short");
}

/* ---------- text ---------- */

const DROP = new Set([
  "SCRIPT",
  "STYLE",
  "IFRAME",
  "OBJECT",
  "EMBED",
  "LINK",
  "META",
  "TEMPLATE",
  "NOSCRIPT",
  "SVG",
  "MATH",
  "FORM",
  "INPUT",
  "BUTTON",
  "SELECT",
  "TEXTAREA",
]);

const ALLOWED = new Set([
  "P",
  "BR",
  "H3",
  "H4",
  "BLOCKQUOTE",
  "UL",
  "OL",
  "LI",
  "STRONG",
  "EM",
  "U",
  "S",
  "A",
  "SPAN",
  "DIV",
  "MARK",
]);

const RENAME = { B: "strong", I: "em", STRIKE: "s", DEL: "s", INS: "u", H1: "h3", H2: "h3", H5: "h4", H6: "h4" };

const BLOCK_SELECTOR = "p,h3,h4,blockquote,li,div,br,ul,ol";

function safeHref(value) {
  const href = String(value || "").trim();
  if (/^(https?:|mailto:)/i.test(href)) return href;
  return null;
}

function cleanNode(node, doc) {
  const out = doc.createDocumentFragment();

  node.childNodes.forEach((child) => {
    if (child.nodeType === 3) {
      out.append(doc.createTextNode(child.nodeValue));
      return;
    }
    if (child.nodeType !== 1) return;

    const tag = child.tagName.toUpperCase();
    if (DROP.has(tag)) return;

    const inner = cleanNode(child, doc);

    if (!ALLOWED.has(tag)) {
      out.append(inner);
      return;
    }

    const element = doc.createElement(RENAME[tag] || tag.toLowerCase());

    if (tag === "A") {
      const href = safeHref(child.getAttribute("href"));
      if (!href) {
        out.append(inner);
        return;
      }
      element.setAttribute("href", href);
      element.setAttribute("rel", "noopener noreferrer");
    }

    element.append(inner);
    out.append(element);
  });

  return out;
}

/** Allowlisted HTML, safe to assign with innerHTML. */
export function sanitize(html) {
  const source = String(html ?? "");
  if (!source) return "";
  const doc = new DOMParser().parseFromString(`<body>${source}</body>`, "text/html");
  const fragment = cleanNode(doc.body, doc);
  const holder = doc.createElement("div");
  holder.append(fragment);
  return holder.innerHTML;
}

export function plainText(html) {
  const source = String(html ?? "");
  if (!source) return "";
  const doc = new DOMParser().parseFromString(`<body>${source}</body>`, "text/html");
  doc.body.querySelectorAll(BLOCK_SELECTOR).forEach((block) => {
    block.after(doc.createTextNode(" "));
  });
  return (doc.body.textContent || "").replace(/\s+/g, " ").trim();
}

export function wordCount(html) {
  const text = plainText(html);
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

export function readingMinutes(words) {
  if (!words) return 0;
  return Math.max(1, Math.round(words / 220));
}

export function excerpt(html, max = 160) {
  const text = plainText(html);
  if (!text) return "";
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 60 ? lastSpace : max).trimEnd()}…`;
}

export function titleOf(entry) {
  const title = String(entry?.title || "").trim();
  if (title) return title;

  const text = plainText(entry?.body || "");
  if (!text) return "Untitled entry";
  const sentence = text.split(/(?<=[.!?])\s/)[0] || text;
  const short = sentence.length > 64 ? `${sentence.slice(0, 64).trimEnd()}…` : sentence;
  return short.replace(/[.,;:]$/, "");
}

export function hasTitle(entry) {
  return Boolean(String(entry?.title || "").trim());
}

/** First line of the body, for the reader when there is no title. */
export function firstLine(html) {
  const text = plainText(html);
  return text.slice(0, 90);
}

/* ---------- shapes ---------- */

export function emptyEntry(bookId, folderId = null) {
  const now = Date.now();
  return {
    id: uid(),
    bookId,
    folderId,
    title: "",
    body: "",
    date: todayISO(),
    mood: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

export function normalizeEntry(raw = {}) {
  return {
    id: String(raw.id || uid()),
    bookId: String(raw.bookId || ""),
    folderId: raw.folderId ? String(raw.folderId) : null,
    title: String(raw.title || "").slice(0, 180).trim(),
    body: sanitize(raw.body || ""),
    date: isISODate(raw.date) ? raw.date : todayISO(),
    mood: MOODS.some((mood) => mood.id === raw.mood) ? raw.mood : null,
    createdAt: Number(raw.createdAt) || Date.now(),
    updatedAt: Number(raw.updatedAt) || Date.now(),
    deletedAt: raw.deletedAt ? Number(raw.deletedAt) : null,
  };
}

export function normalizeBook(raw = {}) {
  const now = Date.now();
  const cover = raw.cover || {};
  const style = COVER_STYLES.includes(cover.style) ? cover.style : "cloth";
  const accent = /^#[0-9a-f]{6}$/i.test(cover.accent || "") ? cover.accent : null;

  return {
    id: String(raw.id || uid()),
    title: String(raw.title || "").slice(0, 120).trim() || "Untitled book",
    subtitle: String(raw.subtitle || "").slice(0, 120).trim(),
    cover: { style, accent },
    createdAt: Number(raw.createdAt) || now,
    updatedAt: Number(raw.updatedAt) || now,
  };
}

export function normalizeFolder(raw = {}) {
  const color = /^#[0-9a-f]{6}$/i.test(raw.color || "") ? raw.color : FOLDER_COLORS[0];
  return {
    id: String(raw.id || uid()),
    name: String(raw.name || "").slice(0, 80).trim() || "Untitled folder",
    color,
    createdAt: Number(raw.createdAt) || Date.now(),
  };
}

export function coverVars(book) {
  const cover = book?.cover || {};
  if (cover.accent) return `--cover:${cover.accent}`;
  return "";
}

export function moodLabel(id) {
  return MOODS.find((mood) => mood.id === id)?.label || "";
}
