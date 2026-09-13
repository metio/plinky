// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The two things `npm run songs:bake` verifies before it derives anything, kept apart from
// the command that runs them so they can be tested without baking the catalogue.
//
// Both answer the same question from opposite ends: does what the manifests store still
// come from the models that are in the tree? Cost comes from the difficulty model, and so
// does what each easier reduction of a piece costs; the incipit comes from its encoder,
// and the scale and arpeggio grades from boundaries that do not
// follow either. Every one of them is a number somebody could change without touching the
// catalogue, and grades derived from stale ones are wrong in a way nothing downstream sees.

import { readFile } from "node:fs/promises";
import { staffCount } from "../core/accompaniment.ts";
import { encodeIncipit, readIncipit } from "../core/incipit.ts";
import type { ReductionCosts } from "../core/reach.ts";
import { rawDifficulty } from "../core/scoreDifficulty.ts";
import { linkedomXmlCodec } from "./linkedomXmlCodec.mts";
import { scorePath } from "./manifest.mts";
import { reductionCosts } from "./measureReach.mts";

const _SONGS = "public/songs";

export type ProbeSong = {
    id: string;
    cost: number;
    license?: string;
    title?: string;
    incipit?: string;
    scoreKind?: string;
    reachCost?: ReductionCosts;
};

// The share of one category's tiles that may sit in a single grade before the boundaries
// are judged to have stopped separating them. Set loosely: an uneven curriculum is normal,
// a collapsed one is a broken scale.
const CROWDED_SHARE = 0.5;

// The category whose tiles have collapsed into one grade, described; null when each
// category is still spread.
export function crowdedGrade(exercises: { kind: string; grade: number }[]): string | null {
    const tiles = exercises.filter((entry) => entry.kind === "scale-arpeggio");
    if (tiles.length === 0) {
        return null;
    }
    const perGrade = new Map<number, number>();
    for (const tile of tiles) {
        perGrade.set(tile.grade, (perGrade.get(tile.grade) ?? 0) + 1);
    }
    for (const [grade, count] of perGrade) {
        if (count > tiles.length * CROWDED_SHARE) {
            return `${count} of ${tiles.length} scale, arpeggio and chord tiles are grade ${grade}`;
        }
    }
    return null;
}

// How many songs to re-derive, spread across the catalogue, as a check that what the
// manifest stores still comes from the current models — the difficulty model for cost, the
// encoder for the incipit. The exercises are re-derived outright because they are few; the
// songs only have to be caught, in seconds rather than the half-hour re-deriving three
// thousand scores takes.
const SONG_PROBES = 24;

// The staves each part of a score is written on, in score order — "2" for a grand staff,
// "1,2" for a song over its piano, "1,1" for a piano written as two parts. Read off the
// text, since parsing every score in the catalogue to choose a handful of probes would
// cost what the probes exist to save. It mirrors stavesPerPart in core/accompaniment.ts,
// which the test holds it to.
export function layoutOf(xml: string): string {
    // A score written measure by measure nests its parts inside each measure, where the
    // model reads no part at all.
    if (xml.includes("<score-timewise")) {
        return "";
    }
    const counts: number[] = [];
    const opening = /<part[\s>]/g;
    for (let found = opening.exec(xml); found !== null; found = opening.exec(xml)) {
        const end = xml.indexOf("</part>", found.index);
        const body = xml.slice(found.index, end === -1 ? undefined : end);
        counts.push(staffCount(/<staves>\s*(\d+)\s*<\/staves>/.exec(body)?.[1]));
        opening.lastIndex = end === -1 ? xml.length : end;
    }
    return counts.join(",");
}

