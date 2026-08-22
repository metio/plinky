// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Writes .design-sync/pkg/ — the package design-sync compiles into window.Plinky, which
// is what claude.ai/design renders every component from.
//
// A published component library would point the converter at its dist/. Plinky is a
// private application with no dist, so the entry is derived instead: every storied
// component, read out of the reference storybook's index, re-exported from the module
// that defines it. Deriving it means a component that gains a story is in the bundle on
// the next run, and one that is renamed cannot linger as a stale hand-kept line.
//
// The converter walks up from the entry for a package.json carrying a name, and the
// repo's has none (Plinky is private and unpublished), so the walk would run past it to
// the filesystem root. pkg/ is that package: a name, a types entry, and the barrel. Its
// declarations come from `npx tsc -p .design-sync/tsconfig.types.json` and land in
// .design-sync/types/ — both directories are generated, and neither is committed.
//
// Run: node .design-sync/make-entry.mjs

import { existsSync, mkdirSync, readFileSync, symlinkSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

const INDEX = ".design-sync/sb-reference/index.json";
if (!existsSync(INDEX)) {
    console.error(`[NO_INDEX] ${INDEX} — build the reference storybook first`);
    process.exit(1);
}

// Titles whose component is not the file's namesake. The story's own `component:` is the
// authority; `null` means the story renders something the bundle cannot carry — a
// component defined inside the story file, or a page of many components with no single
// one to name — so it ships no card. `config.json`'s titleMap must agree.
// An entry is a name the namesake module exports, or [name, module] when it lives
// elsewhere, or [name, module, exported] when the module names it differently — a route
// module's component is its default export.
const SPECIAL = {
    "Features/Glossary": [
        ["GlossaryDetail", "app/components/features/glossaryDetail.tsx"],
        ["GlossaryIndex", "app/components/features/glossaryIndex.tsx"],
    ],
    "Features/KeyboardThemeSwatch": ["ThemeSwatch", "KeyboardThemePicker"],
    "UI/NavBar": ["BottomNav", "HeaderNav"],
    "Routes/Theory": [["Theory", "app/routes/theory.tsx", "default"]],
    "Routes/Tools": [["Tools", "app/routes/tools.tsx", "default"]],
    "Lib/VideoFrame": null,
    "UI/Icons": null,
};

// Modules every design gets to draw from whether or not they carry a story of their own.
// The icons are the clearest case: each one is a real component, but the story that shows
// them is a sheet of all 37 with no component to name it. The three unstoried primitives
// are here because they ARE the vocabulary — a design built without Card, PageHeader and
// EmptyState is a design that re-invents them — and the class helpers because an element
// that cannot be a <button> still has to look like one.
const ALWAYS = [
    "app/components/ui/icons.tsx",
    "app/components/ui/card.tsx",
    "app/components/ui/pageHeader.tsx",
    "app/components/ui/emptyState.tsx",
    "app/components/ui/classes.ts",
];

// The provider chain .storybook/preview.tsx wraps every story in. A preview mounts what
// the bundle exports, so the chain has to be exported too or every component that reads
// the MIDI context or renders a <Link> throws.
const PROVIDERS = [
    { name: "MemoryRouter", from: "react-router" },
    { name: "MidiProvider", from: "../../app/contexts/midi" },
];

// Names a story imports beside the component it renders — a sibling export of the same
// module, or the services provider a story sets up itself. Every import that cfg's
// storyImports.shim redirects has to be resolvable on the global, or the story compiles
// against undefined.
const COMPANIONS = [
    { name: "ServicesProvider", from: "../../app/contexts/services" },
    { name: "useServices", from: "../../app/contexts/services" },
    { name: "GradeBadgeView", from: "../../app/components/features/gradeBadge" },
    { name: "GradeChip", from: "../../app/components/features/scoreGrade" },
    { name: "IconButton", from: "../../app/components/ui/button" },
    { name: "FieldGroup", from: "../../app/components/ui/disclosure" },
    { name: "buttonClasses", from: "../../app/components/ui/button" },
];

const entries = Object.values(JSON.parse(readFileSync(INDEX, "utf8")).entries);

// One entry per component: the story title's last segment names it, and the story file
// sits beside the module that defines it (foo.stories.tsx next to foo.tsx).
const byTitle = new Map();
for (const entry of entries) {
    if (!byTitle.has(entry.title)) {
        byTitle.set(entry.title, entry.importPath);
    }
}

// Every name a module exports, so a re-export can be checked before it is written: a
// missing one would break the whole bundle rather than the one component.
const exportsOf = (module) => {
    const source = readFileSync(module, "utf8");
    const names = new Set();
    for (const [, name] of source.matchAll(/^export\s+(?:async\s+)?(?:function|const|class)\s+(\w+)/gm)) {
        names.add(name);
    }
    for (const [, group] of source.matchAll(/^export\s*\{([^}]*)\}/gm)) {
        for (const part of group.split(",")) {
            names.add(part.trim().split(/\s+as\s+/).pop());
        }
    }
    return names;
};

