// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
    clearAllHalos,
    clearHalo,
    followNotes,
    haloColor,
    litHalos,
    markGhost,
    type PaintedNote,
    restoreNotes,
    retargetPainted,
    trailNotes,
    unmarkGhost,
} from "./scoreColor";

// The feedback layer: what a player was told about their own playing. A note is lit by a
// halo behind its notehead, never by recolouring the notehead, which the pitch-colour
// reading aid owns — and the marks accumulate over a whole run, so the bookkeeping is
// what goes wrong: a second halo stacked on the first, a colour restored to the wrong
// note, a mark left on a note the next render dropped.
//
// jsdom implements none of the SVG geometry interfaces, so the two the painter reads are
// supplied here; where a halo lands is the browser tests' subject, and these laws are
// about which note wears which colour.

const SVG_NS = "http://www.w3.org/2000/svg";

function engraving(count: number) {
    const svg = document.createElementNS(SVG_NS, "svg") as SVGSVGElement;
    if (!("viewBox" in svg)) {
        Object.defineProperty(svg, "viewBox", {
            value: { baseVal: { width: 0, height: 0 } },
        });
    }
    document.body.append(svg);
    const notes: SVGElement[] = [];
    for (let index = 0; index < count; index += 1) {
        const note = document.createElementNS(SVG_NS, "g") as SVGElement;
        note.setAttribute("class", "vf-notehead");
        // The pitch-colour reading aid's own colour, which nothing in this layer may touch.
        note.setAttribute("fill", `#00${index}0ff`);
        svg.append(note);
        notes.push(note);
    }
    return { svg, notes };
}

const halosIn = (svg: SVGSVGElement) => svg.querySelectorAll(".plinky-note-halo").length;

const COLORS = ["#16a34a", "#dc2626", "#2563eb"];

type Step =
    | { kind: "light"; note: number; color: string }
    | { kind: "clear"; note: number }
    | { kind: "clearAll" };

const arbSteps = fc.array(
    fc.oneof(
        {
            weight: 5,
            arbitrary: fc
                .tuple(fc.nat({ max: 3 }), fc.constantFrom(...COLORS))
                .map(([note, color]) => ({ kind: "light" as const, note, color })),
        },
        {
            weight: 2,
            arbitrary: fc.nat({ max: 3 }).map((note) => ({ kind: "clear" as const, note })),
        },
        { weight: 1, arbitrary: fc.constant<Step>({ kind: "clearAll" }) },
    ),
    { maxLength: 20 },
);

