// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

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
        route("ear", "routes/ear.tsx"),
        route("library", "routes/library.tsx"),
        route("assignments", "routes/assignments.tsx"),
        route("collect", "routes/collect.tsx"),
        route("stats", "routes/stats.tsx"),
        route("placement", "routes/placement.tsx"),
        route("review", "routes/review.tsx"),
        route("settings", "routes/settings.tsx"),
        route("learn", "routes/learn.tsx"),
        route("teach", "routes/teach.tsx"),
        route("basics", "routes/basics.tsx"),
        route("help", "routes/help.tsx"),
        route("glossary", "routes/glossary.tsx"),
        route("tools", "routes/tools.tsx"),
        route("theory", "routes/theory.tsx"),
        route("about", "routes/about.tsx"),
        route("impressum", "routes/impressum.tsx"),
        route("datenschutz", "routes/datenschutz.tsx"),
        route("person/:slug", "routes/person.tsx"),
    ]),
] satisfies RouteConfig;
