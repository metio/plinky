// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GLOSSY, JOYFUL } from "../../../core/keyboardFinish";
import { keyLane } from "../../../core/keyboardGeometry";
import { noteNameOf, type PitchClass } from "../../../core/theory";
import { EarKeyboard } from "./earKeyboard";

afterEach(cleanup);

// The ids core/theory uses, not the glyphs the keys are labelled with.
const ALL = Array.from({ length: 12 }, (_, semitone) => noteNameOf(semitone as PitchClass));

const draw = (props: Partial<Parameters<typeof EarKeyboard>[0]> = {}) =>
    render(<EarKeyboard choices={ALL} answer={null} given={null} onChoose={() => {}} {...props} />);

describe("EarKeyboard geometry", () => {
    it("places its black keys where core/keyboardGeometry says, not by its own arithmetic", () => {
        // It used to carry a third set of piano proportions — a white width, a black width
        // and a boundary index — that happened to agree with the shared one. Nothing would
        // have caught them drifting apart.
        draw();
        const csharp = screen.getByRole("button", { name: "C♯" });
        const lane = keyLane(61, 60, 71)!;
        expect(csharp.style.left).toBe(`${lane.leftPct}%`);
        expect(csharp.style.width).toBe(`${lane.widthPct}%`);
    });

    it("offers seven white keys and five black ones, which is an octave", () => {
        draw();
        const buttons = screen.getAllByRole("button");
        expect(buttons).toHaveLength(12);
    });

    it("shows only the black keys the round is asking about", () => {
        draw({ choices: [noteNameOf(0), noteNameOf(2), noteNameOf(4)] });
        expect(screen.queryByRole("button", { name: "C♯" })).toBeNull();
        // Every white key stays, so the keyboard keeps its shape while the answers narrow.
        expect(screen.getAllByRole("button")).toHaveLength(7);
    });
});

describe("EarKeyboard finish", () => {
    it("wears the joyful shading by default, like every other keyboard", () => {
        draw();
        expect(screen.getByRole("button", { name: "C" }).className).toContain("rounded-b-lg");
    });

    it("follows the chosen finish", () => {
        draw({ finish: GLOSSY });
        const key = screen.getByRole("button", { name: "C" });
        expect(key.className).toContain("border-b-4");
        expect(key.className).not.toContain(JOYFUL.whiteKey.split(" ").at(-1));
    });
});
