// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Looks every composer the catalogue credits up on Wikidata and writes what it finds to
// dev/people-wikidata.json: the entity, the years, a one-line description in every
// language the site speaks, and the Wikipedia article where there is one.
//
// A composer page that is a bare list of pieces is thin for a reader and for a search
// engine alike. Wikidata's descriptions are CC0 and already translated, so "Polish
// composer and pianist (1810–1849)" costs nothing to carry and answers the first question
// a visitor has. The file is committed: this runs by hand (`npm run people:wikidata`)
// when the catalogue gains composers, and dev/bake-people.mts reads it at bake time, so a
// build never touches the network.
//
// Matching is by name, which is where the risk lives — a catalogue credit is a surname
// and a hint, and Wikidata holds every Smith. A candidate is taken only when Wikidata
// says it is a person whose occupation is musical, or describes them as one; anybody the
// search cannot place that surely is left out and listed at the end, which is what to
// read when a page shows the wrong person. An entry already in the file is kept as it
// is, so a correction made by hand survives the next run.

import { readFile, writeFile } from "node:fs/promises";
import { PEOPLE_INDEX } from "../core/peopleIndex.ts";

export const WIKIDATA_FILE = "dev/people-wikidata.json";

export type WikidataPerson = {
    id: string;
    born?: number;
    died?: number;
    about: Record<string, string>;
    wikipedia: Record<string, string>;
};

const API = "https://www.wikidata.org/w/api.php";
const AGENT = "Plinky/1.0 (https://plinky.fun; catalogue enrichment)";

// Occupations that make a name a musician's: composer, pianist, conductor, musician,
// organist, songwriter, music teacher, hymnwriter, lutenist, harpsichordist,
// music theorist, arranger, singer-songwriter, singer, church musician, violinist.
const MUSICAL = new Set([
    "Q36834",
    "Q486748",
    "Q158852",
    "Q639669",
    "Q765778",
    "Q753110",
    "Q2865819",
    "Q1370913",
    "Q21178986",
    "Q1198887",
    "Q1350157",
    "Q1415090",
    "Q488205",
    "Q177220",
    "Q3391743",
    "Q1259917",
    "Q10800557",
    "Q806349",
    "Q855091",
    "Q2643890",
]);
const MUSICAL_WORDS =
    /compos|music|pianist|organist|song|hymn|conductor|lutenist|harpsichord|violin|choir|kapellmeister|cantor|psalmod/i;

