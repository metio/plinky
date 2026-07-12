// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Confines platform globals to the adapters that own them. dependency-cruiser guards
// the import graph, but a browser global like `localStorage` is a bare identifier, not
// an import, so it needs its own check: every side-effecting capability lives behind a
// port whose sole browser implementation is one adapter, and no other module may reach
// for the global directly. This is what keeps core/ pure and the app testable with
// fakes. Add a global here as each port lands (audio, MIDI, …).

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Each confined global maps to the files allowed to name it. Test files are always
// allowed — they exercise the real thing on purpose.
const CONFINED = {
    localStorage: ["app/adapters/browserStore.ts", "app/testing/deniedStorage.ts"],
    DOMParser: ["app/adapters/domXmlCodec.ts"],
    XMLSerializer: ["app/adapters/domXmlCodec.ts"],
    requestMIDIAccess: ["app/adapters/webMidi.ts"],
    AudioContext: ["app/adapters/webAudioEngine.ts", "app/adapters/micPitch.ts"],
    OfflineAudioContext: ["app/adapters/offlineAudio.ts"],
    VideoEncoder: ["app/adapters/webCodecsVideo.ts"],
    AudioEncoder: ["app/adapters/webCodecsVideo.ts"],
    VideoFrame: ["app/adapters/webCodecsVideo.ts"],
    AudioData: ["app/adapters/webCodecsVideo.ts"],
    OffscreenCanvas: ["app/adapters/webCodecsVideo.ts"],
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
// does not count as a use. One combined pass, ordered so each construct is consumed
// whole from its opening character: handling strings and comments in a single
// alternation keeps a `//` inside a string (an https:// URL) from being taken for a
// comment — which would swallow the string's closing quote and let the stripper eat
// real code on the following lines. Quoted strings must not cross a newline (matching
// the language), so an unterminated quote can never swallow the next line either.
// Template literals keep their `${…}` interpolations: only the literal text between
// them is blanked, because an interpolation is code that may name a confined global.
function code(src) {
    return src.replace(
        /\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\$]|\\.|\$(?!\{))*(?:\$\{(?:[^{}]|\{[^{}]*\})*\}(?:[^`\\$]|\\.|\$(?!\{))*)*`/g,
        (match) => {
            if (match.startsWith("/")) {
                return "";
            }
            if (match.startsWith("`")) {
                // Keep each interpolation's inner code; blank the literal text around it.
                const inner = [...match.matchAll(/\$\{((?:[^{}]|\{[^{}]*\})*)\}/g)]
                    .map((hit) => hit[1])
                    .join(";");
                return `(${inner})`;
            }
            return '""';
        },
    );
}

const violations = [];
const sources = [...walk("app"), ...walk("core")];
// Read and strip each source once, then test every confined global against the
// cached result — the file pass dominates the cost, not the per-global regexes.
const stripped = new Map(sources.map((file) => [file, code(readFileSync(file, "utf8"))]));
for (const global of Object.keys(CONFINED)) {
    const allowed = new Set(CONFINED[global]);
    // A stale allowlist entry would silently pre-authorize whatever file is later
    // created at that path, so a path that no longer exists fails the run.
    for (const path of allowed) {
        if (!existsSync(path)) {
            violations.push(`allowlist entry for \`${global}\` does not exist: ${path}`);
        }
    }
    const re = new RegExp(`\\b${global}\\b`);
    for (const [file, source] of stripped) {
        if (allowed.has(file)) {
            continue;
        }
        if (re.test(source)) {
            violations.push(`${file} references \`${global}\` directly — use the port/adapter instead`);
        }
    }
}

if (violations.length > 0) {
    console.error("Confined-global violations:\n" + violations.map((v) => `  ${v}`).join("\n"));
    process.exit(1);
}
console.log(`check-globals: ${Object.keys(CONFINED).join(", ")} confined to their adapters.`);
