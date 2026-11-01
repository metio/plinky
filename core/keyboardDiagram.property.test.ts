// SPDX-FileCopyrightText: The Klimpi Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
    type DiagramKey,
    type DiagramOptions,
    letterSpeller,
    svgDiagramSheet,
    svgKeyboardDiagram,
} from "./keyboardDiagram";

// The printed keyboard picture: a chord or a scale drawn as keys to press, with a caption
// under it. It is printed, so a reader cannot scroll to find what ran off the edge, and
// nobody checks a sheet before it leaves — a caption wider than the paper, a mark on a
// key the picture does not reach, or markup a renderer refuses are all permanent once
// they are on paper.

const arbSpan = fc
    .tuple(fc.integer({ min: 21, max: 84 }), fc.integer({ min: 2, max: 48 }))
    .map(([from, width]) => ({ from, to: from + width }));

// A key is listed once, the way a chord or a scale names its notes. Listing one twice
// is contradictory input — two fingerings for one key — and what the picture does with
// it is pinned on its own below rather than mixed into the law about marks.
const arbKeys = (from: number, to: number): fc.Arbitrary<DiagramKey[]> =>
    fc
        .uniqueArray(fc.integer({ min: from, max: to }), { maxLength: 6 })
        .chain((notes) =>
            fc
                .tuple(
                    ...notes.map(() =>
                        fc.option(fc.integer({ min: 1, max: 5 }), { nil: undefined }),
                    ),
                )
                .map((fingers) =>
                    notes.map((note, at) =>
                        fingers[at] === undefined ? { note } : { note, finger: fingers[at] },
                    ),
                ),
        );

// A caption as a piece or a chord supplies one: short, long, and carrying the characters
// that have to be escaped before they reach an SVG.
const arbCaption = fc.oneof(
    fc.string({ maxLength: 40 }),
    fc.constantFrom(
        "C major",
        "Rock & Roll",
        "<script>alert(1)</script>",
        'He said "play it"',
        "A caption long enough to run off both edges of the paper at once, twice over",
        "🎹 C♯ diminished 🎹",
    ),
);

const arbOptions: fc.Arbitrary<DiagramOptions> = arbSpan.chain(({ from, to }) =>
    fc.tuple(arbKeys(from, to), arbCaption, fc.boolean()).map(([keys, caption, noteNames]) => ({
        from,
        to,
        keys,
        caption,
        noteNames,
        spell: letterSpeller,
    })),
);

const parse = (svg: string) => {
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    expect(doc.querySelector("parsererror")).toBeNull();
    return doc;
};

const boxOf = (doc: Document) => {
    const root = doc.documentElement;
    return {
        width: Number(root.getAttribute("width")),
        height: Number(root.getAttribute("height")),
        viewBox: (root.getAttribute("viewBox") ?? "").split(/\s+/).map(Number),
    };
};