type Entity = {
    id: string;
    claims?: Record<string, { mainsnak: { datavalue?: { value: unknown } } }[]>;
    descriptions?: Record<string, { value: string }>;
    sitelinks?: Record<string, { title: string }>;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// One request at a time, a breath between them, and a longer one when the API says
// slow down: it answers a burst with 429s, and four hundred names in a burst is how the
// first run placed eighty of them.
async function call(params: Record<string, string>): Promise<unknown> {
    const url = new URL(API);
    for (const [key, value] of Object.entries({ ...params, format: "json", origin: "*" })) {
        url.searchParams.set(key, value);
    }
    for (let attempt = 0; ; attempt += 1) {
        const response = await fetch(url, { headers: { "user-agent": AGENT } });
        if (response.status === 429 && attempt < 6) {
            await sleep(2000 * 2 ** attempt);
            continue;
        }
        if (!response.ok) {
            throw new Error(`${url.pathname}?action=${params.action}: ${response.status}`);
        }
        await sleep(250);
        return response.json();
    }
}

function year(entity: Entity, property: string): number | undefined {
    const value = entity.claims?.[property]?.[0]?.mainsnak.datavalue?.value as
        | { time?: string; precision?: number }
        | undefined;
    const match = value?.time?.match(/^([+-]\d+)-/);
    // Precision 9 is a year; anything coarser (a decade, a century) is not a date.
    if (!match || (value?.precision ?? 0) < 9) {
        return undefined;
    }
    return Number(match[1]);
}

function ids(entity: Entity, property: string): string[] {
    return (entity.claims?.[property] ?? [])
        .map((claim) => (claim.mainsnak.datavalue?.value as { id?: string } | undefined)?.id)
        .filter((id): id is string => typeof id === "string");
}

function musical(entity: Entity): boolean {
    if (!ids(entity, "P31").includes("Q5")) {
        return false;
    }
    if (ids(entity, "P106").some((id) => MUSICAL.has(id))) {
        return true;
    }
    return MUSICAL_WORDS.test(entity.descriptions?.en?.value ?? "");
}

// Wikipedia's site code for a language the site speaks: the same as the locale, but for
// Norwegian Bokmål, which Wikipedia files under "no".
const wiki = (locale: string) => `${locale === "nb" ? "no" : locale}wiki`;

async function lookup(name: string, locales: string[]): Promise<WikidataPerson | null> {
    const found = (await call({
        action: "wbsearchentities",
        search: name,
        language: "en",
        type: "item",
        limit: "6",
    })) as { search: { id: string }[] };
    if (found.search.length === 0) {
        return null;
    }
    const entities = (await call({
        action: "wbgetentities",
        ids: found.search.map((hit) => hit.id).join("|"),
        props: "claims|descriptions|sitelinks",
        languages: [...new Set([...locales, "en"])].join("|"),
        sitefilter: locales.map(wiki).join("|"),
    })) as { entities: Record<string, Entity> };
    const entity = found.search
        .map((hit) => entities.entities[hit.id])
        .find((candidate) => candidate && musical(candidate));
    if (!entity) {
        return null;
    }
    const about: Record<string, string> = {};
    const wikipedia: Record<string, string> = {};
    for (const locale of locales) {
        const description = entity.descriptions?.[locale]?.value;
        if (description) {
            about[locale] = description;
        }
        const title = entity.sitelinks?.[wiki(locale)]?.title;
        if (title) {
            wikipedia[locale] = title;
        }
    }
    const born = year(entity, "P569");
    const died = year(entity, "P570");
    return {
        id: entity.id,
        ...(born === undefined ? {} : { born }),
        ...(died === undefined ? {} : { died }),
        about,
        wikipedia,
    };
}

async function main() {
    const { locales } = JSON.parse(await readFile("project.inlang/settings.json", "utf8")) as {
        locales: string[];
    };
    const current = JSON.parse(await readFile(WIKIDATA_FILE, "utf8").catch(() => "{}")) as Record<
        string,
        WikidataPerson
    >;
    const slugs = Object.keys(PEOPLE_INDEX).sort();
    const missing: string[] = [];
    const next: Record<string, WikidataPerson> = {};
    let looked = 0;
    let cursor = 0;
    const lane = async () => {
        while (cursor < slugs.length) {
            const slug = slugs[cursor++] as string;
            if (current[slug]) {
                next[slug] = current[slug] as WikidataPerson;
                continue;
            }
            const name = PEOPLE_INDEX[slug]?.name ?? slug;
            try {
                const person = await lookup(name, locales);
                looked += 1;
                if (person) {
                    next[slug] = person;
                } else {
                    missing.push(slug);
                }
            } catch (error) {
                missing.push(`${slug} (${(error as Error).message})`);
            }
        }
    };
    await lane();
    const sorted = Object.fromEntries(Object.entries(next).sort(([a], [b]) => a.localeCompare(b)));
    await writeFile(WIKIDATA_FILE, `${JSON.stringify(sorted, null, 2)}\n`);
    console.log(
        `${WIKIDATA_FILE}: ${Object.keys(sorted).length} of ${slugs.length} composers placed (${looked} looked up).`,
    );
    if (missing.length > 0) {
        console.log(`Not placed:\n  ${missing.join("\n  ")}`);
    }
}

if (process.argv[1]?.endsWith("fetch-wikidata.mts")) {
    await main();
}
