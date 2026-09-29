// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { type Keybed, keybed } from "./keybed";

// The keybed's rule in one sentence: a note sounds while any source holds it, and the
// keyboard is told only about the edges. Everything here drives the real thing against a
// separately written account of who holds what, because the two ways of saying it are
// what make a disagreement visible.
//
// Two pointers over three notes, so a glide lands on a key the other finger already
// holds constantly — the case reference counting exists for, and the one where a wrong
// edge is audible: a note cut while a finger is still on it, or one that never stops.

type Model = {
    holders: Map<number, Set<string>>;
    at: Map<number, number | null>;
    // The sources that do not move, while they are holding something: what tells the
    // stuck-note check whether anything at all is still down.
    held: Set<string>;
};

const sounding = (model: Model) =>
    [...model.holders.entries()]
        .filter(([, who]) => who.size > 0)
        .map(([note]) => note)
        .sort((a, b) => a - b);

const holdersOf = (model: Model, note: number) => {
    let who = model.holders.get(note);
    if (!who) {
        who = new Set();
        model.holders.set(note, who);
    }
    return who;
};

// The model's own press and release, answering the same question the code answers: did
// this cross an edge?
const modelPress = (model: Model, source: string, note: number) => {
    const who = holdersOf(model, note);
    const started = who.size === 0;
    who.add(source);
    return started ? note : null;
};

const modelRelease = (model: Model, source: string, note: number) => {
    const who = holdersOf(model, note);
    if (!who.has(source)) {
        return null;
    }
    who.delete(source);
    return who.size === 0 ? note : null;
};

const modelMove = (model: Model, id: number, note: number | null) => {
    const was = model.at.get(id) ?? null;
    if (was === note) {
        return { pressed: null, released: null };
    }
    const source = `p${id}`;
    const released = was === null ? null : modelRelease(model, source, was);
    model.at.set(id, note);
    return { pressed: note === null ? null : modelPress(model, source, note), released };
};

// After every command: the code and the model agree on what is sounding, on who holds
// each note, and on the one thing a player would hear — nothing sounding once nothing
// holds anything.
const agree = (model: Model, real: Keybed) => {
    expect([...real.sounding()].sort((a, b) => a - b)).toEqual(sounding(model));
    for (const id of model.at.keys()) {
        expect(real.tracks(id)).toBe(model.at.has(id));
        expect(real.noteOf(id)).toBe(model.at.get(id) ?? null);
    }
    const anyHolder = [...model.at.values()].some((note) => note !== null) || model.held.size > 0;
    if (!anyHolder) {
        expect(real.sounding()).toEqual([]);
    }
};

const makeModel = (): Model => ({
    holders: new Map<number, Set<string>>(),
    at: new Map<number, number | null>(),
    held: new Set<string>(),
});

const IDS = [1, 2];
const NOTES = [60, 61, 62];
const STILL = ["key", "click"];

const arbId = fc.constantFrom(...IDS);
const arbNote = fc.constantFrom(...NOTES);
const arbStill = fc.constantFrom(...STILL);

class PointerDown implements fc.Command<Model, Keybed> {
    constructor(
        readonly id: number,
        readonly note: number,
    ) {}
    check = () => true;
    run(model: Model, real: Keybed) {
        if (!model.at.has(this.id)) {
            model.at.set(this.id, null);
        }
        expect(real.pointerDown(this.id, this.note)).toEqual(modelMove(model, this.id, this.note));
        agree(model, real);
    }
    toString = () => `down(${this.id}, ${this.note})`;
}

class PointerTo implements fc.Command<Model, Keybed> {
    constructor(
        readonly id: number,
        readonly note: number | null,
    ) {}
    check = () => true;
    run(model: Model, real: Keybed) {
        const expected = model.at.has(this.id)
            ? modelMove(model, this.id, this.note)
            : { pressed: null, released: null };
        expect(real.pointerTo(this.id, this.note)).toEqual(expected);
        agree(model, real);
    }
    toString = () => `to(${this.id}, ${this.note})`;
}

