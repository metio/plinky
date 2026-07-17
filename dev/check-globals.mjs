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
    // Scheduling globals belong to the Scheduler adapter, so every behavioural
    // timer/interval/animation-frame runs through the injected capability and a
    // test can drive time by hand (see app/ports/scheduler.ts). The allow-list is
    // the genuine lower-level owners: the browser adapter itself; the SSR render
    // timeout (Node, not the browser); the sw-update watcher's own injected timer
    // env and the composition root that wires it; the mic adapter's audio-frame
    // loop; the two imperative DOM one-liners (blob-URL revoke, print cleanup);
    // and the pure UI primitives (ui-is-pure keeps them out of the services
    // context, so a purely-cosmetic transition — a wrong-note flash, a value
    // bump, a slide-in — owns its own timer instead of the Scheduler).
    setTimeout: [
        "app/adapters/browserScheduler.ts",
        "app/entry.server.tsx",
        "app/root.tsx",
        "app/lib/swUpdate.ts",
        "app/lib/download.ts",
        "app/lib/printScore.ts",
        "app/components/ui/keyboard.tsx",
        "app/components/ui/stepper.tsx",
    ],
    clearTimeout: [
        "app/adapters/browserScheduler.ts",
        "app/entry.server.tsx",
        "app/root.tsx",
        "app/lib/swUpdate.ts",
        "app/components/ui/keyboard.tsx",
        "app/components/ui/stepper.tsx",
    ],
    setInterval: ["app/adapters/browserScheduler.ts"],
    clearInterval: ["app/adapters/browserScheduler.ts"],
    requestAnimationFrame: [
        "app/adapters/browserScheduler.ts",
        "app/adapters/micPitch.ts",
        "app/components/ui/drawer.tsx",
    ],
    cancelAnimationFrame: [
        "app/adapters/browserScheduler.ts",
        "app/adapters/micPitch.ts",
        "app/components/ui/drawer.tsx",
    ],
};

// The ambient sources core/ may never read. These are not confined to an adapter the
// way `localStorage` is — the layers above core legitimately read the clock and reach
// for randomness at the point a run actually happens. The invariant is narrower and
// belongs to core alone: a pure function is deterministic, so time and randomness
// arrive as parameters (`now: number`, `rng: () => number`) rather than being read
// from the environment. A default parameter value is the tempting way to smuggle one
// back in, which is precisely what this catches: a caller that omits the argument
// silently binds core to the ambient clock, and every test of it inherits today's date.
//
// Date arithmetic is not a clock read: `new Date(dateKey)` derives a date from an
// explicit argument and stays deterministic, so only the zero-argument form is banned.
const CORE_BANNED = [
    { name: "Math.random", pattern: /\bMath\.random\b/, hint: "take an `rng: () => number` parameter" },
    { name: "Date.now", pattern: /\bDate\.now\b/, hint: "take a `now: number` parameter" },
    { name: "new Date()", pattern: /\bnew Date\(\s*\)/, hint: "take a `now: Date` parameter" },
];

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

for (const [file, source] of stripped) {
    if (!file.startsWith("core")) {
        continue;
    }
    for (const { name, pattern, hint } of CORE_BANNED) {
        if (pattern.test(source)) {
            violations.push(`${file} reads \`${name}\` — core is pure: ${hint}`);
        }
    }
}

if (violations.length > 0) {
    console.error("Confined-global violations:\n" + violations.map((v) => `  ${v}`).join("\n"));
    process.exit(1);
}
console.log(`check-globals: ${Object.keys(CONFINED).join(", ")} confined to their adapters.`);
console.log("check-globals: core/ reads no clock and no randomness.");
