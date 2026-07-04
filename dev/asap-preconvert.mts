// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Prepares the ASAP dataset (github.com/fosfrancesco/asap-dataset, CC-BY-NC-SA-4.0) for
// the catalogue importer. ASAP ships one plain `.musicxml` per piece with NO embedded
// title/composer — those live in metadata.csv — and the importer reads compressed `.mxl`
// with `<work-title>`/`<creator>`. So this reads each score, injects the work title and
// composer from the CSV, and writes a compressed `.mxl` into sources/asap/_mxl, which the
// `asap` source config then ingests as a `preconverted` source (the Mutopia pattern).
//
// The MusicXML notation is copied byte-for-byte — only the header identification is added
// — so nothing about the engraving changes. Run once, out-of-band:
//   ilo bash -c 'npx tsx dev/asap-preconvert.mts'

import { createReadStream } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { parse } from "csv-parse";
import { strToU8, zipSync } from "fflate";

const ROOT = "sources/asap";
const OUT = `${ROOT}/_mxl`;

// ASAP names composers by surname only; give the catalogue their full display names.
const COMPOSERS: Record<string, string> = {
    Bach: "Johann Sebastian Bach",
    Balakirev: "Mily Balakirev",
    Beethoven: "Ludwig van Beethoven",
    Brahms: "Johannes Brahms",
    Chopin: "Frédéric Chopin",
    Debussy: "Claude Debussy",
    Glinka: "Mikhail Glinka",
    Haydn: "Joseph Haydn",
    Liszt: "Franz Liszt",
    Mozart: "Wolfgang Amadeus Mozart",
    Prokofiev: "Sergei Prokofiev",
    Rachmaninoff: "Sergei Rachmaninoff",
    Ravel: "Maurice Ravel",
    Schubert: "Franz Schubert",
    Schumann: "Robert Schumann",
    Scriabin: "Alexander Scriabin",
};

const CATALOGUE = new Map([
    ["bwv", "BWV"],
    ["woo", "WoO"],
    ["hob", "Hob."],
    ["op", "Op."],
    ["no", "No."],
    ["k", "K."],
    ["d", "D."],
]);

// "Piano_Sonatas_17-1" → "Piano Sonatas No. 17, Mov. 1"; "Fugue_bwv_846" → "Fugue BWV
// 846". Underscores become spaces, catalogue abbreviations are cased, and a trailing
// work-movement pair reads as "No. N, Mov. M" for the sonata sets.
function cleanTitle(raw: string): string {
    const spaced = raw
        .replace(/_/g, " ")
        .replace(/\b([a-z]+)\b/gi, (word) => CATALOGUE.get(word.toLowerCase()) ?? word)
        .replace(/\s+/g, " ")
        .trim();
    return spaced.replace(/\b(\d+)-(\d+)\b\s*$/, "No. $1, Mov. $2");
}

const slug = (text: string): string =>
    text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

const esc = (text: string): string =>
    text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Add <work><work-title> before <identification>, and <creator type="composer"> as the
// first child of <identification> — both in MusicXML's required element order, so OSMD
// and the importer read them without disturbing the notation.
function injectHeader(xml: string, title: string, composer: string): string {
    const work = `<work><work-title>${esc(title)}</work-title></work>`;
    const creator = `<creator type="composer">${esc(composer)}</creator>`;
    if (!xml.includes("<identification")) {
        throw new Error("no <identification> block to anchor the header");
    }
    return xml
        .replace(/<identification\b[^>]*>/, (tag) => `${work}${tag}${creator}`);
}

const CONTAINER =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    "<container><rootfiles>" +
    '<rootfile full-path="score.xml" media-type="application/vnd.recordare.musicxml+xml"/>' +
    "</rootfiles></container>";

async function main() {
    const rows: Record<string, string>[] = [];
    await new Promise<void>((resolve, reject) => {
        createReadStream(`${ROOT}/metadata.csv`)
            .pipe(parse({ columns: true, skip_empty_lines: true }))
            .on("data", (row: Record<string, string>) => rows.push(row))
            .on("end", () => resolve())
            .on("error", reject);
    });

    // metadata.csv is one row per performance; collapse to one per score.
    const byScore = new Map<string, Record<string, string>>();
    for (const row of rows) {
        if (!byScore.has(row.xml_score)) {
            byScore.set(row.xml_score, row);
        }
    }

    await rm(OUT, { recursive: true, force: true });
    await mkdir(OUT, { recursive: true });

    let written = 0;
    for (const row of byScore.values()) {
        const composer = COMPOSERS[row.composer] ?? row.composer;
        const title = cleanTitle(row.title);
        const xml = await readFile(`${ROOT}/${row.xml_score}`, "utf8");
        const injected = injectHeader(xml, title, composer);
        const zip = zipSync({
            "META-INF/container.xml": strToU8(CONTAINER),
            "score.xml": strToU8(injected),
        });
        // Slug from the unique folder so every score gets a distinct file; the importer's
        // composer+title dedup then collapses the "_no_repeat" variant pairs.
        await writeFile(`${OUT}/asap-${slug(row.folder)}.mxl`, zip);
        written++;
    }
    console.log(`Wrote ${written} .mxl to ${OUT}/ (from ${byScore.size} unique scores).`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
