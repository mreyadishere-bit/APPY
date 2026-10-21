/* ============================================================
   APPY — router
   Hash routes, one mounted view at a time, and a clean teardown
   so nothing keeps listening after its screen is gone.
   ============================================================ */

const DEFAULT_TITLES = {
  home: "APPY",
  library: "Library",
  book: "Book",
  folder: "Folder",
  day: "Day",
  write: "Writing",
  read: "Reading",
  search: "Search",
  trash: "Trash",
  settings: "Settings",
};

export function parseHash(hash = location.hash) {
  const raw = hash.replace(/^#/, "") || "/";
  const [pathPart, queryPart] = raw.split("?");
  const segments = pathPart
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    });

  const [head, ...rest] = segments;
  return {
    name: head || "home",
    params: rest,
    query: Object.fromEntries(new URLSearchParams(queryPart || "")),
    path: pathPart || "/",
    segments,
  };
}

export function navigate(path, { replace = false } = {}) {
  const target = `#${path.startsWith("/") ? path : `/${path}`}`;
  if (replace) {
    history.replaceState(null, "", target);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else {
    location.hash = target;
  }
}

export function href(path) {
  return `#${path.startsWith("/") ? path : `/${path}`}`;
}

export function createRouter({ routes, fallback, mount, onRoute }) {
  let current = null;
  let token = 0;

  async function render() {
    const route = parseHash();
    const handler = routes[route.name] || fallback;
    if (!handler) return;

    const ticket = ++token;

    try {
      current?.destroy?.();
    } catch (error) {
      console.error("APPY teardown failed", error);
    }
    current = null;

    mount.replaceChildren();
    mount.classList.remove("view-enter");
    document.body.dataset.route = route.name;

    let result;
    try {
      result = await handler(route);
    } catch (error) {
      console.error("APPY view failed", error);
      result = null;
    }

    if (ticket !== token) {
      try {
        result?.destroy?.();
      } catch {
        /* the view never mounted */
      }
      return;
    }

    if (result) {
      mount.append(result.root);
      current = result;
      // Paint the frame, then animate in.
      void mount.offsetWidth;
      mount.classList.add("view-enter");
    }

    document.title = result?.title
      ? `${result.title} — APPY`
      : route.name === "home"
        ? "APPY — a diary kept in books"
        : `${DEFAULT_TITLES[route.name] || "APPY"} — APPY`;

    onRoute?.(route, result);

    window.scrollTo({ top: 0, behavior: "auto" });
    if (route.name !== "read") {
      mount.focus({ preventScroll: true });
    }
  }

  window.addEventListener("hashchange", render);
  return { render };
}