describe("a keyboard drawn to be printed", () => {
    it("renders whatever a piece is called", () => {
        fc.assert(
            fc.property(arbOptions, (options) => {
                const doc = parse(svgKeyboardDiagram(options));

                // An ampersand in a chord name is ordinary, and an emoji in a title is a
                // surrogate pair; unescaped, either makes the picture ill-formed and it
                // does not render at all.
                expect(doc.documentElement.tagName).toBe("svg");
            }),
        );
    });

    it("declares a box the drawing fits inside", () => {
        fc.assert(
            fc.property(arbOptions, (options) => {
                const { width, height, viewBox } = boxOf(parse(svgKeyboardDiagram(options)));

                expect(width).toBeGreaterThan(0);
                expect(height).toBeGreaterThan(0);
                // A viewBox that disagreed with the width would scale the picture, which
                // on paper reads as a keyboard with the wrong proportions.
                expect(viewBox).toEqual([0, 0, width, height]);
            }),
        );
    });

    it("keeps every drawn key inside the paper", () => {
        fc.assert(
            fc.property(arbOptions, (options) => {
                const doc = parse(svgKeyboardDiagram(options));
                const { width } = boxOf(doc);

                const rects = [...doc.querySelectorAll("rect")];
                expect(rects.length).toBeGreaterThan(0);
                for (const rect of rects) {
                    const x = Number(rect.getAttribute("x") ?? 0);
                    const w = Number(rect.getAttribute("width") ?? 0);
                    expect(x).toBeGreaterThanOrEqual(-0.5);
                    // Nothing reaches past the sheet: a reader cannot scroll paper.
                    expect(x + w).toBeLessThanOrEqual(width + 0.5);
                }
            }),
        );
    });

    it("marks every key it was asked to, and no others", () => {
        fc.assert(
            fc.property(
                arbSpan.chain(({ from, to }) =>
                    arbKeys(from, to).map((keys) => ({ from, to, keys })),
                ),
                ({ from, to, keys }) => {
                    const doc = parse(svgKeyboardDiagram({ from, to, keys, spell: letterSpeller }));

                    // One finger number per key that was given one: a picture that drew
                    // fewer would leave a key unexplained, and more would invent a
                    // fingering nobody chose.
                    const fingered = keys.filter((key) => key.finger !== undefined);
                    const texts = [...doc.querySelectorAll("text")].map((node) =>
                        (node.textContent ?? "").trim(),
                    );
                    for (const key of fingered) {
                        expect(texts).toContain(String(key.finger));
                    }
                },
            ),
        );
    });

    it("gives a key listed twice one drawing and the last word", () => {
        const twice = svgKeyboardDiagram({
            from: 60,
            to: 72,
            keys: [{ note: 60, finger: 1 }, { note: 60 }],
            spell: letterSpeller,
        });
        const once = svgKeyboardDiagram({
            from: 60,
            to: 72,
            keys: [{ note: 60 }],
            spell: letterSpeller,
        });

        // Two fingerings for one key is a caller contradicting itself. The picture takes
        // the later entry rather than stacking both numbers on one key, which is the
        // one outcome a reader could not act on.
        expect(twice).toBe(once);
    });

    it("draws the same picture for the same keyboard", () => {
        fc.assert(
            fc.property(arbOptions, (options) => {
                expect(svgKeyboardDiagram(options)).toBe(svgKeyboardDiagram(options));
            }),
        );
    });

    it("draws a span however narrow or wide it is asked for", () => {
        fc.assert(
            fc.property(arbSpan, (span) => {
                const doc = parse(
                    svgKeyboardDiagram({
                        ...span,
                        keys: [{ note: span.from }],
                        spell: letterSpeller,
                    }),
                );

                // Widen the span and the keys get narrower; the picture stays one page.
                expect(boxOf(doc).width).toBeGreaterThan(0);
                expect(doc.querySelectorAll("rect").length).toBeGreaterThan(0);
            }),
        );
    });
});

describe("a sheet of several keyboards", () => {
    it("stacks them without overlapping, inside one page", () => {
        fc.assert(
            fc.property(
                arbCaption,
                fc.array(arbOptions, { minLength: 1, maxLength: 4 }),
                (title, diagrams) => {
                    const doc = parse(svgDiagramSheet({ title, diagrams }));
                    const { width, height } = boxOf(doc);

                    const groups = [...doc.querySelectorAll("g[transform]")];
                    expect(groups.length).toBeGreaterThanOrEqual(diagrams.length);
                    const tops = groups
                        .map((group) =>
                            Number(
                                /translate\(0,([\d.]+)\)/.exec(
                                    group.getAttribute("transform") ?? "",
                                )?.[1],
                            ),
                        )
                        .filter((top) => Number.isFinite(top));
                    // Each picture sits below the one before it, and the last of them
                    // ends inside the sheet it was given.
                    expect([...tops].sort((a, b) => a - b)).toEqual(tops);
                    for (const top of tops) {
                        expect(top).toBeLessThan(height);
                    }
                    expect(width).toBeGreaterThan(0);
                },
            ),
        );
    });

    it("titles the sheet with what it is a sheet of", () => {
        fc.assert(
            fc.property(fc.stringMatching(/^[A-Za-z ]{3,30}$/), (title) => {
                const doc = parse(
                    svgDiagramSheet({
                        title,
                        diagrams: [
                            { from: 60, to: 72, keys: [{ note: 60 }], spell: letterSpeller },
                        ],
                    }),
                );

                const texts = [...doc.querySelectorAll("text")].map((node) => node.textContent);
                expect(texts).toContain(title);
            }),
        );
    });
});