const exports = [];
const unresolved = [];
const skipped = [];
for (const [title, importPath] of [...byTitle].sort()) {
    const special = Object.hasOwn(SPECIAL, title) ? SPECIAL[title] : undefined;
    if (special === null) {
        skipped.push(title);
        continue;
    }
    const story = importPath.replace(/^\.\//, "");
    const namesake = join(dirname(story), basename(story).replace(/\.stories\.tsx?$/, ".tsx"));
    for (const wanted of special ?? [title.split("/").pop()]) {
        const [name, module, exported] = Array.isArray(wanted) ? wanted : [wanted, namesake];
        if (!existsSync(module)) {
            unresolved.push(`${title} — no module at ${module}`);
            continue;
        }
        const source = exported ?? name;
        if (source !== "default" && !exportsOf(module).has(source)) {
            unresolved.push(`${title} — ${module} exports no ${source}`);
            continue;
        }
        exports.push({
            name: source === name ? name : `${source} as ${name}`,
            from: `../../${module.replace(/\.tsx?$/, "")}`,
        });
    }
}
for (const module of ALWAYS) {
    for (const name of [...exportsOf(module)].sort()) {
        exports.push({ name, from: `../../${module.replace(/\.tsx?$/, "")}` });
    }
}
exports.push(...PROVIDERS, ...COMPANIONS);

// One export per name: a module reached twice (a companion whose module is also a story's
// namesake) would otherwise emit the name twice and fail the bundle.
const seen = new Set();
const unique = exports.filter(({ name }) => !seen.has(name) && seen.add(name));

// Split so the licence tags are not literals in this file: `reuse lint` reads every
// line, and a tag inside a quoted string ends in `",` — an expression it rejects.
const TAG = "SPDX-";
const GENERATED = [
    `// ${TAG}FileCopyrightText: The Plinky Authors`,
    `// ${TAG}License-Identifier: AGPL-3.0-or-later`,
    "",
    "// Generated by .design-sync/make-entry.mjs — do not edit.",
];

mkdirSync(".design-sync/pkg", { recursive: true });
writeFileSync(
    ".design-sync/pkg/entry.ts",
    [
        ...GENERATED,
        "// Every storied component, re-exported for window.Plinky.",
        "",
        ...unique.map(({ name, from }) => `export { ${name} } from "${from}";`),
        "",
    ].join("\n"),
);
writeFileSync(
    ".design-sync/pkg/package.json",
    `${JSON.stringify({ name: "plinky", version: "0.0.0", private: true, types: "index.d.ts" }, null, 4)}\n`,
);
writeFileSync(
    ".design-sync/pkg/index.d.ts",
    [
        ...GENERATED,
        "// The types entry: where design-sync reads each component's API contract from.",
        "",
        'export * from "../types/.design-sync/pkg/entry";',
        "",
    ].join("\n"),
);
// The converter resolves the package by name out of node_modules, so the link is what
// makes an unpublished package resolvable at all. node_modules is gitignored, which is
// why this is recreated on every run rather than once per clone.
rmSync("node_modules/plinky", { force: true, recursive: true });
symlinkSync("../.design-sync/pkg", "node_modules/plinky");

console.log(`entry.ts: ${unique.length} exports`);
for (const title of skipped) {
    console.log(`  [NO_COMPONENT] ${title} — excluded, must be titleMap null`);
}
for (const miss of unresolved) {
    console.log(`  [UNRESOLVED] ${miss}`);
}
if (unresolved.length > 0) {
    process.exit(1);
}
