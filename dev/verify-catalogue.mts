// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reads every score in the catalogue with the file reader and reports what it finds.
//
// The differential test next to the reader asks whether it agrees with the engraver, on a
// sample, because asking that costs an engraving per score. This asks a cheaper and wider
// question — does the reader cope with all of it — and can therefore ask it of everything.
//
// What it is looking for is not disagreement but nonsense: a score that throws, one that
// reads as silent, onsets that run backwards or arrive as NaN. Those are the failures that
// would reach a player as a piece that will not open or will not keep time, and a sample
// cannot promise their absence.
//
//   nix develop --command npx tsx dev/verify-catalogue.mts

import { readdirSync, readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { decompressMxl } from "../core/musicxmlFile";
import { readDirections, readFifths, slurSpans } from "../core/musicxmlMarks";
import { performanceOrder, readMeasureRepeats } from "../core/musicxmlRepeats";
import { readTimeline } from "../core/musicxmlTimeline";

const ROOTS = ["public/songs", "public/exercises/studies"];

function scores(): string[] {
    const found: string[] = [];
    for (const root of ROOTS) {
        for (const entry of readdirSync(root, { withFileTypes: true })) {
            if (entry.isDirectory()) {
                for (const file of readdirSync(`${root}/${entry.name}`)) {
                    if (file.endsWith(".mxl")) {
                        found.push(`${root}/${entry.name}/${file}`);
                    }
                }
            } else if (entry.name.endsWith(".mxl")) {
                found.push(`${root}/${entry.name}`);
            }
        }
    }
    return found.sort();
}

const parser = new new JSDOM().window.DOMParser();

type Problem = { path: string; kind: string; detail: string };
const problems: Problem[] = [];
const note = (path: string, kind: string, detail = "") =>
    problems.push({ path, kind, detail });

let read = 0;
let notes = 0;
let withRepeats = 0;
let multiPart = 0;
let overrunning = 0;

const all = scores();
console.log(`scores to read: ${all.length}`);
let index = 0;
for (const path of all) {
    if (++index % 250 === 0) {
        console.log(`  ...${index}/${all.length}`);
    }
    let xml: string | null = null;
    try {
        xml = decompressMxl(new Uint8Array(readFileSync(path)));
    } catch (error) {
        note(path, "unreadable", (error as Error).message.slice(0, 80));
        continue;
    }
    if (!xml) {
        note(path, "not-musicxml");
        continue;
    }
    try {
        const doc = parser.parseFromString(xml, "application/xml");
        const timeline = readTimeline(doc);
        const directions = readDirections(timeline);
        const slurs = slurSpans(timeline.notes);
        const order = performanceOrder(readMeasureRepeats(doc));
        readFifths(doc);

        read += 1;
        notes += timeline.notes.length;
        if ((xml.match(/<score-part\b/g) ?? []).length > 1) {
            multiPart += 1;
        }
        if (order.length > timeline.measureStarts.length) {
            withRepeats += 1;
        }
        if (timeline.notes.length > 0 && (xml.match(/<repeat\b/g) ?? []).length === 0) {
            // nothing to check
        }

        // A score nothing sounds in cannot be practised, whatever else is true of it.
        if (!timeline.notes.some((one) => one.midi !== null)) {
            note(path, "silent");
        }
        // Onsets must run forward and be real numbers. Either failing means the piece
        // cannot be placed in time at all.
        let previous = Number.NEGATIVE_INFINITY;
        for (const one of timeline.notes) {
            if (!Number.isFinite(one.whole) || !Number.isFinite(one.wholes)) {
                note(path, "onset-not-a-number", `${one.whole}/${one.wholes}`);
                break;
            }
            if (one.whole < previous - 1e-9) {
                note(path, "onset-goes-backwards", `${previous} then ${one.whole}`);
                break;
            }
            if (one.midi !== null && (one.midi < 0 || one.midi > 127)) {
                note(path, "pitch-out-of-range", String(one.midi));
                break;
            }
            previous = one.whole;
        }
        for (const span of [...slurs, ...directions.pedals, ...directions.octaveShifts]) {
            if (!Number.isFinite(span.from) || !Number.isFinite(span.to) || span.to < span.from) {
                note(path, "span-inverted", `${span.from}..${span.to}`);
                break;
            }
        }
        if (order.length === 0 && timeline.measureStarts.length > 0) {
            note(path, "plays-no-measures");
        }
        // A bar that writes more than its metre allows: read deliberately differently from
        // the engraver, counted here so the size of that decision is known rather than
        // guessed at.
        if (overruns(doc)) {
            overrunning += 1;
        }
    } catch (error) {
        note(path, "threw", (error as Error).message.slice(0, 120));
    }
}

function overruns(doc: Document): boolean {
    let divisions = 1;
    let bar: number | null = null;
    for (const measure of Array.from(doc.getElementsByTagName("measure"))) {
        const declared = measure.getElementsByTagName("divisions")[0]?.textContent;
        if (declared) {
            divisions = Math.max(1, Number(declared) || divisions);
        }
        const time = measure.getElementsByTagName("time")[0];
        if (time) {
            const beats = Number(time.getElementsByTagName("beats")[0]?.textContent ?? 0);
            const beatType = Number(time.getElementsByTagName("beat-type")[0]?.textContent ?? 0);
            bar = beats > 0 && beatType > 0 ? beats / beatType : bar;
        }
        if (bar === null) {
            continue;
        }
        let at = 0;
        let furthest = 0;
        for (const element of Array.from(measure.children)) {
            const duration = Number(element.getElementsByTagName("duration")[0]?.textContent ?? 0);
            if (element.tagName === "backup") {
                at = Math.max(0, at - duration);
            } else if (element.tagName === "forward") {
                at += duration;
                furthest = Math.max(furthest, at);
            } else if (
                element.tagName === "note" &&
                element.getElementsByTagName("chord").length === 0 &&
                element.getElementsByTagName("grace").length === 0
            ) {
                at += duration;
                furthest = Math.max(furthest, at);
            }
        }
        if (furthest / (divisions * 4) > bar + 1e-9) {
            return true;
        }
    }
    return false;
}

const byKind = new Map<string, Problem[]>();
for (const problem of problems) {
    byKind.set(problem.kind, [...(byKind.get(problem.kind) ?? []), problem]);
}

console.log(`read ${read} scores, ${notes} notes`);
console.log(`  multi-part: ${multiPart}`);
console.log(`  with repeats that revisit measures: ${withRepeats}`);
console.log(`  containing a bar that overruns its metre: ${overrunning}`);
console.log(problems.length === 0 ? "no problems" : `${problems.length} problems:`);
for (const [kind, found] of [...byKind].sort((one, other) => other[1].length - one[1].length)) {
    console.log(`  ${kind}: ${found.length}`);
    for (const one of found.slice(0, 4)) {
        console.log(`     ${one.path} ${one.detail}`);
    }
}
process.exit(problems.length === 0 ? 0 : 1);
