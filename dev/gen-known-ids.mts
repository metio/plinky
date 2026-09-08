// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The catalogue as the edge sees it, written beside the site for functions/_middleware.js.
//
// Two pieces prerender to their own document; the other three thousand, and most of the
// composers, render on the client. The static host answers those addresses with a 404 and
// the middleware writes the document instead — a real title, a real description, the
// hreflang cluster, the structured data and a summary a reader without JavaScript can
// read — from what this file holds. Prerendering them would be the straightforward
// answer, and it is closed: Cloudflare Pages caps a deployment at twenty thousand files,
// and three thousand pieces in twenty-six languages are eighty thousand documents.
//
// So the file is the catalogue's metadata, not its ids alone. It is also what tells a real
// page from a missing one: an id from a scheme the catalogue left behind, a composer whose
// spelling was merged into another's, a piece that never existed — a document written for
// those would be a soft 404 that teaches a search index to distrust every answer the site
// gives, so a miss that is not listed here keeps its 404.
//
// Written by the build rather than at deploy because the composer index, the bundled
// pieces and the messages are all TypeScript or JSON the deploy runs without.

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { PEOPLE_INDEX } from "../core/peopleIndex.ts";
import { canonicalPeople, personSlugs } from "../core/person.ts";
import { readScoreMetaFromText } from "../core/scoreMeta.ts";
import { ogLocale } from "../core/site.ts";
import { songId } from "../core/songId.ts";

const OUT = "build/client";
// The bundled pieces, read from their files the way the app inlines them: the same
// content-fingerprint id and the same credit, without reaching into the app's layer.
const BUNDLED = "scores";

type Row = {
    id: string;
    title: string;
    composer: string;
    grade?: number;
    license?: string;
    bars?: number;
    tempo?: number;
};

function bundledPieces(): Row[] {
    return readdirSync(BUNDLED)
        .filter((name) => name.endsWith(".musicxml"))
        .map((name) => {
            const xml = readFileSync(`${BUNDLED}/${name}`, "utf8");
            const meta = readScoreMetaFromText(xml);
            return { id: songId(xml), title: meta.title, composer: meta.composer };
        });
}

// A piece as the edge describes it: its title, the people credited in the plain form the
// app's own meta description uses, its grade, and the licence it travels under.
export type KnownPiece = {
    title: string;
    composer: string;
    grade?: number;
    license?: string;
    // What the piece is, in numbers. The page reads the same three off the score it
    // already holds; the edge has no notation, so it carries them here — and the two must
    // agree, or a crawler is served one description and the running app writes another.
    bars?: number;
    tempo?: number;
};
export type KnownPerson = { name: string; pieces: string[] };
// A named work the catalogue holds enough of to be worth working through as one thing,
// as build/client/songs/builtin-assignments.json resolves it. The name is a proper noun
// — a composer and a work — so it is the same in every language and the edge writes it
// verbatim; only the chrome around it is translated.
export type KnownCollection = { name: string; pieces: string[] };
// The strings a document needs in the reader's language, as the app's own messages say
// them. Each holds `{title}`, `{composer}` and `{name}` placeholders where the message
// does; the middleware fills them in.
export type KnownStrings = {
    playBy: string;
    play: string;
    playFacts: string;
    person: string;
    home: string;
    music: string;
    grade: string;
    hubGrade: string;
    hubGradeAbout: string;
    hubEra_baroque: string;
    hubEra_classical: string;
    hubEra_romantic: string;
    hubEra_modern: string;
    hubEraAbout: string;
    hubCollection: string;
    og: string;
};
export type KnownIds = {
    pieces: Record<string, KnownPiece>;
    people: Record<string, KnownPerson>;
    collections: Record<string, KnownCollection>;
    locales: string[];
    base: string;
    strings: Record<string, KnownStrings>;
};

