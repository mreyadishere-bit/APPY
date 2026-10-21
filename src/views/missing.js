import { esc, h } from "../ui/dom.js";
import { pageHead } from "../ui/shell.js";

export function missingView({
  title = "Not found",
  message = "This page does not exist, or it was moved.",
  back = "/",
  backLabel = "Back home",
} = {}) {
  const root = h("div");
  root.innerHTML = `
    ${pageHead({ eyebrow: "Lost page", title })}
    <div class="empty">
      <p>${esc(message)}</p>
      <div class="empty-actions">
        <a class="btn btn--primary" href="#${esc(back)}">${esc(backLabel)}</a>
        <a class="btn" href="#/search">Search the diary</a>
      </div>
    </div>
  `;
  return { root, title };
}
