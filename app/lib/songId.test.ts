// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { songId } from "./songId";

// Build a note element; midi is expressed as step/octave/alter so the fingerprint's own
// midi math is exercised, not pre-computed.
const note = (step: string, octave: number, duration: number, alter?: number): string =>
    `<note><pitch><step>${step}</step>${
        alter === undefined ? "" : `<alter>${alter}</alter>`
    }<octave>${octave}</octave></pitch><duration>${duration}</duration></note>`;

const score = (body: string, head = ""): string =>
    `<score-partwise>${head}<part id="P1"><measure number="1">${body}</measure></part></score-partwise>`;

const CDE = score(`${note("C", 4, 4)}${note("D", 4, 4)}${note("E", 4, 4)}`);

describe("songId", () => {
    it("is a 12-character base62 string", () => {
        const id = songId(CDE);
        expect(id).toHaveLength(12);
        expect(id).toMatch(/^[0-9A-Za-z]{12}$/);
    });

    it("is deterministic — the same notes always give the same id", () => {
        expect(songId(CDE)).toBe(songId(CDE));
    });

    it("depends on the notes, not the title, composer or lyrics", () => {
        // The whole point: a re-titled, re-credited, or lyric-carrying copy is the same
        // piece and keeps its id, so nothing about metadata churns it.
        const withMeta = score(
            `${note("C", 4, 4)}${note("D", 4, 4)}${note("E", 4, 4)}`,
            '<work><work-title>Alpha</work-title></work><identification><creator type="composer">Ada</creator></identification>',
        );
        const reTitled = score(
            `${note("C", 4, 4)}${note("D", 4, 4)}${note("E", 4, 4)}`,
            "<work><work-title>Beta</work-title></work>",
        );
        const withLyric = score(
            `<note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><lyric><text>la</text></lyric></note>${note("D", 4, 4)}${note("E", 4, 4)}`,
        );
        expect(songId(withMeta)).toBe(songId(CDE));
        expect(songId(reTitled)).toBe(songId(CDE));
        expect(songId(withLyric)).toBe(songId(CDE));
    });

    it("changes when a pitch, accidental or duration changes", () => {
        const base = songId(CDE);
        expect(songId(score(`${note("C", 4, 4)}${note("D", 4, 4)}${note("F", 4, 4)}`))).not.toBe(
            base,
        );
        expect(songId(score(`${note("C", 4, 4, 1)}${note("D", 4, 4)}${note("E", 4, 4)}`))).not.toBe(
            base,
        );
        expect(songId(score(`${note("C", 4, 2)}${note("D", 4, 4)}${note("E", 4, 4)}`))).not.toBe(
            base,
        );
    });

    it("distinguishes note order", () => {
        const forward = score(`${note("C", 4, 4)}${note("E", 4, 4)}`);
        const backward = score(`${note("E", 4, 4)}${note("C", 4, 4)}`);
        expect(songId(forward)).not.toBe(songId(backward));
    });

    it("ignores rests and unpitched percussion", () => {
        const withRest = score(
            `${note("C", 4, 4)}<note><rest/><duration>4</duration></note>${note("D", 4, 4)}${note("E", 4, 4)}`,
        );
        const withUnpitched = score(
            `${note("C", 4, 4)}<note><unpitched/><duration>4</duration></note>${note("D", 4, 4)}${note("E", 4, 4)}`,
        );
        expect(songId(withRest)).toBe(songId(CDE));
        expect(songId(withUnpitched)).toBe(songId(CDE));
    });

    it("includes the notes of every part, not just the first", () => {
        const onePart = score(`${note("C", 4, 4)}`);
        const twoParts =
            `<score-partwise><part id="P1"><measure number="1">${note("C", 4, 4)}</measure></part>` +
            `<part id="P2"><measure number="1">${note("C", 2, 4)}</measure></part></score-partwise>`;
        expect(songId(twoParts)).not.toBe(songId(onePart));
    });

    it("gives a stable id even to a score with no pitched notes", () => {
        const empty = score("<note><rest/><duration>4</duration></note>");
        expect(songId(empty)).toHaveLength(12);
        expect(songId(empty)).toBe(songId(empty));
    });
});
