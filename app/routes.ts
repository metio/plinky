// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { type RouteConfig, index, route } from "@react-router/dev/routes";

// Every page lives under a /:locale/ prefix so each language prerenders to its
// own static document and the active locale is read from the URL. The bare "/"
// is a client-only redirector to the visitor's language.
export default [
    index("routes/localeRedirect.tsx"),
    route(":locale", "routes/localeLayout.tsx", [
        index("routes/home.tsx"),
        route("play/:scoreId", "routes/play.tsx"),
        route("compose", "routes/compose.tsx"),
        route("daily", "routes/daily.tsx"),
        route("library", "routes/library.tsx"),
        route("library/import", "routes/libraryImport.tsx"),
        route("assignments", "routes/assignments.tsx"),
        route("you", "routes/you.tsx"),
        route("review", "routes/review.tsx"),
        route("settings", "routes/settings.tsx"),
        route("help", "routes/help.tsx"),
        route("board", "routes/board.tsx"),
        route("person/:slug", "routes/person.tsx"),
    ]),
] satisfies RouteConfig;
