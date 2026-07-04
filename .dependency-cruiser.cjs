// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The architecture contract, enforced. The app is built as a stack of layers whose
// dependencies point strictly downward:
//
//   routes → components/features → components/ui → core
//              │                      │
//              ▼                      ▼
//            hooks → stores → ports ← adapters       (core has no outward edges;
//              └────────┴───────┴────────┘            dev/ and the build config
//                                                     depend down on core too)
//
// core/ is pure domain — no React, no OSMD, no I/O. Side effects live behind ports
// (interfaces) implemented by adapters, so the units that use them stay testable
// with fakes. These rules catch a dependency that would flow the wrong way; a rule
// whose folder does not exist yet lies dormant until the folder lands, at which
// point it starts guarding. Browser globals (localStorage & friends) are not
// imports, so dependency-cruiser cannot see them — dev/check-globals.mjs confines
// those to their adapters.

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
                "OpenSheetMusicDisplay, and no reaching up into app/. Extract the pure half instead. " +
                "Tests are exempt — a browser test may render a pure module through OSMD to verify it.",
            severity: "error",
            from: { path: "^core/", pathNot: "\\.(test|stories)\\.[jt]sx?$" },
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
            from: { path: "^app/ports/", pathNot: "\\.(test|stories)\\.[jt]sx?$" },
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
            from: { path: "^app/adapters/", pathNot: "\\.(test|stories)\\.[jt]sx?$" },
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
            from: { path: "^app/stores/", pathNot: "\\.(test|stories)\\.[jt]sx?$" },
            to: { path: ["^app/hooks/", "^app/components/", "^app/routes/"] },
        },
        {
            name: "ui-is-pure",
            comment:
                "app/components/ui/ are pure presentational primitives: props in, elements out. They " +
                "may compose core + other ui + react, but never stores, adapters, contexts, effectful " +
                "hooks or the legacy lib/. Tightened to error once the ui/features split lands.",
            severity: "warn",
            from: { path: "^app/components/ui/", pathNot: "\\.(test|stories)\\.[jt]sx?$" },
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
                "tooling), never sideways into the app UI layers. Severity stays warn while " +
                "scoreDifficulty (DOM-coupled XML parsing) remains in app/lib; it becomes error when " +
                "that module's pure half lands in core/.",
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