class PointerEnd implements fc.Command<Model, Keybed> {
    constructor(readonly id: number) {}
    check = () => true;
    run(model: Model, real: Keybed) {
        let expected = { pressed: null, released: null as number | null };
        if (model.at.has(this.id)) {
            expected = { pressed: null, released: modelMove(model, this.id, null).released };
            model.at.delete(this.id);
        }
        expect(real.pointerEnd(this.id)).toEqual(expected);
        agree(model, real);
    }
    toString = () => `end(${this.id})`;
}

class StillPress implements fc.Command<Model, Keybed> {
    constructor(
        readonly source: string,
        readonly note: number,
    ) {}
    check = () => true;
    run(model: Model, real: Keybed) {
        const expected = { pressed: modelPress(model, this.source, this.note), released: null };
        model.held.add(this.source);
        expect(real.press(this.source, this.note)).toEqual(expected);
        agree(model, real);
    }
    toString = () => `press(${this.source}, ${this.note})`;
}

class StillRelease implements fc.Command<Model, Keybed> {
    constructor(
        readonly source: string,
        readonly note: number,
    ) {}
    check = () => true;
    run(model: Model, real: Keybed) {
        const expected = { pressed: null, released: modelRelease(model, this.source, this.note) };
        if (![...model.holders.values()].some((who) => who.has(this.source))) {
            model.held.delete(this.source);
        }
        expect(real.release(this.source, this.note)).toEqual(expected);
        agree(model, real);
    }
    toString = () => `release(${this.source}, ${this.note})`;
}

class ReleaseAll implements fc.Command<Model, Keybed> {
    check = () => true;
    run(model: Model, real: Keybed) {
        expect([...real.releaseAll()].sort((a, b) => a - b)).toEqual(sounding(model));
        model.holders.clear();
        model.at.clear();
        model.held.clear();
        expect(real.sounding()).toEqual([]);
    }
    toString = () => "releaseAll()";
}

describe("keybed, against a model of who is holding what", () => {
    it("crosses an edge exactly when a note starts or stops sounding", () => {
        fc.assert(
            fc.property(
                fc.commands(
                    [
                        fc.tuple(arbId, arbNote).map(([id, note]) => new PointerDown(id, note)),
                        fc
                            .tuple(arbId, fc.option(arbNote, { nil: null }))
                            .map(([id, note]) => new PointerTo(id, note)),
                        arbId.map((id) => new PointerEnd(id)),
                        fc
                            .tuple(arbStill, arbNote)
                            .map(([source, note]) => new StillPress(source, note)),
                        fc
                            .tuple(arbStill, arbNote)
                            .map(([source, note]) => new StillRelease(source, note)),
                        fc.constant(new ReleaseAll()),
                    ],
                    { maxCommands: 150 },
                ),
                (commands) => {
                    fc.modelRun(() => ({ model: makeModel(), real: keybed() }), commands);
                },
            ),
        );
    });

    it("a glide sounds each key it crosses exactly once, and the last one only until it lifts", () => {
        fc.assert(
            fc.property(
                fc.array(fc.constantFrom(...NOTES, null), { minLength: 1, maxLength: 12 }),
                (path) => {
                    const bed = keybed();
                    let sounded = 0;
                    let previous: number | null = null;
                    bed.pointerDown(1, NOTES[0]!);
                    previous = NOTES[0]!;
                    sounded += 1;
                    for (const step of path) {
                        const edge = bed.pointerTo(1, step);
                        if (step === previous) {
                            expect(edge).toEqual({ pressed: null, released: null });
                        } else {
                            expect(edge.released).toBe(previous);
                            expect(edge.pressed).toBe(step);
                            if (step !== null) {
                                sounded += 1;
                            }
                        }
                        previous = step;
                    }
                    expect(bed.pointerEnd(1).released).toBe(previous);
                    expect(bed.sounding()).toEqual([]);
                    expect(sounded).toBeGreaterThan(0);
                },
            ),
        );
    });
});
