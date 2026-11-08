/* global document, getComputedStyle */
// DEVELOPMENT ONLY (see fixture.ts). The same screen drawn at two desktop widths must have the same structure: the same visible
// parts, each with the same kind of box (display, alignment, list style, grid columns, type, colour). A rule that only applies at
// some widths (an unclosed @media block once did) shows up as a difference. Sizes and positions are left out: they are meant to move.

/** Runs in the page: one entry per visible element, in document order, with the width-independent look of each. */
export function collect() {
  const PROPS = [
    "display", "textAlign", "listStyleType", "flexDirection", "flexWrap", "justifyContent", "alignItems", "fontSize", "fontWeight",
    "fontStyle", "textDecorationLine", "textTransform", "borderTopLeftRadius", "backgroundColor", "color", "opacity", "textOverflow",
  ];
  const out = [];
  const seen = new Map();
  for (const el of document.querySelectorAll("#root *")) {
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    if (style.display === "none" || style.visibility === "hidden" || rect.width === 0 || rect.height === 0) continue;
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(" ").slice(0, 28);
    const role = el.getAttribute("role") ?? "";
    const base = `${el.tagName.toLowerCase()}${role ? `[${role}]` : ""}.${[...el.classList].join(".")}${own ? ` "${own}"` : ""}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    const look = Object.fromEntries(PROPS.map((p) => [p, style[p]]));
    if (style.display.includes("grid")) look.gridColumns = String(style.gridTemplateColumns.split(" ").length);
    out.push({ key: `${base} #${n}`, look });
  }
  return out;
}

/** The differences between two collections, as lines; each line names the element and the property. */
export function diffStructure(narrow, wide, labels = ["narrow", "wide"]) {
  const lines = [];
  const w = new Map(wide.map((e) => [e.key, e.look]));
  const n = new Map(narrow.map((e) => [e.key, e.look]));
  for (const [key, look] of n) {
    const other = w.get(key);
    if (!other) {
      lines.push(`${key}: only at ${labels[0]}`);
      continue;
    }
    for (const prop of Object.keys(look)) if (look[prop] !== other[prop]) lines.push(`${key}: ${prop} is ${look[prop]} at ${labels[0]} and ${other[prop]} at ${labels[1]}`);
  }
  for (const key of w.keys()) if (!n.has(key)) lines.push(`${key}: only at ${labels[1]}`);
  return lines;
}

/** The lines no allowance covers. An allowance is a substring of a line, with the reason the screen is meant to differ. */
export function unexplained(lines, allowed) {
  return lines.filter((line) => !allowed.some((a) => line.includes(a.match)));
}
