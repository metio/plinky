// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { afterEach, describe, expect, it } from "vitest";
import { decompressMxl } from "../../core/musicxmlFile";
import { readTimeline } from "../../core/musicxmlTimeline";

// The file reader against the engraver, on the real catalogue.
//
// The fixtures next door prove the two agree on the shapes music is made of, chosen by
// somebody who already knew what to look for. This asks a different and harder question:
// do they agree on scores nobody wrote for the test — engraved by other people's software,
// carrying whatever those tools happened to emit?
//
// That is the question worth answering before the app is moved off the engraver, because
// the failure being guarded against is precisely the one nobody thought of.
//
// Sampled rather than exhaustive: every score has to be laid out by the engraver to ask it
// anything, which is seconds each. The sample is spread across the corpus by stride rather
// than taken from the front, so it is not just the alphabetically unlucky.

const SAMPLE = 48;
// How many real scores have to be compared for the run to mean anything. The walk takes
// whatever it needs from the spread above to reach this, since most of the catalogue is
// filtered out — multi-part scores, scores that overrun their metre, scores that do not
// print every note.
const WANTED = 12;

// Scores where the two still part company after everything explained above is excluded.
// Swept across three hundred, five in about a hundred — and the ones looked at are the
// engraver's own doing, not ours. The clearest: a bar of silence written as a bare
// `<forward>`, which it gives no duration at all, so the phrase after it arrives a whole
// bar early.
//
// May only go DOWN. Raising it to make a change fit would turn the one instrument that can
// see this into a rubber stamp.
const KNOWN_DISAGREEMENTS = 3;

type Entry = { id: string; title: string; license: string };

// Scores written as a single `<part>`, which is nearly all of a piano catalogue.
//
// Multi-part scores are excluded from the strict comparison ON PURPOSE, and the reason is
// worth writing down because it is the opposite of what the exclusion looks like. Where the
// two readers differ on a two-part score, it is the ENGRAVER that is odd: given a piano
// part and another part sounding together at a barline, it hands back timestamps a tick and
// a half apart — an interval the file cannot even express at its own divisions, since a
// duration is an integer. The file says they are simultaneous, because they are. Holding
// the file reader to the engraver's answer there would be pinning it to a defect.
//
// It does mean multi-part scores are not covered by this test, and they are the shapes to
// look at hardest when the app is finally moved across.
const singlePart = (xml: string) => (xml.match(/<score-part\b/g) ?? []).length === 1;

