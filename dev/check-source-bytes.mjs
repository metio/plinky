// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Refuses a control byte in tracked source.
//
// A single NUL is enough to make git call a file binary, and a binary file has no
// diff: `git show` reports "Bin 7582 -> 8837 bytes, 0 insertions(+), 0 deletions(-)"
// and prints nothing. Every review of that file, here and on GitHub, silently shows
// no changes — which is how core/assignmentReport.ts carried a raw NUL as a map-key
// separator from the commit that created it, through every review since, until a
// merge summary happened to name it.
//
// Nothing else catches this. A control byte is valid TypeScript inside a string or
// template literal, so tsc, biome, the tests and typos all pass over it, and the code
// does what it looks like it does — the cost is paid by whoever next tries to read a
// diff, not by the run.
//
// Tab, newline and carriage return are how text files are shaped. Everything else in
// the C0 range, plus DEL, is a byte no one types on purpose.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Formats whose bytes are their content: scores, screenshots, icons, fonts.
const BINARY = new Set([
    "mxl",
    "png",
    "webp",
    "ico",
    "woff",
    "woff2",
    "ttf",
    "otf",
    "mp4",
    "webm",
    "gz",
    "zip",
]);

// Naming control characters IS the job here. This gate exists to find them in tracked
// source, so the rule's usual advice — you probably did not mean to match these — is
// exactly backwards for this one line.
// biome-ignore lint/suspicious/noControlCharactersInRegex: finding these is the point
const FORBIDDEN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

// What the byte is called, so the report names it rather than printing it.
function nameOf(code) {
    const names = { 0: "NUL", 7: "BEL", 8: "BS", 11: "VT", 12: "FF", 27: "ESC", 127: "DEL" };
    return names[code] ?? `0x${code.toString(16).padStart(2, "0")}`;
}

const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
    .split("\0")
    .filter(Boolean)
    .filter((path) => !BINARY.has(path.split(".").pop()?.toLowerCase() ?? ""));

const problems = [];
for (const path of files) {
    const text = readFileSync(path, "latin1");
    if (!FORBIDDEN.test(text)) {
        continue;
    }
    // Report every offender in the file, located the way an editor would.
    let line = 1;
    let column = 1;
    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        if (text[i] === "\n") {
            line++;
            column = 1;
            continue;
        }
        if (FORBIDDEN.test(text[i])) {
            problems.push(`${path}:${line}:${column} — ${nameOf(code)}`);
        }
        column++;
    }
}

if (problems.length > 0) {
    console.error(
        `Control bytes in tracked source (git renders these files as binary, so their diffs are empty):\n- ${problems.join("\n- ")}\n\nWrite the character as an escape (\\u0000) rather than the byte itself, or add the format to BINARY in dev/check-source-bytes.mjs if its bytes really are its content.`,
    );
    process.exit(1);
}

console.log(`No control bytes in ${files.length} tracked source files.`);
