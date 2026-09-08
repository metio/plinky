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
        route("piano", "routes/piano.tsx"),
        route("compose", "routes/compose.tsx"),
        route("daily", "routes/daily.tsx"),
        route("ear", "routes/ear.tsx"),
        route("rhythm", "routes/rhythm.tsx"),
        route("music", "routes/music.tsx"),
        // The catalogue by the two things somebody actually asks it for: a level and a
        // sound. Each shelf is a page of its own so it has an address to link to and to
        // be found at, rather than living only inside the filters on /music.
        route("music/grade/:grade", "routes/musicHub.tsx", { id: "grade-hub" }),
        route("music/era/:era", "routes/musicHub.tsx", { id: "era-hub" }),
        // And by the work a piece belongs to. A book of studies or a suite is the thing
        // somebody actually goes looking for — "Bach inventions", "Czerny op. 599" — and
        // the catalogue already knows which pieces make each one up.
        route("music/collection/:collection", "routes/musicHub.tsx", { id: "collection-hub" }),
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
        // Every mark at an address of its own. "What does a fermata mean" is a
        // question somebody types into a search engine, and it has an answer here that
        // can be heard — which a page reachable only by tapping through a list cannot
        // be found by, whatever it holds.
        route("glossary/:term", "routes/glossary.tsx", { id: "glossary-term" }),
        route("tools", "routes/tools.tsx"),
        route("theory", "routes/theory.tsx"),
        // Each lesson at an address of its own. "What is an octave" is a question people
        // type into a search engine, and the answer was a paragraph two thirds of the way
        // down a page of fourteen.
        route("theory/:lesson", "routes/theory.tsx", { id: "theory-lesson" }),
        route("about", "routes/about.tsx"),
        route("news", "routes/news.tsx"),
        route("impressum", "routes/impressum.tsx"),
        route("datenschutz", "routes/datenschutz.tsx"),
        route("person/:slug", "routes/person.tsx"),
    ]),
    // Anything with no language in the address, redirected to the visitor's own. Last, so
    // it only ever sees what nothing else matched.
    route("*", "routes/unlocalizedRedirect.tsx"),
] satisfies RouteConfig;
