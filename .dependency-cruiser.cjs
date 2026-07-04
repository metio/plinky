// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The architecture contract, enforced. Plinky is built as a stack of layers whose
// dependencies point strictly downward:
//
//   routes → components/features → components/ui → core
//              │                      │
//              ▼                      ▼
//            hooks → stores → ports ← adapters       (core has no outward edges;
//              └────────┴───────┴────────┘            dev/ and the build config
//                                                     depend down on core too)
//
// core/ is pure domain — no React, no OSMD, no browser globals, no I/O. Side effects
// live behind ports (interfaces) implemented by adapters, so the units that use them
// stay testable with fakes. These rules catch a dependency that would flow the wrong
// way; the layers that don't exist yet leave their rules dormant until their folder
// lands, at which point the rule starts guarding it. Browser-global purity of core/
// (localStorage/document/window/fetch) is enforced separately by a DOM-free tsconfig,
// not here — dependency-cruiser only sees imports, not global references.

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
    forbidden: [
        {
            name: "no-circular",
            comment:
                "A dependency cycle. There are none today; keep it that way — cycles defeat the " +
                "downward-only layering and make modules impossible to reason about in isolation.",
            severity: "error",
            from: {},
            to: { circular: true },
        },
        {
            name: "core-stays-pure",
            comment:
                "core/ is the pure domain layer: it may depend on nothing but itself. No React, no " +
                "OpenSheetMusicDisplay, and no reaching up into app/. Extract the pure half instead.",
            severity: "error",
            from: { path: "^core/" },
            to: {
                path: [
                    "^app/",
                    "node_modules/react/",
                    "node_modules/react-dom/",
                    "node_modules/react-router/",
                    "node_modules/opensheetmusicdisplay/",
                ],
            },
        },
        {
            name: "ports-are-interfaces",
            comment:
                "app/ports/ holds interfaces only — it may import core types but nothing that " +
                "implements or consumes a port (adapters, stores, hooks, components, routes, react).",
            severity: "error",
            from: { path: "^app/ports/" },
            to: {
                path: [
                    "^app/adapters/",
                    "^app/stores/",
                    "^app/hooks/",
                    "^app/components/",
                    "^app/routes/",
                    "^app/lib/",
                    "node_modules/react/",
                ],
            },
        },
        {
            name: "adapters-point-down",
            comment:
                "app/adapters/ implements ports over core; it must not reach up into stores, hooks, " +
                "components or routes.",
            severity: "error",
            from: { path: "^app/adapters/" },
            to: {
                path: ["^app/stores/", "^app/hooks/", "^app/components/", "^app/routes/"],
            },
        },
        {
            name: "stores-point-down",
            comment:
                "app/stores/ is the single-source-of-truth state layer over core + ports; it must not " +
                "import React glue (hooks), components or routes.",
            severity: "error",
            from: { path: "^app/stores/" },
            to: { path: ["^app/hooks/", "^app/components/", "^app/routes/"] },
        },
        {
            name: "ui-is-pure",
            comment:
                "app/components/ui/ are pure presentational primitives: props in, elements out. They " +
                "may compose core + other ui + react, but never stores, adapters, contexts, effectful " +
                "hooks or the legacy lib/. Tightened to error once the ui/features split lands.",
            severity: "warn",
            from: { path: "^app/components/ui/" },
            to: {
                path: [
                    "^app/stores/",
                    "^app/adapters/",
                    "^app/hooks/",
                    "^app/contexts/",
                    "^app/routes/",
                    "^app/lib/",
                ],
            },
        },
        {
            name: "dev-depends-on-core",
            comment:
                "Build/import scripts under dev/ may only reach down into core/ (pure, shared music " +
                "tooling), never sideways into the app UI layers. Currently they still import app/lib/; " +
                "this becomes an error once core/ exists and they are repointed.",
            severity: "warn",
            from: { path: "^dev/" },
            to: { path: ["^app/"] },
        },
        {
            name: "no-orphans",
            comment:
                "A module nothing imports. knip is the blocking dead-code gate (it understands the " +
                "react-router entry graph); this warns as an architecture smell. Routes, entries and " +
                "generated/config files are excluded because the framework wires them without an import.",
            severity: "warn",
            from: {
                orphan: true,
                pathNot: [
                    "\\.(test|stories)\\.[jt]sx?$",
                    "\\.d\\.ts$",
                    "(^|/)\\.[^/]+\\.(c|m)?[jt]s$", // dotfiles like this config
                    "^app/routes/", // react-router loads these by path string, not import
                    "^app/root\\.tsx$",
                    "^app/routes\\.ts$",
                    "^app/entry\\.server\\.tsx$",
                    "^app/test-setup",
                    "^app/paraglide/",
                    "^react-router\\.config\\.ts$",
                ],
            },
            to: {},
        },
    ],
    options: {
        // Resolve TypeScript path/rootDirs the way Vite does, so the generated +types
        // route modules and bundler resolution line up with the real build.
        tsConfig: { fileName: "tsconfig.json" },
        tsPreCompilationDeps: true,
        enhancedResolveOptions: {
            extensions: [".ts", ".tsx", ".mts", ".js", ".jsx", ".mjs", ".json"],
            exportsFields: ["exports"],
            conditionNames: ["import", "require", "node", "default"],
        },
        // Third-party code, generated output, and non-code assets are not ours to lint.
        doNotFollow: {
            path: ["node_modules", "\\.react-router", "^app/paraglide/"],
        },
        exclude: {
            // Vite query-suffixed and generated modules are unresolvable to a static
            // analyzer; the .woff2?url font import and the paraglide output are not edges
            // the architecture cares about.
            path: ["\\?(url|raw|worker)$", "\\.react-router/", "^app/paraglide/"],
        },
        reporterOptions: {
            dot: { collapsePattern: "node_modules/(?:@[^/]+/[^/]+|[^/]+)" },
        },
    },
};