// How a score's bars are filled, read off the text like its layout, as flags joined by "+":
//
// - `backup`: some bar writes a second voice, rewinding to write it.
// - `short`: some bar's last voice stops before the point it rewound from, so the bar's end
//   is set by an earlier voice.
// - `overrun`: some bar's content runs past what its time signature holds.
// - `timewise`: the score is written measure by measure, parts inside each measure.
//
// A model change can be confined to one of these ways of writing inside one layout — a
// bar cursor that drifted after short voices once did, in 7% of the catalogue, while every
// probe was a score without one.
export function shapeOf(xml: string): string {
    if (xml.includes("<score-timewise")) {
        return "timewise";
    }
    const flags = new Set<string>();
    let divisions = 1;
    let beats = Number.NaN;
    let beatType = Number.NaN;
    let cursor = 0;
    let furthest = 0;
    let rewoundFrom: number | null = null;
    const token =
        /<(note|backup|forward)(?=[\s>])[^>]*>([\s\S]*?)<\/\1>|<divisions>\s*(\d+)\s*<\/divisions>|<beats>\s*([^<]*?)\s*<\/beats>|<beat-type>\s*(\d+)\s*<\/beat-type>|<\/measure>/g;
    for (let found = token.exec(xml); found !== null; found = token.exec(xml)) {
        const [whole, kind, body = "", division, beatCount, beatUnit] = found;
        if (division !== undefined) {
            divisions = Number(division);
        } else if (beatCount !== undefined) {
            beats = Number(beatCount);
        } else if (beatUnit !== undefined) {
            beatType = Number(beatUnit);
        } else if (whole === "</measure>") {
            if (rewoundFrom !== null && cursor < rewoundFrom) {
                flags.add("short");
            }
            if (furthest > (divisions * beats * 4) / beatType) {
                flags.add("overrun");
            }
            cursor = 0;
            furthest = 0;
            rewoundFrom = null;
        } else {
            const duration = Number(/<duration>\s*(\d+)/.exec(body)?.[1] ?? 0);
            if (kind === "backup") {
                flags.add("backup");
                rewoundFrom = cursor;
                cursor = Math.max(0, cursor - duration);
            } else if (kind === "forward" || !/<(chord|grace)\b/.test(body)) {
                cursor += duration;
                furthest = Math.max(furthest, cursor);
            }
        }
    }
    return [...flags].sort().join("+");
}

// What a row is probed as one of: its layout and the shape of its bars.
export const probeKey = (xml: string): string => `${layoutOf(xml)}|${shapeOf(xml)}`;

// Pieces always probed, whatever the spread lands on: each is one a fix to the difficulty
// model was measured on, so it shows a way of writing the spread may never reach. The check
// fails when one leaves the manifest, so the list cannot rot into probing nothing.
export const SENTINELS: readonly { id: string; why: string }[] = [
    {
        id: "vzfT922I6Vrm",
        why: "Mozart K. 331, Var. 4: the left hand's crossing thirds written on the treble staff",
    },
    {
        id: "68lEifITMAeN",
        why: "Giovannelli, Jesu sole serenior: a voice stopping short of the barline, two voices wider than a hand on one staff",
    },
    {
        id: "gzlIQOu192mh",
        why: "Anerio, Iesu decus angelicum: a voice stopping short of the barline, two voices wider than a hand on one staff",
    },
    {
        id: "P427uVDpAkpc",
        why: "Sermisy, J'attends secours: two voices wider than a hand on one staff while the other rests",
    },
    {
        id: "pTzDUQYLzd1A",
        why: "Liszt, Consolation No. 1: a piano written as two parts, one per hand, whose bars must stay together",
    },
];

// The first sentinel the manifest no longer holds, described; null when all are there.
export function missingSentinel(
    songs: readonly { id: string }[],
    sentinels: readonly { id: string; why: string }[] = SENTINELS,
): string | null {
    const held = new Set(songs.map((song) => song.id));
    const gone = sentinels.find((sentinel) => !held.has(sentinel.id));
    return gone === undefined
        ? null
        : `the probed sentinel ${gone.id} (${gone.why}) is no longer in the manifest — replace it in SENTINELS (dev/bakeChecks.mts) with a piece that shows the same thing`;
}

// Which rows to re-derive, by index, given each row's probe key: a spread across the
// catalogue, and then the first row of every key the spread did not reach. A model change
// can be confined to one way of writing a score, so each layout and shape of bar the
// catalogue holds gets a probe beside the spread. The keys only choose which rows are
// probed, so a misread one can make the spread less varied but never a verdict wrong.
export function probeIndices(layouts: readonly string[]): number[] {
    const chosen = new Set<number>();
    const step = Math.max(1, Math.floor(layouts.length / SONG_PROBES));
    for (let i = 0; i < layouts.length; i += step) {
        chosen.add(i);
    }
    const reached = new Set([...chosen].map((index) => layouts[index]));
    for (const [index, layout] of layouts.entries()) {
        if (!reached.has(layout)) {
            reached.add(layout);
            chosen.add(index);
        }
    }
    return [...chosen].sort((a, b) => a - b);
}

