#!/usr/bin/env node
/*
 * Copies the built Quest UI CSS into the sites that use it, so a change to tokens.json reaches them with
 * one command.
 *
 *   npm run sync                          builds the tokens (contrast check included), then copies them
 *   npm run sync -- ../my-site/src/styles  copies into other folders instead
 *
 * By default it copies into the portfolio and Quest Town, which sit next to this repo. A folder that
 * doesn't exist is skipped. Nothing is committed: review the changes in each site and push them there.
 */

import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILES = [
  ["tokens/quest-ui.css", "quest-ui.css"],
  ["css/components.css", "components.css"],
];
const DEFAULT_TARGETS = ["../Portfolio/src/styles", "../mini-island/src/styles"];

const args = process.argv.slice(2);
const targets = (args.length ? args : DEFAULT_TARGETS).map((t) => resolve(ROOT, t));
const { version } = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const banner = `/* Quest UI ${version}, copied here by \`npm run sync\` in the quest-ui repo. Don't edit this copy: change quest-ui and sync again. */\n`;

let changed = 0;
for (const dir of targets) {
  const shown = relative(ROOT, dir).replace(/\\/g, "/") || ".";
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    console.log(`skipped  ${shown} (folder not found)`);
    continue;
  }
  for (const [from, to] of FILES) {
    const out = join(dir, to);
    const next = banner + readFileSync(join(ROOT, from), "utf8");
    const prev = existsSync(out) ? readFileSync(out, "utf8").replace(/\r\n/g, "\n") : null;
    if (prev === next) {
      console.log(`same     ${shown}/${to}`);
      continue;
    }
    writeFileSync(out, next);
    changed++;
    console.log(`${prev === null ? "added  " : "updated"}  ${shown}/${to}`);
  }
}
console.log(changed ? `\n${changed} file(s) changed. Review them in each site, then commit there.` : "\nEverything was already up to date.");
