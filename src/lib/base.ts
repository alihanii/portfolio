/** Set when the site is served from a sub-path, e.g. "/portfolio" on GitHub Pages. */
export const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const asset = (path: string) => (path.startsWith("/") ? BASE + path : path);