// A song's shipped score, or what stands in the way of reading it.
export type ShippedScore = { xml: string } | { problem: "missing" | "unreadable" };

export async function shippedScore(song: ProbeSong): Promise<ShippedScore> {
    const { decompressMxl } = await import("../core/musicxmlFile.ts");
    const path = scorePath(song.id, song.license);
    const bytes = path === null ? null : await readFile(path).catch(() => null);
    if (!bytes) {
        return { problem: "missing" };
    }
    const xml = decompressMxl(new Uint8Array(bytes));
    return xml ? { xml } : { problem: "unreadable" };
}

// What the models in the tree make of a score: the cost the manifest stores, rounded as
// it is stored, the incipit, and for solo piano what each easier reduction costs. A score
// whose opening cannot be read has no incipit, legitimately.
export type Measured = { cost: number; incipit: string | undefined; reachCost?: ReductionCosts };

export function currentMeasure(xml: string, song?: ProbeSong): Measured {
    const opening = readIncipit(linkedomXmlCodec, xml);
    const cost = Number(rawDifficulty(linkedomXmlCodec, xml).toFixed(3));
    return {
        cost,
        incipit: opening === null ? undefined : encodeIncipit(opening),
        reachCost:
            song?.scoreKind === "solo-piano"
                ? reductionCosts(linkedomXmlCodec, song.id, xml, cost)
                : {},
    };
}

// Re-derives the probed songs and names the first whose stored values no longer match.
// Null when the manifest is current. Every score is read, to learn its layout, so a row
// naming a score that is not shipped or cannot be read is named wherever it stands: a row
// the app cannot open is a problem, not a probe to skip. Only its layout is kept from that
// pass, and a probed score is read again to be measured, so the check holds one score at a
// time rather than the whole catalogue's text.
export async function staleSong(
    songs: ProbeSong[],
    read: (song: ProbeSong) => Promise<ShippedScore> = shippedScore,
    measure: (xml: string, song: ProbeSong) => Measured = currentMeasure,
    always: readonly string[] = [],
): Promise<string | null> {
    const keys: string[] = [];
    for (const song of songs) {
        const score = await read(song);
        if ("problem" in score) {
            return unopenable(song, score.problem);
        }
        keys.push(probeKey(score.xml));
    }
    const pinned = songs.flatMap((song, index) => (always.includes(song.id) ? [index] : []));
    const probes = [...new Set([...probeIndices(keys), ...pinned])].sort((a, b) => a - b);
    for (const index of probes) {
        const song = songs[index]!;
        const score = await read(song);
        if ("problem" in score) {
            return unopenable(song, score.problem);
        }
        const named = song.title ?? song.id;
        const fresh = measure(score.xml, song);
        if (fresh.cost !== song.cost) {
            return `${named} is stored at cost ${song.cost} but measures ${fresh.cost} — run \`npm run songs:cost\``;
        }
        // The ways in are graded off these, so a stale one is a stale way-in grade.
        if (JSON.stringify(fresh.reachCost ?? {}) !== JSON.stringify(song.reachCost ?? {})) {
            return `${named} stores what its easier reductions cost as ${JSON.stringify(song.reachCost ?? {})} but they measure ${JSON.stringify(fresh.reachCost ?? {})} — run \`npm run songs:cost\``;
        }
        // Absence is only wrong when the encoder does produce an incipit.
        if (fresh.incipit !== song.incipit) {
            return `${named} carries an incipit the encoder no longer produces — run \`npm run songs:incipits\``;
        }
    }
    return null;
}

function unopenable(song: ProbeSong, problem: "missing" | "unreadable"): string {
    const named = song.title ?? song.id;
    return problem === "missing"
        ? `${named} (${song.id}) has no .mxl under public/songs — the manifest names a score that is not shipped`
        : `${named} (${song.id}) has an .mxl that cannot be read`;
}
