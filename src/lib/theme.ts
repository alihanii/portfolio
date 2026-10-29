export const accents = [
  { name: "Red room", value: "#ef3b2d" },
  { name: "Ember", value: "#ff7a1a" },
  { name: "Gold", value: "#f2b632" },
  { name: "Violet", value: "#8b5cf6" },
  { name: "Cyan", value: "#22c7e6" },
  { name: "Emerald", value: "#10b981" },
] as const;

export const STORAGE = { theme: "ah-theme", accent: "ah-accent", lang: "ah-lang", resume: "ah-resume-pos" } as const;

export function hexToRgb(hex: string) {
  const m = hex.replace("#", "").match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return null;
  return `${parseInt(m[1], 16)} ${parseInt(m[2], 16)} ${parseInt(m[3], 16)}`;
}

export function applyAccent(hex: string) {
  const rgb = hexToRgb(hex);
  if (!rgb) return;
  const root = document.documentElement.style;
  root.setProperty("--accent", hex);
  root.setProperty("--accent-rgb", rgb);
}

export function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

export function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/* Runs inline in <head> so the saved theme and accent apply before first paint. */
export const bootScript = `(function(){try{var d=document.documentElement;localStorage.removeItem("${STORAGE.theme}");var a=localStorage.getItem("${STORAGE.accent}");if(a&&/^#[0-9a-f]{6}$/i.test(a)){d.style.setProperty("--accent",a);d.style.setProperty("--accent-rgb",parseInt(a.substr(1,2),16)+" "+parseInt(a.substr(3,2),16)+" "+parseInt(a.substr(5,2),16));}}catch(e){}})();`;
