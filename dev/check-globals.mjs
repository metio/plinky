// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Confines platform globals to the adapters that own them. dependency-cruiser guards
// the import graph, but a browser global like `localStorage` is a bare identifier, not
// an import, so it needs its own check: every side-effecting capability lives behind a
// port whose sole browser implementation is one adapter, and no other module may reach
// for the global directly. This is what keeps core/ pure and the app testable with
// fakes. Add a global here as each port lands (audio, MIDI, …).

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Each confined global maps to the files allowed to name it. Test files are always
// allowed — they exercise the real thing on purpose.
const CONFINED = {
    localStorage: ["app/adapters/browserStore.ts", "app/lib/deniedStorage.ts"],
};

function walk(dir) {
    const out = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "paraglide" || entry.name === "__screenshots__") {
            continue;
        }
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
            out.push(...walk(path));
        } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|stories)\./.test(entry.name)) {
            out.push(path);
        }
    }
    return out;
}

// Strip comments and string literals so a global named only in prose or a message key
// does not count as a use.
function code(src) {
    return src
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/[^\n]*/g, "")
        .replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g, '""');
}

const violations = [];
const sources = [...walk("app"), ...walk("core")];
for (const global of Object.keys(CONFINED)) {
    const allowed = new Set(CONFINED[global]);
    const re = new RegExp(`\\b${global}\\b`);
    for (const file of sources) {
        if (allowed.has(file)) {
            continue;
        }
        if (re.test(code(readFileSync(file, "utf8")))) {
            violations.push(`${file} references \`${global}\` directly — use the port/adapter instead`);
        }
    }
}

if (violations.length > 0) {
    console.error("Confined-global violations:\n" + violations.map((v) => `  ${v}`).join("\n"));
    process.exit(1);
}
console.log(`check-globals: ${Object.keys(CONFINED).join(", ")} confined to their adapters.`);
