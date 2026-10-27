#!/usr/bin/env node
/*
 * Builds tokens/quest-ui.css from tokens/tokens.json.
 *
 * - Every token becomes a CSS custom property named --qu-<path>. The first group is dropped when it is
 *   only a grouping word (color, role, motion), so color.coral.500 is --qu-coral-500 and
 *   role.text.heading is --qu-text-heading.
 * - A token that points at another token ({color.navy.900}) becomes var(--qu-navy-900), so changing a
 *   colour in one place changes everything that uses it.
 * - Text styles (the "type" group) become .qu-type-* classes.
 * - Before writing anything, the colour pairs listed under $extensions.quest-ui.contrast are checked
 *   against WCAG 2.2. If one falls short, nothing is written and the build fails.
 * - It also writes site/tokens-data.js, the same tokens and contrast results for the documentation site,
 *   so the site always shows what tokens.json says.
 *
 * No dependencies: run it with `npm run tokens` or `node scripts/build-tokens.mjs`.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "tokens", "tokens.json");
const OUT = join(ROOT, "tokens", "quest-ui.css");
const SITE_OUT = join(ROOT, "site", "tokens-data.js");
const PREFIX = "qu";
const GROUPING_WORDS = new Set(["color", "role", "motion"]);
const GENERIC_FONTS = new Set(["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "-apple-system", "ui-sans-serif", "ui-serif", "ui-monospace"]);

const tree = JSON.parse(readFileSync(SRC, "utf8"));
const settings = tree.$extensions?.["quest-ui"] ?? {};

/* ---------- read every token ---------- */

const tokens = new Map(); // "color.coral.500" -> { path, type, value, description, ext }
(function walk(node, path, inheritedType) {
  const type = node.$type ?? inheritedType;
  if ("$value" in node) {
    tokens.set(path.join("."), { path, type, value: node.$value, description: node.$description, ext: node.$extensions?.["quest-ui"] });
    return;
  }
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith("$") || child === null || typeof child !== "object") continue;
    walk(child, [...path, key], type);
  }
})(tree, [], undefined);

const REF = /^\{([^}]+)\}$/;
const refOf = (v) => (typeof v === "string" ? v.match(REF)?.[1] : undefined);

/** the final value of a token, following references all the way down */
function resolve(value, seen = []) {
  const ref = refOf(value);
  if (ref) {
    if (seen.includes(ref)) throw new Error(`Circular reference: ${[...seen, ref].join(" -> ")}`);
    const target = tokens.get(ref);
    if (!target) throw new Error(`Unknown reference {${ref}}`);
    return resolve(target.value, [...seen, ref]);
  }
  if (Array.isArray(value)) return value.map((v) => resolve(v, seen));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolve(v, seen)]));
  return value;
}

const cssName = (path) => `--${PREFIX}-${path.filter((seg, i) => !(i === 0 && GROUPING_WORDS.has(seg))).join("-")}`;

/** a token's value as CSS: a reference stays a reference, so it follows the token it points at */
function cssValue(value, type) {
  const ref = refOf(value);
  if (ref) {
    if (!tokens.has(ref)) throw new Error(`Unknown reference {${ref}}`);
    return `var(${cssName(tokens.get(ref).path)})`;
  }
  switch (type) {
    case "fontFamily":
      return (Array.isArray(value) ? value : [value]).map((f) => (GENERIC_FONTS.has(f) || !/\s/.test(f) ? f : `"${f}"`)).join(", ");
    case "cubicBezier":
      return `cubic-bezier(${value.join(", ")})`;
    case "shadow":
      return (Array.isArray(value) ? value : [value])
        .map((s) => [s.inset ? "inset" : "", cssValue(s.offsetX, "dimension"), cssValue(s.offsetY, "dimension"), cssValue(s.blur, "dimension"), cssValue(s.spread ?? "0px", "dimension"), cssValue(s.color, "color")].filter(Boolean).join(" "))
        .join(", ");
    default:
      return String(value);
  }
}

/* ---------- check colour contrast (WCAG 2.2) ---------- */

