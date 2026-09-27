// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

// The documents the edge writes, hydrated by the app that has to live in them.
//
// Most of the catalogue has no prerendered document: a composer, a shelf and all but two
// of the pieces are written at the edge from the shell (functions/_middleware.js), and the
// app then hydrates that document. Nothing else opens one — the a11y sweep and Lighthouse
// audit the prerendered pages, and the middleware's own suite reads the document as text —
// so a document React refuses is a defect every other gate reports green: the page still
// works, rebuilt from nothing on every visit, and only the console says so.
//
// The shell here is the app's own render rather than a fixture, so it carries whatever
// app/root.tsx puts in the head, in the order React writes it; the document is the real
// middleware's; and the hydration is React's. What each test asserts is that React had no
// complaint.
//
// The one thing modelled rather than taken: the root stylesheet, which the build's
// <Links/> renders and a routes stub has none of. React writes a <link rel="stylesheet">
// in place rather than hoisting it, which is what puts it between the app's bootstrap
// scripts and the beacon — the arrangement the deployed documents carry, and the one that
// decides which element React claims for which.

import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { documentFor, type Known } from "../functions/_middleware.js";
import { browserStore } from "./adapters/browserStore";
import { loadBundledScores, saveUserScore } from "./lib/catalog";
import { meta as personMeta } from "./routes/person";
import { meta as playMeta } from "./routes/play";
import { Layout } from "./root";

const BUNDLED = loadBundledScores()[0]!;

// The catalogue as the build writes it beside the site, holding one composer, one
// catalogue piece (which no device has locally, so the app resolves nothing for it) and
// the shelves every locale gets.
const KNOWN = {
    pieces: {
        aZSWdZeRKnuA: { title: "Für Elise", composer: "Ludwig van Beethoven", grade: 5 },
    },
    people: {
        "ludwig-van-beethoven": { name: "Ludwig van Beethoven", pieces: ["aZSWdZeRKnuA"] },
    },
    collections: {},
    locales: ["en", "de"],
    base: "en",
    strings: {
        en: {
            playBy: 'Play "{title}" by {composer} in your browser.',
            play: 'Play "{title}" in your browser.',
            playFacts: { one: "Grade {grade}.", other: "Grade {grade}." },
            person: "{name}’s pieces on Plinky.",
            home: "Today",
            music: "Music",
            grade: "Grade {grade}",
            hubGrade: "Grade {grade} piano pieces",
            hubGradeAbout: "Everything graded {grade}.",
            hubEra_baroque: "Baroque piano pieces",
            hubEra_classical: "Classical piano pieces",
            hubEra_romantic: "Romantic piano pieces",
            hubEra_modern: "Modern piano pieces",
            hubEraAbout: "Pieces by the composers of this period.",
            hubCollection: "Every piece in {name}.",
            og: "en_US",
        },
    },
} satisfies Known;

// The root stylesheet the build's <Links/> renders for every page.
const CSS = () => [{ rel: "stylesheet", href: "/assets/root-abc123.css" }];

const Page = () => (
    <Layout>
        <div id="page" />
    </Layout>
);

// The shell the deploy serves for every address it holds no document for: the app's head
// for a page that brought no card and no tags of its own.
const ShellStub = createRoutesStub([{ path: "/en/", links: CSS, Component: Page }]);

const shell = () => `<!DOCTYPE html>${renderToString(<ShellStub initialEntries={["/en/"]} />)}`;

// The route as the app runs it, on the address the document was written for.
function routeStub(path: string, meta: unknown) {
    return createRoutesStub([
        {
            path,
            links: CSS,
            meta,
            handle: { cardFor: () => true },
            Component: Page,
        },
    ] as never);
}

// Everything React had to say about the document while taking it over. A hydration
// mismatch is recoverable — React renders the tree again from nothing and carries on —
// which is exactly why it goes unnoticed: the page still works, slower and from scratch.
async function hydrationErrors(
    document_: string,
    Stub: ReturnType<typeof createRoutesStub>,
    path: string,
) {
    const head = document_.split("<head>")[1]?.split("</head>")[0] ?? "";
    const body = document_.split("</head>")[1]?.replace(/<\/html>\s*$/, "") ?? "";
    document.documentElement.innerHTML = `<head>${head}</head>${body}`;
    const errors: string[] = [];
    await act(async () => {
        hydrateRoot(document, <Stub initialEntries={[path]} />, {
            onRecoverableError: (error) => errors.push(String((error as Error)?.message ?? error)),
        });
    });
    return errors;
}

afterEach(() => {
    document.documentElement.innerHTML = "<head></head><body></body>";
    localStorage.clear();
});

describe("the documents the edge writes", () => {
    it("hydrates a composer's page", async () => {
        const written = documentFor(shell(), KNOWN, {
            locale: "en",
            kind: "person",
            id: "ludwig-van-beethoven",
        }) as string;
        expect(written).toContain('"@type":"Person"');
        const errors = await hydrationErrors(
            written,
            routeStub("/en/person/:slug", personMeta),
            "/en/person/ludwig-van-beethoven/",
        );
        expect(errors).toEqual([]);
    });

    it("hydrates a catalogue piece's page", async () => {
        const written = documentFor(shell(), KNOWN, {
            locale: "en",
            kind: "play",
            id: "aZSWdZeRKnuA",
        }) as string;
        expect(written).toContain('"@type":"MusicComposition"');
        const errors = await hydrationErrors(
            written,
            routeStub("/en/play/:scoreId", playMeta),
            "/en/play/aZSWdZeRKnuA/",
        );
        expect(errors).toEqual([]);
    });

    it("hydrates a shelf", async () => {
        for (const page of [
            { kind: "grade" as const, id: "5", path: "/en/music/grade/:grade" },
            { kind: "era" as const, id: "baroque", path: "/en/music/era/:era" },
        ]) {
            const written = documentFor(shell(), KNOWN, {
                locale: "en",
                kind: page.kind,
                id: page.id,
            }) as string;
            expect(written).toContain('"@type":"CollectionPage"');
            const errors = await hydrationErrors(
                written,
                // The shelves render no meta() of their own, which is the whole of what
                // the document has to agree with.
                routeStub(page.path, undefined),
                `/en/music/${page.kind}/${page.id}/`,
            );
            expect(errors).toEqual([]);
        }
    });

    // The piece a player imported: the site holds no row for it, so the edge writes
    // nothing and the bare shell is what the app hydrates against. The route resolves the
    // piece from the device, which is the one case where meta() has a subject to describe
    // and the document it lands in describes nothing.
    it("hydrates the bare shell under a route that knows its subject", async () => {
        saveUserScore(browserStore, {
            id: "an-imported-piece",
            title: "An imported piece",
            composer: "Anonymous",
            description: "",
            xml: "<score-partwise/>",
            tempo: 90,
            beatsPerBar: 4,
            bundled: false,
        });
        const errors = await hydrationErrors(
            shell(),
            routeStub("/en/play/:scoreId", playMeta),
            "/en/play/an-imported-piece/",
        );
        expect(errors).toEqual([]);
    });

    // The two pieces that do prerender: the app's own document, hydrated by the app. The
    // control — it says the harness reports a clean hydration as clean.
    it("hydrates a page the app rendered itself", async () => {
        const Stub = routeStub("/en/play/:scoreId", playMeta);
        const path = `/en/play/${BUNDLED.id}/`;
        const own = `<!DOCTYPE html>${renderToString(<Stub initialEntries={[path]} />)}`;
        expect(own).toContain('"@type":"MusicComposition"');
        expect(await hydrationErrors(own, Stub, path)).toEqual([]);
    });
});
