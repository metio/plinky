// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { curate, type Curation, parseCuration } from "./curation.mts";

const PIECES = [
    { id: "aaa", title: "Clair de lune", composer: "Calude Debussy", cost: 12 },
    { id: "bbb", title: "Für Elise", composer: "Ludwig van Beethoven", cost: 40 },
];

const entry = (patch: Record<string, unknown> = {}) => ({
    id: "aaa",
    title: "Clair de lune (opening)",
    why: "the score is the opening phrase",
    ...patch,
});

describe("parseCuration", () => {
    it("reads a correction with a reason attached", () => {
        const { curations, problems } = parseCuration([entry({ composer: "Claude Debussy" })]);
        expect(problems).toEqual([]);
        expect(curations).toEqual([
            {
                id: "aaa",
                title: "Clair de lune (opening)",
                composer: "Claude Debussy",
                why: "the score is the opening phrase",
            },
        ]);
    });

    it("refuses a correction to anything but the title and the composer", () => {
        // The one that matters: a file whose job is fixing typos must not be able to
        // relicense a score, which is a legal fact read from the corpus that supplied it.
        const { curations, problems } = parseCuration([entry({ license: "CC0-1.0" })]);
        expect(curations).toEqual([]);
        expect(problems[0]).toContain("license");
        expect(parseCuration([entry({ cost: 1 })]).problems[0]).toContain("cost");
    });

    it("insists on a reason, so an entry can be judged a year later", () => {
        expect(parseCuration([entry({ why: undefined })]).problems[0]).toContain('no "why"');
        expect(parseCuration([entry({ why: "   " })]).problems[0]).toContain('no "why"');
    });

    it("rejects an entry that corrects nothing, and one with no id", () => {
        expect(parseCuration([entry({ title: undefined })]).problems[0]).toContain(
            "corrects nothing",
        );
        expect(parseCuration([entry({ id: undefined })]).problems[0]).toContain("no id");
    });

    it("keeps one entry per piece, so two lines cannot disagree", () => {
        const { curations, problems } = parseCuration([entry(), entry({ title: "Something else" })]);
        expect(curations).toHaveLength(1);
        expect(problems[0]).toContain("repeats aaa");
    });

    it("says so when the file is not a list of corrections at all", () => {
        expect(parseCuration({ id: "aaa" }).problems[0]).toContain("must hold an array");
        expect(parseCuration(["aaa"]).problems[0]).toContain("not an object");
    });
});

describe("curate", () => {
    const curation: Curation[] = [
        { id: "aaa", title: "Clair de lune (opening)", composer: "Claude Debussy", why: "typo" },
    ];

    it("corrects the piece it names and leaves the rest alone", () => {
        const { pieces, problems } = curate(PIECES, curation);
        expect(problems).toEqual([]);
        expect(pieces[0]).toEqual({
            id: "aaa",
            title: "Clair de lune (opening)",
            composer: "Claude Debussy",
            cost: 12,
        });
        expect(pieces[1]).toEqual(PIECES[1]);
    });

    it("changes only the fields the entry carries", () => {
        const { pieces } = curate(PIECES, [{ id: "aaa", composer: "Claude Debussy", why: "typo" }]);
        expect(pieces[0]?.title).toBe("Clair de lune");
        expect(pieces[0]?.composer).toBe("Claude Debussy");
    });

    it("reports a correction whose piece has left the catalogue", () => {
        // Dedup and re-import do drop scores. A correction quietly applying to nothing is
        // how this file fills with entries nobody can evaluate, so it has to be said.
        const { problems } = curate(PIECES, [{ id: "gone", title: "Anything", why: "typo" }]);
        expect(problems[0]).toContain("gone is not in the catalogue");
    });

    it("leaves the catalogue untouched when there is nothing to correct", () => {
        expect(curate(PIECES, []).pieces).toEqual(PIECES);
    });
});