// Whether any bar in the file writes more music than its own metre allows.
//
// Those files are excluded because the two readers differ on them ON PURPOSE. An engraving
// that puts a whole note in a two-four bar is contradicting itself — and says so, by
// winding the cursor back to the barline afterwards. The engraver believes the writing;
// this reader believes the metre, so every bar after it stays in time. Comparing them
// there would be asking whether we succeeded in not changing the thing we set out to
// change.
//
// Everywhere else the two must agree exactly, and that is what this test is for.
function overrunsItsMetre(xml: string): boolean {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
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

// Whether the file writes a note the engraving does not print.
//
// `print-object="no"` hides a NOTEHEAD, not the note: the element still carries a pitch and
// a duration, and the voice around it is written as if it sounds. Those files are excluded
// because the two readers differ on them ON PURPOSE — the engraver drops such a note
// altogether, so a voice that opens with one loses its first sound while every later note
// of the same voice stays exactly where the file put it, which is what proves the timing was
// never in question. Two shapes in the catalogue are written this way: an invisible pickup
// note opening a hidden voice (`ND7ZZAi5ZX4v`, bar 23 — an invisible B3 opens voice 5, and
// A3, B3, C#4, D4 after it land on the engraver's own onsets), and a tremolo spelled as a
// hidden tied voice (`73zyXPKTyvZj`, bar 5). The file reader sounds what the file writes.
const printsEveryNote = (xml: string) => !/<note\b[^>]*print-object="no"/.test(xml);

let host: HTMLDivElement | null = null;

afterEach(() => {
    host?.remove();
    host = null;
});

// A score's file sits under its licence, which is how the catalogue keeps every piece next
// to the terms it came with.
async function xmlFor(entry: Entry): Promise<string | null> {
    const response = await fetch(`/songs/${entry.license.toLowerCase()}/${entry.id}.mxl`);
    if (!response.ok) {
        return null;
    }
    return decompressMxl(new Uint8Array(await response.arrayBuffer()));
}

async function engrave(xml: string): Promise<OpenSheetMusicDisplay> {
    host = document.createElement("div");
    host.style.width = "900px";
    document.body.appendChild(host);
    const osmd = new OpenSheetMusicDisplay(host, { drawingParameters: "compact" });
    await osmd.load(xml);
    osmd.render();
    return osmd;
}

// Onset → the pitches sounding there, as the engraver walks it. Printed order, since the
// file reader reads printed order; the repeat expansion is compared separately.
function throughOsmd(osmd: OpenSheetMusicDisplay): string[] {
    const cursor = osmd.cursor;
    cursor.reset();
    const seen: string[] = [];
    const visited = new Set<number>();
    while (!cursor.iterator.EndReached) {
        const whole = round(cursor.iterator.currentTimeStamp?.RealValue ?? 0);
        const pitches = cursor
            .NotesUnderCursor()
            .filter((one) => !one.isRest() && one.halfTone > 0)
            .map((one) => one.halfTone + 12)
            .sort((a, b) => a - b);
        // A repeat brings the cursor back over onsets it has already passed; the printed
        // position is the same one, so it is counted once.
        if (pitches.length > 0 && !visited.has(whole)) {
            visited.add(whole);
            seen.push(`${whole}:${pitches.join(",")}`);
        }
        cursor.next();
    }
    cursor.reset();
    return seen;
}

function throughFile(xml: string): string[] {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    const byOnset = new Map<number, number[]>();
    for (const note of readTimeline(doc).notes) {
        // Grace notes are NOT skipped. The engraver's cursor stops once on the position and
        // hands back the ornament together with the note it decorates, so a comparison that
        // dropped them on one side only would report a difference that is the test's.
        if (note.midi === null) {
            continue;
        }
        const key = round(note.whole);
        byOnset.set(key, [...(byOnset.get(key) ?? []), note.midi]);
    }
    return [...byOnset.entries()]
        .sort((one, other) => one[0] - other[0])
        .map(([whole, pitches]) => `${whole}:${[...pitches].sort((a, b) => a - b).join(",")}`);
}

// Onsets are compared to the nearest thousandth of a whole note — a hundred and
// twentieth of a crotchet, far finer than any notation, and coarse enough that the two
// readers' floating-point arithmetic arriving at the same place by different routes does
// not read as a disagreement.
const round = (value: number) => Math.round(value * 1000) / 1000;

describe("the file reader on the real catalogue", () => {
    it("reads the same notes as the engraver, on scores nobody wrote for this test", async () => {
        const manifest: Entry[] = await (await fetch("/songs/manifest.json")).json();
        expect(manifest.length).toBeGreaterThan(0);
        // Spread across the whole catalogue rather than taken from the front, so the sample
        // is not all one corpus — the manifest is grouped by where the scores came from.
        const stride = Math.max(1, Math.floor(manifest.length / SAMPLE));
        const spread = manifest.filter((_, index) => index % stride === 0);

        const disagreements: string[] = [];
        let compared = 0;
        for (const entry of spread) {
            // Enough real scores have been through, so stop walking. Taking a fixed slice
            // and hoping enough of it survived the filter made the test depend on exactly
            // which pieces the stride happened to land on: a catalogue import that added or
            // removed two songs shifted every one of them, and the count came out one under
            // the floor with nothing about the reader having changed.
            if (compared >= WANTED) {
                break;
            }
            const xml = await xmlFor(entry);
            if (!xml || !singlePart(xml) || overrunsItsMetre(xml) || !printsEveryNote(xml)) {
                continue;
            }
            const osmd = await engrave(xml);
            const theirs = throughOsmd(osmd);
            const mine = throughFile(xml);
            host?.remove();
            host = null;
            compared += 1;
            if (mine.join("|") !== theirs.join("|")) {
                // Report the first place they part company, which is what a fix needs.
                const at = mine.findIndex((one, index) => one !== theirs[index]);
                // The neighbourhood, not just the first difference: what a disagreement
                // usually means is that one side placed something a beat away, and the
                // single differing entry never shows that.
                const around = (list: string[]) =>
                    list.slice(Math.max(0, at - 2), at + 3).join(" ");
                disagreements.push(
                    `${entry.id} (${entry.title}) at ${at} of ${mine.length}/${theirs.length}\n      file: ${around(mine)}\n  engraver: ${around(theirs)}`,
                );
            }
        }

        // Enough real scores were actually compared to mean something. The walk stops as
        // soon as this is reached, so it fails only if the catalogue genuinely cannot supply
        // that many readable single-part scores — never because of where a stride fell.
        expect(compared).toBeGreaterThanOrEqual(WANTED);

        // A ratchet, not a clean bill of health. The reader does NOT yet agree with the
        // engraver on every real score, and this is the thing that says so — the fixtures
        // next door all pass, because a fixture only contains what its author already knew
        // to put in it.
        //
        // What is still out, from a sweep of three hundred: some measures carry the music
        // on further than the engraver thinks they do, so everything after them runs late
        // — an overfilled bar, most likely, though clamping to the time signature made it
        // worse rather than better and the real rule is not yet known. Until that is
        // understood the app stays on the engraver.
        //
        // Named in the output before the ratchet is checked, so a run that trips it says
        // WHICH scores parted company rather than only how many.
        if (disagreements.length > 0) {
            console.info(`file-vs-engraver, ${compared} scores:\n${disagreements.join("\n")}`);
        }

        // The number may only go DOWN. Raising it to make a change fit would be turning
        // the one instrument that can see this problem into a rubber stamp.
        expect(disagreements.length).toBeLessThanOrEqual(KNOWN_DISAGREEMENTS);
    }, 600_000);
});
