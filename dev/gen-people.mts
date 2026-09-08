// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Writes what each composer page says about its composer, one file per language, beside
// the site: build/client/people/<locale>.json.
//
// The source is dev/people-wikidata.json (collected by hand with `npm run people:wikidata`,
// committed, CC0), narrowed to one language per file — a composer page needs its own
// language and no other, and four hundred people described in twenty-six languages is
// four hundred kilobytes nobody should download to read one line.
//
// Beside the site rather than in the bundle for the same reason: the page fetches its
// language's file the way it fetches the catalogue, and the edge reads the same file when
// it writes the page's document. One file, two readers, no copy that can drift.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { PeopleAbout } from "../core/personAbout.ts";
import { PEOPLE_INDEX } from "../core/peopleIndex.ts";
import type { WikidataPerson } from "./fetch-wikidata.mts";

const OUT = "build/client/people";
const SOURCE = "dev/people-wikidata.json";

// Wikipedia's host for a language the site speaks: the same code, but for Norwegian
// Bokmål, which Wikipedia files under "no".
export function wikipediaUrl(locale: string, title: string): string {
    const host = `${locale === "nb" ? "no" : locale}.wikipedia.org`;
    return `https://${host}/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}

// One language's file: every composer the catalogue credits that Wikidata could place,
// with the description in this language where there is one. A composer with nothing to
// say in this language is left out rather than carried empty — the page then prints their
// name and their pieces, as it did before any of this.
export function peopleFor(
    source: Record<string, WikidataPerson>,
    locale: string,
    base: string,
): PeopleAbout {
    const people: PeopleAbout = {};
    for (const slug of Object.keys(PEOPLE_INDEX).sort()) {
        const found = source[slug];
        if (!found) {
            continue;
        }
        // The site's own language stands in for one that has no description of its own:
        // an English line on a Croatian page beats a page that says nothing, and it is
        // what the reader would find by following the link anyway.
        const about = found.about[locale] ?? found.about[base];
        const title = found.wikipedia[locale];
        const entry = {
            ...(about ? { about } : {}),
            ...(found.born === undefined ? {} : { born: found.born }),
            ...(found.died === undefined ? {} : { died: found.died }),
            ...(title ? { wikipedia: wikipediaUrl(locale, title) } : {}),
            id: found.id,
        };
        if (about || entry.born !== undefined || entry.died !== undefined || entry.wikipedia) {
            people[slug] = entry;
        }
    }
    return people;
}

export function writePeople(out = OUT): { locales: number; people: number } {
    const source = JSON.parse(readFileSync(SOURCE, "utf8")) as Record<string, WikidataPerson>;
    const { locales, baseLocale } = JSON.parse(
        readFileSync("project.inlang/settings.json", "utf8"),
    ) as { locales: string[]; baseLocale: string };
    mkdirSync(out, { recursive: true });
    let people = 0;
    for (const locale of locales) {
        const written = peopleFor(source, locale, baseLocale);
        people = Math.max(people, Object.keys(written).length);
        writeFileSync(`${out}/${locale}.json`, JSON.stringify(written));
    }
    return { locales: locales.length, people };
}

if (process.argv[1]?.endsWith("gen-people.mts")) {
    const { locales, people } = writePeople();
    console.log(`${OUT}: ${people} composers described, in ${locales} languages.`);
}