// The messages read straight from their JSON rather than through paraglide, whose
// compiled output is per-locale and gitignored — and this runs once, for all of them.
function stringsFor(locale: string): KnownStrings {
    const messages = JSON.parse(readFileSync(`messages/${locale}.json`, "utf8")) as Record<
        string,
        string
    >;
    const need = (key: string): string => {
        const value = messages[key];
        if (typeof value !== "string" || value === "") {
            throw new Error(
                `messages/${locale}.json: ${key} is missing, so the edge documents in ${locale} would be blank`,
            );
        }
        return value;
    };
    return {
        playBy: need("meta_play_description_by"),
        play: need("meta_play_description"),
        playFacts: need("meta_play_facts"),
        person: need("meta_person_description"),
        home: need("nav_today"),
        music: need("music_title"),
        grade: need("score_grade"),
        hubCollection: need("hub_collection_intro"),
        hubGrade: need("hub_grade_title"),
        hubGradeAbout: need("hub_grade_intro"),
        hubEra_baroque: need("hub_era_title_baroque"),
        hubEra_classical: need("hub_era_title_classical"),
        hubEra_romantic: need("hub_era_title_romantic"),
        hubEra_modern: need("hub_era_title_modern"),
        hubEraAbout: need("hub_era_intro"),
        og: ogLocale(locale),
    };
}

export function knownIds(): KnownIds {
    const songs = JSON.parse(readFileSync("public/songs/manifest.json", "utf8")) as Row[];
    const exercises = JSON.parse(readFileSync("public/exercises/manifest.json", "utf8")) as Row[];
    const pieces: Record<string, KnownPiece> = {};
    const people: Record<string, KnownPerson> = {};
    // Every composer the index lists has a page whether or not a piece here still credits
    // them; the pieces fill the rest in, so a composer below the index's floor is a page
    // too — built from the pieces alone, exactly as the client builds it.
    for (const [slug, entry] of Object.entries(PEOPLE_INDEX)) {
        people[slug] = { name: entry.name, pieces: [] };
    }
    for (const row of [...songs, ...exercises, ...bundledPieces()]) {
        const names = canonicalPeople(row.composer ?? "");
        pieces[row.id] = {
            title: row.title,
            composer: names.join(", "),
            ...(row.grade === undefined ? {} : { grade: row.grade }),
            ...(row.license ? { license: row.license } : {}),
            ...(row.bars === undefined ? {} : { bars: row.bars }),
            ...(row.tempo === undefined ? {} : { tempo: row.tempo }),
        };
        personSlugs(row.composer ?? "").forEach((slug, index) => {
            if (!slug) {
                return;
            }
            people[slug] ??= { name: names[index] ?? slug, pieces: [] };
            if (!people[slug].pieces.includes(row.id)) {
                people[slug].pieces.push(row.id);
            }
        });
    }
    // The named works, in the order the bake resolved them: gentlest first within a set,
    // which is the order somebody works through it.
    const works = JSON.parse(readFileSync("public/songs/builtin-assignments.json", "utf8")) as {
        id: string;
        name: string;
        items: string[];
    }[];
    const collections: Record<string, KnownCollection> = Object.fromEntries(
        works.map((work) => [work.id, { name: work.name, pieces: work.items }]),
    );
    // The languages the site speaks, for the middleware to send a visitor to theirs and to
    // name every alternate of a page.
    const { locales, baseLocale } = JSON.parse(
        readFileSync("project.inlang/settings.json", "utf8"),
    ) as { locales: string[]; baseLocale: string };
    const strings = Object.fromEntries(locales.map((locale) => [locale, stringsFor(locale)]));
    return {
        pieces: Object.fromEntries(Object.entries(pieces).sort(([a], [b]) => a.localeCompare(b))),
        people: Object.fromEntries(Object.entries(people).sort(([a], [b]) => a.localeCompare(b))),
        collections,
        locales,
        base: baseLocale,
        strings,
    };
}

export function writeKnownIds(out = OUT): KnownIds {
    const known = knownIds();
    mkdirSync(out, { recursive: true });
    writeFileSync(`${out}/known.json`, JSON.stringify(known));
    return known;
}

if (process.argv[1]?.endsWith("gen-known-ids.mts")) {
    const { pieces, people, locales } = writeKnownIds();
    console.log(
        `known.json: ${Object.keys(pieces).length} pieces, ${Object.keys(people).length} people, ${locales.length} languages.`,
    );
}
