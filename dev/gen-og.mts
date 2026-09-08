// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Paints the card every piece's link unfurls as — build/client/og/<id>.png, one per piece
// the catalogue holds, from core/ogCard — with the same headless browser and the same
// palette and faces the site's own card comes out of (dev/build-icons.mjs).
//
// Runs once per deploy, in the root build, not per language: the card is language-neutral,
// and a picture painted twenty-six times is the same picture. Three thousand renders take a
// few minutes; PLINKY_OG_LIMIT caps the count for a smoke run.
//
// The count matters for a reason beyond time. Cloudflare Pages holds at most twenty
// thousand files in a deployment, the site's pages in twenty-six languages are about
// eleven thousand of them, and every card is one more — dev/check-deploy-files.mjs is
// what says when that stops adding up.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { canonicalPeople } from "../core/person.ts";
import { decodeIncipit, type Incipit, readIncipit } from "../core/incipit.ts";
import {
    CARD_HEIGHT,
    CARD_WIDTH,
    type PieceCard,
    personCardHtml,
    pieceCardHtml,
} from "../core/ogCard.ts";
import { PEOPLE_INDEX } from "../core/peopleIndex.ts";
import { lifespan } from "../core/personAbout.ts";
import { readScoreMetaFromText } from "../core/scoreMeta.ts";
import { songId } from "../core/songId.ts";
import { tokenValue } from "./brandTokens.mjs";
import { linkedomXmlCodec } from "./linkedomXmlCodec.mts";
import { readExercisesSync, readSongsSync } from "./manifest.mts";

const OUT = "build/client/og";
// What Wikidata says about each composer, the same file the composer pages read.
const WIKIDATA = "dev/people-wikidata.json";
const BUNDLED = "scores";

export type CardJob = PieceCard & { id: string };

// Every piece a card is painted for: the songs and studies of the shipped manifests, with
// the mark each carries, and the bundled pieces, whose mark is read from their notation.
export function cardJobs(): CardJob[] {
    const jobs: CardJob[] = [];
    const seen = new Set<string>();
    const add = (id: string, title: string, composer: string, incipit: Incipit | null) => {
        if (seen.has(id)) {
            return;
        }
        seen.add(id);
        jobs.push({ id, title, composer: canonicalPeople(composer).join(", "), incipit });
    };
    for (const row of [...readSongsSync(), ...readExercisesSync()]) {
        add(row.id, row.title, row.composer ?? "", row.incipit ? decodeIncipit(row.incipit) : null);
    }
    for (const name of readdirSync(BUNDLED).filter((file) => file.endsWith(".musicxml"))) {
        const xml = readFileSync(`${BUNDLED}/${name}`, "utf8");
        const meta = readScoreMetaFromText(xml);
        add(songId(xml), meta.title, meta.composer, readIncipit(linkedomXmlCodec, xml));
    }
    return jobs.sort((a, b) => a.id.localeCompare(b.id));
}

// One card per composer. The line under the name is the base language's, because a card is
// one image for every language the page is read in — the same bargain the piece cards
// make, and the name is the same word everywhere regardless.
export type PersonJob = { slug: string; name: string; line: string; pieces: string };

export function personJobs(): PersonJob[] {
    const about = JSON.parse(readFileSync(WIKIDATA, "utf8")) as Record<
        string,
        { born?: number; died?: number; about?: Record<string, string> }
    >;
    return Object.entries(PEOPLE_INDEX)
        .map(([slug, entry]) => {
            const found = about[slug];
            const years = lifespan(
                { born: found?.born, died: found?.died },
                { born: (year) => `born ${year}`, died: (year) => `died ${year}` },
            );
            const said = found?.about?.en ?? "";
            return {
                slug,
                name: entry.name,
                line: said && years ? `${said} (${years})` : said || years,
                pieces: entry.pieces === 1 ? "1 piece" : `${entry.pieces} pieces`,
            };
        })
        .sort((a, b) => a.slug.localeCompare(b.slug));
}

