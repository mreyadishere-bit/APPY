/* ============================================================
   APPY — first run
   One clearly-labelled guide book, so the reading room can be
   felt before a single word has been written. It is ordinary
   data: editable, exportable, deletable.
   ============================================================ */

import { db } from "./db.js";
import * as store from "./store.js";
import { isoOf } from "./model.js";

const WELCOME = [
  {
    title: "A quiet place for your days",
    body: `
      <p>This is APPY, a diary that lives entirely in this browser. Nothing you write is sent anywhere, and there is no account to make.</p>
      <p>Your writing is stored on this device. That is the whole promise, and the whole responsibility: if you clear your browser data, the diary goes with it. <strong>Settings → Export a backup</strong> makes a file you can keep.</p>
    `,
  },
  {
    title: "Books, folders, and where things belong",
    body: `
      <p>Every entry belongs to a <strong>book</strong> — the diary you are writing in. Books have their own covers, their own names, and their own reading room.</p>
      <p><strong>Folders</strong> are for subjects that cross books: Travel, Dreams, Studies, the people you keep thinking about. An entry always lives in one book, and can sit in one folder at a time. Move it whenever you change your mind.</p>
    `,
  },
  {
    title: "Then open the book",
    body: `
      <p>When a book has a few entries, press <strong>Read</strong>. The cover swings open and your days become pages you can turn.</p>
      <p>Use the arrow keys, or swipe. Press <strong>T</strong> for the contents and <strong>F</strong> for full screen. If you would rather read plainly, switch to the list — the words are exactly the same.</p>
      <p>This book is a guide, not your diary. Open its settings and delete it whenever you like.</p>
    `,
  },
];

export async function seedWelcome() {
  const welcomed = await db.getMeta("welcomed", false);
  if (welcomed) return false;

  const [books, entries] = await Promise.all([db.getAll("books"), db.getAll("entries")]);
  if (books.length || entries.length) {
    await db.setMeta("welcomed", true);
    return false;
  }

  const book = await store.createBook({
    title: "Welcome",
    subtitle: "A short tour of APPY",
    cover: { style: "cloth", accent: "#3f4f5c" },
  });

  const now = Date.now();

  for (let index = 0; index < WELCOME.length; index += 1) {
    const item = WELCOME[index];
    const day = new Date();
    day.setDate(day.getDate() - (WELCOME.length - 1 - index));

    await store.saveEntry(
      {
        bookId: book.id,
        folderId: null,
        title: item.title,
        body: item.body.trim(),
        date: isoOf(day),
        createdAt: now + index,
        updatedAt: now + index,
      },
      { silent: true }
    );
  }

  await db.setMeta("welcomed", true);
  return true;
}
