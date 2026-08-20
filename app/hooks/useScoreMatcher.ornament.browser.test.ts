// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { afterEach, describe, expect, it } from "vitest";
import { collectListenSteps } from "./useListenPlayback";
import { readKeyFifths, readOrnament } from "../lib/scoreExpression";

// Ornaments and the key they reach into, read off a live engraving.
//
// Both readings are contracts with OSMD that no fixture can stand in for. The ornament
// arrives as a bare number on a container the bundle does not export a type for, and the
// key signature is found by the shape of its data because every class in the shipped
// bundle is minified to a single letter. If either drifts, the score still plays — just
// without its ornaments, or with every one of them reaching for the wrong note. That is
// the silent kind of wrong this file exists to catch.

const attr = (fifths: number) =>
    `<attributes><divisions>4</divisions><key><fifths>${fifths}</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>`;

const ornamented = (step: string, octave: number, kind: string) =>
    `<note><pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type><notations><ornaments><${kind}/></ornaments></notations></note>`;

const plain = (step: string, octave: number) =>
    `<note><pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>4</duration><voice>1</voice><type>quarter</type></note>`;

const score = (measures: string) => `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">${measures}</part></score-partwise>`;

let host: HTMLDivElement | null = null;

function load(xml: string): Promise<OpenSheetMusicDisplay> {
    host = document.createElement("div");
    host.style.width = "800px";
    document.body.appendChild(host);
    const osmd = new OpenSheetMusicDisplay(host, { drawingParameters: "compact" });
    return osmd.load(xml).then(() => {
        osmd.render();
        return osmd;
    });
}

const kindsUnderCursor = (osmd: OpenSheetMusicDisplay) => {
    const cursor = osmd.cursor;
    cursor.reset();
    const found: (string | null)[] = [];
    while (!cursor.iterator.EndReached) {
        found.push(readOrnament(cursor.NotesUnderCursor()[0]));
        cursor.next();
    }
    cursor.reset();
    return found;
};

afterEach(() => {
    host?.remove();
    host = null;
});

describe("a score with ornaments over its notes", () => {
    it("tells one little sign from another", () => {
        // The values are bare numbers off a minified container: this is the whole contract.
        return load(
            score(
                `<measure number="1">${attr(0)}${ornamented("C", 5, "trill-mark")}${ornamented(
                    "C",
                    5,
                    "mordent",
                )}${ornamented("C", 5, "turn")}${plain("D", 5)}</measure>`,
            ),
        ).then((osmd) => {
            expect(kindsUnderCursor(osmd)).toEqual(["trill", "mordent", "turn", null]);
        });
    });

    it("reads the key signature, sharps and flats alike", () => {
        return Promise.all([
            load(score(`<measure number="1">${attr(3)}${plain("C", 5)}</measure>`)).then((osmd) => {
                expect(readKeyFifths(osmd)).toBe(3);
                host?.remove();
            }),
        ]).then(() =>
            load(score(`<measure number="1">${attr(-3)}${plain("C", 5)}</measure>`)).then(
                (osmd) => {
                    expect(readKeyFifths(osmd)).toBe(-3);
                },
            ),
        );
    });

    it("reads a score with no signature as C major rather than as nothing", () => {
        return load(score(`<measure number="1">${attr(0)}${plain("C", 5)}</measure>`)).then(
            (osmd) => {
                expect(readKeyFifths(osmd)).toBe(0);
            },
        );
    });

    it("plays the figure in place of the note, in the key it is written in", () => {
        // E flat major: the note below C is B flat. A mordent that reached a fixed distance
        // down would sound a B natural, which is not in the piece at all.
        return load(
            score(
                `<measure number="1">${attr(-3)}${ornamented("C", 5, "mordent")}${plain("D", 5)}</measure>`,
            ),
        ).then((osmd) => {
            const steps = collectListenSteps(osmd);
            const sounded = steps.flatMap((step) => step.notes.map((note) => note.pitch));
            // C5, B flat 4, C5 — then the plain D.
            expect(sounded).toEqual([72, 70, 72, 74]);
        });
    });

    it("keeps the cursor on the note the sign is printed over", () => {
        // The figure is several positions, and the eye should stay where the notation is.
        return load(
            score(
                `<measure number="1">${attr(0)}${ornamented("C", 5, "turn")}${plain("D", 5)}</measure>`,
            ),
        ).then((osmd) => {
            const steps = collectListenSteps(osmd);
            const figure = steps.filter((step) => step.whole === 0);
            expect(figure.length).toBeGreaterThan(1);
            expect(figure.slice(0, -1).every((step) => !step.advancesCursor)).toBe(true);
            expect(figure.at(-1)?.advancesCursor).toBe(true);
        });
    });

    it("spends exactly the written note's time on the figure", () => {
        // A figure that ran over would push the rest of the bar late.
        return load(
            score(
                `<measure number="1">${attr(0)}${ornamented("C", 5, "trill-mark")}${plain("D", 5)}</measure>`,
            ),
        ).then((osmd) => {
            const steps = collectListenSteps(osmd);
            const figure = steps.filter((step) => step.whole === 0);
            const spent = figure.reduce((sum, step) => sum + (step.lengths[0] ?? 0), 0);
            expect(spent).toBeCloseTo(1, 6);
        });
    });
});