function rgba(hex) {
  let h = String(hex).replace("#", "");
  if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(h)) throw new Error(`Not a hex colour: ${hex}`);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
  return { r, g, b, a };
}
const over = (top, bottom) => ({
  r: top.r * top.a + bottom.r * (1 - top.a),
  g: top.g * top.a + bottom.g * (1 - top.a),
  b: top.b * top.a + bottom.b * (1 - top.a),
  a: 1,
});
const luminance = ({ r, g, b }) => {
  const ch = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const colourOf = (path) => {
  if (!tokens.has(path)) throw new Error(`Contrast check names an unknown token: ${path}`);
  return rgba(resolve(tokens.get(path).value));
};

const pairs = settings.contrast?.pairs ?? [];
const failures = [];
const checked = pairs.map((p) => {
  let bg = colourOf(p.on);
  if (bg.a < 1) bg = over(bg, p.over ? colourOf(p.over) : { r: 255, g: 255, b: 255, a: 1 });
  let fg = colourOf(p.text);
  if (fg.a < 1) fg = over(fg, bg);
  const ratio = contrast(fg, bg);
  const pass = ratio >= p.min;
  if (!pass) failures.push(p);
  const varOf = (path) => cssName(tokens.get(path).path);
  return { ...p, ratio: Math.round(ratio * 100) / 100, pass, textVar: varOf(p.text), onVar: varOf(p.on), overVar: p.over ? varOf(p.over) : null };
});
const report = checked.map(
  (c) => `  ${c.pass ? "pass" : "FAIL"}  ${c.ratio.toFixed(2).padStart(5)} (needs ${c.min})  ${c.text} on ${c.on}${c.over ? ` over ${c.over}` : ""}${c.note ? `  [${c.note}]` : ""}`,
);
console.log(`Contrast, ${pairs.length} pairs:\n${report.join("\n")}`);
if (failures.length) {
  console.error(`\n${failures.length} pair(s) fall short. Nothing was written. Fix the colours in tokens/tokens.json and run again.`);
  process.exit(1);
}

/* ---------- write the CSS ---------- */

const lines = [
  "/*",
  " * Quest UI v0 design tokens.",
  " * Generated by scripts/build-tokens.mjs from tokens/tokens.json. Do not edit by hand: change tokens.json and run `npm run tokens`.",
  " */",
  "",
  ":root {",
];
let group = "";
const textStyles = [];
const durations = [];
for (const t of tokens.values()) {
  if (t.type === "typography") {
    textStyles.push(t);
    continue;
  }
  if (t.path[0] !== group) {
    group = t.path[0];
    lines.push(`${lines.at(-1) === ":root {" ? "" : "\n"}  /* ${group} */`);
  }
  if (t.type === "duration") durations.push(t);
  const note = t.description ? ` /* ${t.description.replace(/\*\//g, "")} */` : "";
  lines.push(`  ${cssName(t.path)}: ${cssValue(t.value, t.type)};${note}`);
}
lines.push("}");

if (durations.length) {
  lines.push("", "/* People who ask their system for less motion get instant changes. */", "@media (prefers-reduced-motion: reduce) {", "  :root {");
  for (const t of durations) lines.push(`    ${cssName(t.path)}: 0ms;`);
  lines.push("  }", "}");
}

const PROPS = { fontFamily: "font-family", fontWeight: "font-weight", fontSize: "font-size", lineHeight: "line-height", letterSpacing: "letter-spacing" };
const PROP_TYPES = { fontFamily: "fontFamily", fontWeight: "fontWeight", fontSize: "dimension", lineHeight: "number", letterSpacing: "dimension" };
const desktop = settings.desktopMinWidth ?? "768px";
if (textStyles.length) lines.push("", "/* Text styles */");
for (const t of textStyles) {
  const cls = `.${PREFIX}-${t.path.join("-")}`;
  lines.push(`${cls} {`);
  for (const [key, v] of Object.entries(t.value)) {
    if (!PROPS[key]) throw new Error(`${t.path.join(".")}: unknown text style property ${key}`);
    lines.push(`  ${PROPS[key]}: ${cssValue(v, PROP_TYPES[key])};`);
  }
  if (t.ext?.textTransform) lines.push(`  text-transform: ${t.ext.textTransform};`);
  lines.push("}");
  if (t.ext?.desktop) {
    const inner = Object.entries(t.ext.desktop).map(([key, v]) => `${PROPS[key]}: ${cssValue(v, PROP_TYPES[key])};`).join(" ");
    lines.push(`@media (min-width: ${desktop}) { ${cls} { ${inner} } }`);
  }
}

writeFileSync(OUT, lines.join("\n") + "\n");

/* ---------- the same tokens for the documentation site ---------- */

const site = {
  tokens: [...tokens.values()].map((t) => ({
    path: t.path.join("."),
    name: t.type === "typography" ? `.${PREFIX}-${t.path.join("-")}` : cssName(t.path),
    type: t.type,
    value: resolve(t.value),
    ref: refOf(t.value) ? cssName(tokens.get(refOf(t.value)).path) : null,
    description: t.description ?? null,
    desktop: t.ext?.desktop ? resolve(t.ext.desktop) : null,
    textTransform: t.ext?.textTransform ?? null,
  })),
  contrast: checked,
};
mkdirSync(dirname(SITE_OUT), { recursive: true });
writeFileSync(
  SITE_OUT,
  `/* Generated by scripts/build-tokens.mjs from tokens/tokens.json for the documentation site. Do not edit by hand. */\nwindow.QUEST_UI_TOKENS = ${JSON.stringify(site, null, 2)};\n`,
);

const rel = (p) => p.slice(ROOT.length + 1).replace(/\\/g, "/");
console.log(`\nWrote ${tokens.size} tokens (${textStyles.length} text styles) to ${rel(OUT)}, and the site's copy to ${rel(SITE_OUT)}`);