describe("the marks a run leaves on the score", () => {
    it("gives a notehead one halo however often it is lit, and never its own colour", () => {
        fc.assert(
            fc.property(arbSteps, (steps) => {
                document.body.replaceChildren();
                const { svg, notes } = engraving(4);
                const fills = notes.map((note) => note.getAttribute("fill"));
                const worn = new Map<number, string>();

                for (const step of steps) {
                    if (step.kind === "light") {
                        litHalos([{ element: notes[step.note] as SVGElement, color: step.color }]);
                        worn.set(step.note, step.color);
                    } else if (step.kind === "clear") {
                        clearHalo(notes[step.note] as SVGElement);
                        worn.delete(step.note);
                    } else {
                        clearAllHalos(svg);
                        worn.clear();
                    }

                    // One halo per lit notehead — a re-light recolours the one that is
                    // there rather than stacking another behind it.
                    expect(halosIn(svg)).toBe(worn.size);
                    for (const [index, note] of notes.entries()) {
                        expect(haloColor(note)).toBe(worn.get(index) ?? null);
                        // The notehead keeps the colour the reading aid gave it: a halo
                        // is drawn behind, never painted on.
                        expect(note.getAttribute("fill")).toBe(fills[index]);
                    }
                }
            }),
        );
    });

    it("lifts a highlight back to exactly what the note wore before", () => {
        fc.assert(
            fc.property(
                fc.array(fc.option(fc.constantFrom(...COLORS), { nil: null }), {
                    minLength: 4,
                    maxLength: 4,
                }),
                fc.constantFrom(...COLORS),
                (before, active) => {
                    document.body.replaceChildren();
                    const { svg, notes } = engraving(4);
                    for (const [index, color] of before.entries()) {
                        if (color !== null) {
                            litHalos([{ element: notes[index] as SVGElement, color }]);
                        }
                    }
                    const marked = halosIn(svg);
                    const painted: PaintedNote[] = notes.map((element) => ({
                        element,
                        prior: haloColor(element),
                    }));

                    litHalos(painted.map(({ element }) => ({ element, color: active })));
                    restoreNotes(painted);

                    for (const [index, note] of notes.entries()) {
                        expect(haloColor(note)).toBe(before[index] ?? null);
                    }
                    expect(halosIn(svg)).toBe(marked);
                },
            ),
        );
    });

    it("leaves a trail that keeps a mark already there", () => {
        fc.assert(
            fc.property(
                fc.array(fc.option(fc.constantFrom(...COLORS), { nil: null }), {
                    minLength: 3,
                    maxLength: 3,
                }),
                fc.constantFrom(...COLORS),
                (before, trail) => {
                    document.body.replaceChildren();
                    const { notes } = engraving(3);
                    for (const [index, color] of before.entries()) {
                        if (color !== null) {
                            litHalos([{ element: notes[index] as SVGElement, color }]);
                        }
                    }
                    const painted: PaintedNote[] = notes.map((element) => ({
                        element,
                        prior: haloColor(element),
                    }));

                    trailNotes(painted, trail);

                    for (const [index, note] of notes.entries()) {
                        // Where the piece was played keeps its colour; where it was only
                        // heard takes the trail's.
                        expect(haloColor(note)).toBe(before[index] ?? trail);
                    }
                },
            ),
        );
    });

    it("follows the notes a fresh render kept, and drops the rest", () => {
        fc.assert(
            fc.property(
                fc.array(fc.boolean(), { minLength: 4, maxLength: 4 }),
                fc.constantFrom(...COLORS),
                (kept, color) => {
                    document.body.replaceChildren();
                    const { notes } = engraving(4);
                    const { notes: fresh } = engraving(4);
                    const remap = (element: SVGElement) => {
                        const index = notes.indexOf(element);
                        return index >= 0 && kept[index] ? (fresh[index] as SVGElement) : undefined;
                    };
                    const painted: PaintedNote[] = notes.map((element, index) => ({
                        element,
                        prior: index % 2 === 0 ? color : null,
                    }));

                    const followed = followNotes(notes, remap);
                    const carried = retargetPainted(painted, remap);

                    const survivors = kept.filter(Boolean).length;
                    expect(followed.length).toBe(survivors);
                    expect(carried.length).toBe(survivors);
                    for (const one of carried) {
                        // A carried note names the fresh element and keeps the mark it
                        // wore, so lighting it paints the engraving somebody can see.
                        expect(fresh).toContain(one.element);
                        expect(one.prior).toBe(fresh.indexOf(one.element) % 2 === 0 ? color : null);
                    }
                },
            ),
        );
    });

    it("keeps the ghost's mark apart from the run's own", () => {
        fc.assert(
            fc.property(fc.constantFrom(...COLORS), fc.constantFrom(...COLORS), (played, ghost) => {
                document.body.replaceChildren();
                const { svg, notes } = engraving(2);
                const note = notes[0] as SVGElement;
                litHalos([{ element: note, color: played }]);

                markGhost([note], ghost);
                expect(haloColor(note)).toBe(played);
                unmarkGhost([note]);

                // The ghost passing over a note leaves no trace in what the run recorded.
                expect(haloColor(note)).toBe(played);
                expect(halosIn(svg)).toBe(1);
                expect(svg.querySelectorAll(".plinky-ghost-mark").length).toBe(0);
            }),
        );
    });
});