async function main() {
    const css = readFileSync("app/app.css", "utf8");
    const palette = {
        paper: tokenValue(css, "", "--color-surface"),
        ink: tokenValue(css, "", "--color-ink"),
        muted: tokenValue(css, "", "--color-muted"),
        accent: tokenValue(css, "", "--color-accent-solid"),
    };
    const host = new URL(
        readFileSync("core/site.ts", "utf8").match(/SITE_URL\s*=\s*"([^"]+)"/)?.[1] ?? "",
    ).host;
    const mark = `data:image/png;base64,${readFileSync("brand/plinky-icon.png").toString("base64")}`;
    // The faces travel with the page: a headless browser has neither installed. Latin
    // only, as the site's own card — a title in another script falls to the system face.
    const font = (path: string) =>
        `url(data:font/woff2;base64,${readFileSync(path).toString("base64")}) format("woff2-variations")`;
    const faces =
        `@font-face{font-family:"Fredoka Variable";src:${font("node_modules/@fontsource-variable/fredoka/files/fredoka-latin-wght-normal.woff2")};font-weight:300 700;font-display:block}` +
        `@font-face{font-family:"Inter Variable";src:${font("node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2")};font-weight:100 900;font-display:block}`;
    const fonts = {
        display:
            "font-family:'Fredoka Variable',Fredoka,ui-rounded,system-ui,sans-serif;font-variation-settings:'wght' 600",
        body: "font-family:'Inter Variable',Inter,system-ui,sans-serif;font-variation-settings:'wght' 500",
    };

    const limit = Number(process.env.PLINKY_OG_LIMIT ?? 0);
    const jobs = limit > 0 ? cardJobs().slice(0, limit) : cardJobs();
    mkdirSync(OUT, { recursive: true });
    const pending = jobs.filter((job) => !existsSync(`${OUT}/${job.id}.png`));

    const browser = await chromium.launch();
    // A few pages painting at once: each render is mostly the browser laying out one
    // card, and four in flight keeps a runner busy without starving it.
    const LANES = 4;
    let next = 0;
    let painted = 0;
    const lane = async () => {
        const page = await browser.newPage({
            viewport: { width: CARD_WIDTH, height: CARD_HEIGHT },
            deviceScaleFactor: 1,
        });
        while (next < pending.length) {
            const job = pending[next++] as CardJob;
            await page.setContent(
                `<style>${faces}html,body{margin:0;padding:0}</style>${pieceCardHtml(job, { palette, fonts, mark, host })}`,
            );
            await page.evaluate(() => document.fonts.ready);
            const png = await page.screenshot({ type: "png" });
            writeFileSync(`${OUT}/${job.id}.png`, png);
            painted += 1;
        }
        await page.close();
    };
    await Promise.all(Array.from({ length: LANES }, lane));

    // And one per composer, into a folder of their own so a slug can never collide with a
    // piece id.
    const people = limit > 0 ? personJobs().slice(0, limit) : personJobs();
    mkdirSync(`${OUT}/person`, { recursive: true });
    const waiting = people.filter((job) => !existsSync(`${OUT}/person/${job.slug}.png`));
    let faces_painted = 0;
    let after = 0;
    const personLane = async () => {
        const page = await browser.newPage({
            viewport: { width: CARD_WIDTH, height: CARD_HEIGHT },
            deviceScaleFactor: 1,
        });
        while (after < waiting.length) {
            const job = waiting[after++] as PersonJob;
            await page.setContent(
                `<style>${faces}html,body{margin:0;padding:0}</style>${personCardHtml(job, { palette, fonts, mark, host })}`,
            );
            await page.evaluate(() => document.fonts.ready);
            writeFileSync(`${OUT}/person/${job.slug}.png`, await page.screenshot({ type: "png" }));
            faces_painted += 1;
        }
        await page.close();
    };
    await Promise.all(Array.from({ length: LANES }, personLane));
    await browser.close();
    console.log(
        `${OUT}: ${painted} of ${jobs.length} piece card(s) painted, ` +
            `${faces_painted} of ${people.length} composer card(s).`,
    );
}

if (process.argv[1]?.endsWith("gen-og.mts")) {
    await main();
}
