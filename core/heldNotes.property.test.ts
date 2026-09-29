// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { type HeldNotes, heldNotes } from "./heldNotes";

// The keyboard sounds a note on the edge into held and releases it on the edge out, so
// what these pin is the edges rather than the counting underneath: a press that reports
// true must be the one that started the note, and a release that reports true must be the
// one that ended it. Get that wrong in either direction and a player hears it — a voice
// that never stops, or a note cut while a second finger is still on the key.
//
// The model is the same question asked a different way: a list of the sources holding
// each note, rebuilt from the commands, with no shared code. Sources and notes come from
// pools small enough that two sources land on one key constantly, which is the case the
// reference counting exists for.

type Model = { holding: Map<number, string[]> };

const soundingOf = (model: Model) =>
    [...model.holding.entries()].filter(([, who]) => who.length > 0).map(([note]) => note);

class Press implements fc.Command<Model, HeldNotes> {
    constructor(
        readonly source: string,
        readonly note: number,
    ) {}
    check = () => true;
    run(model: Model, real: HeldNotes) {
        const who = model.holding.get(this.note) ?? [];
        const started = who.length === 0;
        const already = who.includes(this.source);

        expect(real.press(this.source, this.note)).toBe(started);

        if (!already) {
            model.holding.set(this.note, [...who, this.source]);
        }
        expect(real.holds(this.source, this.note)).toBe(true);
    }
    toString = () => `press(${this.source}, ${this.note})`;
}

class Release implements fc.Command<Model, HeldNotes> {
    constructor(
        readonly source: string,
        readonly note: number,
    ) {}
    check = () => true;
    run(model: Model, real: HeldNotes) {
        const who = model.holding.get(this.note) ?? [];
        const left = who.filter((one) => one !== this.source);
        const silenced = who.includes(this.source) && left.length === 0;

        expect(real.release(this.source, this.note)).toBe(silenced);

        model.holding.set(this.note, left);
        expect(real.holds(this.source, this.note)).toBe(false);
    }
    toString = () => `release(${this.source}, ${this.note})`;
}

class ReleaseSource implements fc.Command<Model, HeldNotes> {
    constructor(readonly source: string) {}
    check = () => true;
    run(model: Model, real: HeldNotes) {
        const silenced = [...model.holding.entries()]
            .filter(([, who]) => who.length === 1 && who[0] === this.source)
            .map(([note]) => note);

        expect(real.releaseSource(this.source).sort()).toEqual([...silenced].sort());

        for (const [note, who] of model.holding) {
            model.holding.set(
                note,
                who.filter((one) => one !== this.source),
            );
        }
    }
    toString = () => `releaseSource(${this.source})`;
}

class ReleaseAll implements fc.Command<Model, HeldNotes> {
    check = () => true;
    run(model: Model, real: HeldNotes) {
        expect(real.releaseAll().sort()).toEqual([...soundingOf(model)].sort());

        model.holding.clear();
        expect(real.sounding()).toEqual([]);
    }
    toString = () => "releaseAll()";
}

const SOURCES = ["p1", "p2", "key", "click"];
const NOTES = [60, 61, 62];

const arbSource = fc.constantFrom(...SOURCES);
const arbNote = fc.constantFrom(...NOTES);

describe("heldNotes, against a model of who is holding what", () => {
    it("sounds and silences on the edges, whatever order the sources arrive in", () => {
        fc.assert(
            fc.property(
                fc.commands(
                    [
                        fc
                            .tuple(arbSource, arbNote)
                            .map(([source, note]) => new Press(source, note)),
                        fc
                            .tuple(arbSource, arbNote)
                            .map(([source, note]) => new Release(source, note)),
                        arbSource.map((source) => new ReleaseSource(source)),
                        fc.constant(new ReleaseAll()),
                    ],
                    { maxCommands: 120 },
                ),
                (commands) => {
                    fc.modelRun(
                        () => ({
                            model: { holding: new Map<number, string[]>() },
                            real: heldNotes(),
                        }),
                        commands,
                    );
                },
            ),
        );
    });

    it("leaves nothing sounding once every source has let go", () => {
        fc.assert(
            fc.property(fc.array(fc.tuple(arbSource, arbNote), { maxLength: 60 }), (presses) => {
                const held = heldNotes();
                for (const [source, note] of presses) {
                    held.press(source, note);
                }
                for (const source of SOURCES) {
                    held.releaseSource(source);
                }
                expect(held.sounding()).toEqual([]);
            }),
        );
    });

    it("keeps a note alive while a second source still holds it", () => {
        fc.assert(
            fc.property(
                arbNote,
                fc.uniqueArray(arbSource, { minLength: 2, maxLength: SOURCES.length }),
                (note, sources) => {
                    const held = heldNotes();
                    expect(held.press(sources[0]!, note)).toBe(true);
                    for (const source of sources.slice(1)) {
                        expect(held.press(source, note)).toBe(false);
                    }
                    for (const source of sources.slice(0, -1)) {
                        expect(held.release(source, note)).toBe(false);
                        expect(held.sounding()).toEqual([note]);
                    }
                    expect(held.release(sources.at(-1)!, note)).toBe(true);
                    expect(held.sounding()).toEqual([]);
                },
            ),
        );
    });
});
