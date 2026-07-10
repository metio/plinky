// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Rejects class names that Tailwind would silently ignore. An unknown utility
// (`max-w-xxl`) compiles to nothing, so the element just renders unstyled —
// a bug no other gate can see. The check compiles every candidate against the
// real app/app.css design system, so everything the stylesheet defines —
// @theme tokens, @custom-variant dark, @utility rules — is recognized, and
// plain component classes declared in app.css (`.no-scrollbar`) are collected
// from its selectors and allowed automatically.
//
// Extraction is heuristic because a class list is just a string: any literal
// sitting directly in a className/class attribute is validated strictly, and
// any other string literal is treated as a class list only when a clear
// majority of its tokens already compile — so a variable like
// `well = "mx-auto w-full max-w-xxl"` is caught, while prose, aria labels and
// route paths (few or no valid tokens) are never inspected.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { __unstable__loadDesignSystem } from "@tailwindcss/node";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cssPath = join(root, "app", "app.css");
const css = readFileSync(cssPath, "utf8");
const designSystem = await __unstable__loadDesignSystem(css, { base: dirname(cssPath) });

// Class selectors declared in our own stylesheet are legitimate by definition.
const ownClasses = new Set([...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((hit) => hit[1]));

// Marker classes that Tailwind consumes via variants but that compile to no
// CSS of their own.
const MARKERS = /^(?:group|peer)(?:\/[\w-]+)?$/;

const known = new Map();
function isKnown(token) {
    if (MARKERS.test(token) || ownClasses.has(token)) {
        return true;
    }
    // A parent-relative token (`dark:bg-x` under `group-hover:` etc.) still ends
    // in a plain class; strip nothing — candidatesToCss handles full candidates.
    let hit = known.get(token);
    if (hit === undefined) {
        try {
            hit = designSystem.candidatesToCss([token])[0] !== null;
        } catch {
            hit = false;
        }
        known.set(token, hit);
    }
    return hit;
}

function walk(dir) {
    const out = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "paraglide" || entry.name === "__screenshots__") {
            continue;
        }
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
            out.push(...walk(path));
        } else if (/\.(ts|tsx)$/.test(entry.name)) {
            out.push(path);
        }
    }
    return out;
}

// Pull every string literal out of a source text, tagging each with its offset
// and whether it sits directly in a className/class attribute. Template
// literals contribute their static chunks; a chunk edge that abuts a `${…}`
// interpolation has its partial edge token dropped, because `w-${size}`
// deliberately composes a class the static text alone can't name.
function literals(src) {
    const out = [];
    const re =
        /\/\*[\s\S]*?\*\/|\/\/[^\n]*|"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\$]|\\.|\$(?!\{))*(?:\$\{(?:[^{}]|\{[^{}]*\})*\}(?:[^`\\$]|\\.|\$(?!\{))*)*)`/g;
    for (const hit of src.matchAll(re)) {
        if (hit[0].startsWith("/")) {
            continue;
        }
        const inAttribute = /(?:className|class)\s*=\s*\{?\s*$/.test(src.slice(0, hit.index));
        if (hit[3] !== undefined) {
            // Template literal: emit each static chunk, trimming edge tokens
            // that an interpolation would complete.
            const parts = hit[3].split(/\$\{(?:[^{}]|\{[^{}]*\})*\}/);
            for (let i = 0; i < parts.length; i++) {
                let text = parts[i];
                if (i > 0 && !/^\s/.test(text)) {
                    text = text.replace(/^\S+/, "");
                }
                if (i < parts.length - 1 && !/\s$/.test(text)) {
                    text = text.replace(/\S+$/, "");
                }
                out.push({ text, offset: hit.index, inAttribute });
            }
        } else {
            out.push({ text: hit[1] ?? hit[2], offset: hit.index, inAttribute });
        }
    }
    return out;
}

const failures = [];
for (const file of [...walk(join(root, "app")), ...walk(join(root, "core"))]) {
    const src = readFileSync(file, "utf8");
    for (const { text, offset, inAttribute } of literals(src)) {
        const tokens = text.split(/\s+/).filter(Boolean);
        if (tokens.length === 0) {
            continue;
        }
        const unknown = tokens.filter((token) => !isKnown(token));
        const majorityKnown = tokens.length - unknown.length > tokens.length / 2;
        // Attributes are validated outright; loose literals only when they are
        // recognizably class lists (two-plus tokens, mostly valid already).
        const classList = inAttribute || (tokens.length >= 2 && majorityKnown);
        if (classList && unknown.length > 0) {
            const line = src.slice(0, offset).split("\n").length;
            failures.push(`${file.slice(root.length + 1)}:${line} unknown class ${unknown.join(", ")}`);
        }
    }
}

if (failures.length > 0) {
    console.error(`check-tailwind: ${failures.length} unknown Tailwind class name(s):`);
    for (const failure of failures) {
        console.error(`  ${failure}`);
    }
    process.exit(1);
}
console.log("check-tailwind: every class name compiles.");
