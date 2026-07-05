// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Navigation-depth guardrail. Models the app as a directed graph — nodes are pages,
// edges are the one-tap navigations a page renders (every <Link to>, navigate() and
// localizeHref target, found by crawling each route's transitive component imports) —
// plus the global affordances (the bottom-tab/header nav and the header gear/logo) that
// every page carries. Then it BFS-measures:
//   • eccentricity from home — the worst-case taps to reach any feature from "/", and
//   • diameter — the worst-case taps between any two features.
// A new feature that buries something deeper than the budget fails the build, the same
// way the bundle-size and a11y gates catch their regressions. Pair with human review:
// this catches burial, not discoverability or per-page clutter.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const APP = "app";

// How many taps from home is acceptable to reach any feature. A ratchet: tighten it as
// the IA improves; a change that pushes a feature deeper trips the build instead.
const BUDGET_FROM_HOME = 2;

// --- Parse routes.ts → the page nodes (path + module file) ------------------------

const routesSrc = readFileSync(join(APP, "routes.ts"), "utf8");
// Pages live inside the `route(":locale", layout, [ … ])` block; the bare top-level
// index is only a client redirect, so it isn't a destination.
const localeBlock = routesSrc.match(/route\(":locale",[^[]*\[([\s\S]*?)\]\s*\)/)?.[1] ?? "";
const pages = [];
const homeIndex = localeBlock.match(/index\("([^"]+)"\)/);
if (homeIndex) {
    pages.push({ path: "/", file: homeIndex[1] });
}
for (const m of localeBlock.matchAll(/route\("([^"]+)",\s*"([^"]+)"/g)) {
    pages.push({ path: `/${m[1]}`, file: m[2] });
}
const NODE_PATHS = pages.map((p) => p.path);

// --- Crawl a file (and its local component imports) for navigation targets ---------

function resolveLocal(dir, spec) {
    const base = resolve(dir, spec);
    for (const ext of [".tsx", ".ts", ".mjs", "/index.tsx", "/index.ts"]) {
        if (existsSync(base + ext)) {
            return base + ext;
        }
    }
    return existsSync(base) ? base : null;
}

// Every absolute path a `to`/navigate/localizeHref points at in a file.
function targetsIn(src) {
    const found = new Set();
    const add = (value) => {
        if (value?.startsWith("/")) {
            found.add(value);
        }
    };
    // JSX attribute: to="/x", to={"/x"}, to={`/x/${id}`} (static prefix before ${)
    for (const m of src.matchAll(/\bto=(?:"([^"]+)"|\{"([^"]+)"\}|\{`([^`$]*))/g)) {
        add(m[1] ?? m[2] ?? m[3]);
    }
    // Object property: { to: "/x" } (nav destination tables, discovery steps)
    for (const m of src.matchAll(/\bto:\s*"([^"]+)"/g)) {
        add(m[1]);
    }
    for (const m of src.matchAll(/(?:navigate|localizeHref)\((?:"([^"]+)"|`([^`$]*))/g)) {
        add(m[1] ?? m[2]);
    }
    return found;
}

function crawl(absPath, seen) {
    if (!absPath || seen.has(absPath) || !existsSync(absPath)) {
        return new Set();
    }
    seen.add(absPath);
    const src = readFileSync(absPath, "utf8");
    const targets = targetsIn(src);
    for (const m of src.matchAll(/from\s+"(\.[^"]+)"/g)) {
        const resolved = resolveLocal(dirname(absPath), m[1]);
        if (resolved) {
            for (const t of crawl(resolved, seen)) {
                targets.add(t);
            }
        }
    }
    return targets;
}

// Map a concrete link target to the page node it lands on (longest match; dynamic
// segments like /play/:scoreId match by their static prefix).
function toNode(target) {
    if (NODE_PATHS.includes(target)) {
        return target;
    }
    for (const np of NODE_PATHS) {
        if (np.includes("/:")) {
            const prefix = np.slice(0, np.indexOf("/:"));
            if (target === prefix || target.startsWith(`${prefix}/`)) {
                return np;
            }
        }
    }
    let best = null;
    for (const np of NODE_PATHS) {
        if (!np.includes("/:") && (target === np || target.startsWith(`${np}/`))) {
            if (!best || np.length > best.length) {
                best = np;
            }
        }
    }
    return best;
}

const nodesFor = (targets) => new Set([...targets].map(toNode).filter(Boolean));

// --- Build the graph ---------------------------------------------------------------

// Affordances present on every page: the bottom-tab/header nav (navBar) plus the
// header's own gear and logo (root.tsx's direct links).
const global = nodesFor(
    new Set([
        ...crawl(resolve(APP, "components/ui/navBar.tsx"), new Set()),
        ...targetsIn(readFileSync(resolve(APP, "root.tsx"), "utf8")),
    ]),
);

const edges = new Map();
for (const page of pages) {
    const reached = nodesFor(crawl(resolve(APP, page.file), new Set()));
    for (const g of global) {
        reached.add(g);
    }
    reached.delete(page.path);
    edges.set(page.path, reached);
}

// --- BFS, eccentricity, diameter ---------------------------------------------------

function bfs(start) {
    const dist = new Map([[start, 0]]);
    const queue = [start];
    while (queue.length > 0) {
        const cur = queue.shift();
        for (const next of edges.get(cur) ?? []) {
            if (!dist.has(next)) {
                dist.set(next, dist.get(cur) + 1);
                queue.push(next);
            }
        }
    }
    return dist;
}

const fromHome = bfs("/");
const unreachable = pages.filter((p) => !fromHome.has(p.path));
const eccentricity = Math.max(...pages.map((p) => fromHome.get(p.path) ?? Number.POSITIVE_INFINITY));

let diameter = 0;
for (const p of pages) {
    const dist = bfs(p.path);
    for (const q of pages) {
        if (dist.has(q.path)) {
            diameter = Math.max(diameter, dist.get(q.path));
        }
    }
}

// --- Report ------------------------------------------------------------------------

console.log("Navigation depth (taps from home):");
for (const p of [...pages].sort((a, b) => (fromHome.get(b.path) ?? 99) - (fromHome.get(a.path) ?? 99))) {
    const d = fromHome.get(p.path);
    console.log(`  ${d === undefined ? "∞" : d}  ${p.path}`);
}
console.log(
    `\nEccentricity from home: ${eccentricity} · diameter: ${diameter} ` +
        `(budget: ≤ ${BUDGET_FROM_HOME} from home)`,
);

const problems = [];
if (unreachable.length > 0) {
    problems.push(`unreachable from home: ${unreachable.map((p) => p.path).join(", ")}`);
}
if (Number.isFinite(eccentricity) && eccentricity > BUDGET_FROM_HOME) {
    problems.push(`a feature is ${eccentricity} taps from home, over the ${BUDGET_FROM_HOME} budget`);
}
if (problems.length > 0) {
    console.error(
        `\nNavigation too deep:\n- ${problems.join("\n- ")}\n` +
            "Add a link from a shallower page (or the global nav), or raise the budget in " +
            "dev/nav-graph.mjs deliberately.",
    );
    process.exitCode = 1;
} else {
    console.log("\nNavigation within budget.");
}
