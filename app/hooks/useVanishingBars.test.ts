// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { vanishedSteps } from "../../core/sightRead";
import type { StepNotes } from "../lib/scoreColor";
import { useVanishingBars } from "./useVanishingBars";

// Hiding reaches into OSMD's rendered SVG, which exists only in a real browser. The
// bookkeeping is what this hook is: which bars have gone, which are new this note, and
// what a re-render has to put back. Stub the three helpers and that bookkeeping becomes
// observable — each call records the step it was given, in order.
//
// collected is what the next collectStepNotes hands back, so a test can swap in fresh
// elements and tell a re-collection from a stale reference kept.
let collected: StepNotes[] = [];
const hidden: string[][] = [];
const unhidden: string[][] = [];

// Spied rather than replaced: the real answer is what the hook acts on, and the count is
// how the bar guard below is observable at all.
vi.mock("../../core/sightRead", async (importOriginal) => {
    const real = await importOriginal<typeof import("../../core/sightRead")>();
    return { ...real, vanishedSteps: vi.fn(real.vanishedSteps) };
});

vi.mock("../lib/scoreColor", () => ({
    collectStepNotes: () => collected,
    hideNoteElements: (steps: { id: string }[][]) => {
        hidden.push(steps.flat().map((element) => element.id));
    },
    unhideNoteElements: (steps: { id: string }[][]) => {
        unhidden.push(steps.flat().map((element) => element.id));
    },
}));

// A step per entry: its bar, and one element named so a hide is identifiable. The tag
// distinguishes one collection from the next.
const score = (bars: number[], tag = "a"): StepNotes[] =>
    bars.map(
        (measure, index) =>
            ({ measure, elements: [{ id: `${tag}${index}` }] }) as unknown as StepNotes,
    );

const osmd = {} as OpenSheetMusicDisplay;
const mount = (enabled = true) =>
    renderHook(() => useVanishingBars(() => osmd, { enabled, hand: "both" }));

beforeEach(() => {
    collected = score([0, 0, 1, 1, 2]);
    hidden.length = 0;
    unhidden.length = 0;
    vi.mocked(vanishedSteps).mockClear();
});

describe("useVanishingBars", () => {
    it("hides a bar only once the run has left it", () => {
        const { result } = mount();
        act(() => result.current.arm());

        // Still inside bar 0: there is nothing behind the run yet.
        act(() => result.current.advance(0));
        expect(hidden).toEqual([]);

        // First note of bar 1 — bar 0 is now behind, and goes.
        act(() => result.current.advance(2));
        expect(hidden).toEqual([["a0"], ["a1"]]);
    });

    it("works nothing out on the notes after a bar's first", () => {
        // The reason the bar is tracked at all. This runs once per note, at the moment the
        // synth is being asked to sound one, and vanishedSteps walks the whole piece to
        // build its answer — so every note but a bar's first must return before it.
        //
        // Note what this does NOT assert: that nothing is hidden. The gone set already
        // sees to that, so hiding stays empty with the bar guard removed and would prove
        // nothing about it.
        const { result } = mount();
        act(() => result.current.arm());
        act(() => result.current.advance(2));
        vi.mocked(vanishedSteps).mockClear();

        act(() => result.current.advance(3));
        expect(vanishedSteps).not.toHaveBeenCalled();
    });

    it("hides each step once across the whole run", () => {
        const { result } = mount();
        act(() => result.current.arm());
        act(() => result.current.advance(2));
        act(() => result.current.advance(4));

        // Bar 0 went at the first crossing and is not hidden a second time; only bar 1
        // is new here.
        expect(hidden).toEqual([["a0"], ["a1"], ["a2"], ["a3"]]);
    });

    it("does nothing at all when the mode is off", () => {
        const { result } = mount(false);
        act(() => result.current.arm());
        act(() => result.current.advance(4));
        expect(hidden).toEqual([]);
    });

    it("leaves a run in progress alone when armed again", () => {
        // A Practice run resuming after a Listen handoff arms a second time. Re-arming
        // would clear the gone set and bring the vanished bars back into view.
        const { result } = mount();
        act(() => result.current.arm());
        act(() => result.current.advance(2));
        hidden.length = 0;

        act(() => result.current.arm());
        act(() => result.current.advance(3));
        expect(hidden).toEqual([]);
    });

    it("re-hides exactly the bars already gone after the score is rebuilt", () => {
        // An in-place render mid-run detaches every element the hook is holding. Without
        // re-collecting and re-hiding, the rebuilt score comes back with every vanished
        // bar visible again.
        const { result } = mount();
        act(() => result.current.arm());
        act(() => result.current.advance(4));
        hidden.length = 0;

        collected = score([0, 0, 1, 1, 2], "b");
        act(() => result.current.rearm());

        // The fresh elements, and only the four steps behind the run.
        expect(hidden).toEqual([["b0"], ["b1"], ["b2"], ["b3"]]);
    });

    it("ignores a rebuild when no run is on", () => {
        const { result } = mount();
        act(() => result.current.rearm());
        expect(hidden).toEqual([]);
    });

    it("brings the whole piece back when the run ends", () => {
        const { result } = mount();
        act(() => result.current.arm());
        act(() => result.current.advance(4));
        act(() => result.current.restore());

        // Every step, not merely the hidden ones — leaving invisible music on the staff
        // is the one failure this mode cannot have.
        expect(unhidden).toEqual([["a0", "a1", "a2", "a3", "a4"]]);
    });

    it("forgets the run it restored, so the next one starts clean", () => {
        const { result } = mount();
        act(() => result.current.arm());
        act(() => result.current.advance(4));
        act(() => result.current.restore());
        unhidden.length = 0;
        hidden.length = 0;

        // A second restore has nothing to undo, and arming again begins from an empty
        // score rather than the last run's gone set.
        act(() => result.current.restore());
        expect(unhidden).toEqual([]);

        act(() => result.current.arm());
        act(() => result.current.advance(2));
        expect(hidden).toEqual([["a0"], ["a1"]]);
    });
});
