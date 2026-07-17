// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { EarNote } from "../../../core/earExercise";
import { fakeAudioEngine } from "../../adapters/fakeAudioEngine";
import { memoryStore } from "../../adapters/memoryStore";
import { createServices, ServicesProvider } from "../../contexts/services";
import { fakeScheduler } from "../../testing/fakeScheduler";
import { EarStage } from "./earStage";

afterEach(cleanup);

// The stage runs on the injected clock, so the dots can be driven note by note and the
// bloom asserted at an exact moment rather than waited for.
function mount(notes: EarNote[]) {
    const scheduler = fakeScheduler();
    const audio = fakeAudioEngine();
    const services = createServices({ audio, scheduler, store: memoryStore() });
    const view = render(
        <ServicesProvider services={services}>
            <EarStage notes={notes} autoPlay={true} />
        </ServicesProvider>,
    );
    // A dot is lit when it carries the bloom's scale class.
    const litFlags = () =>
        Array.from(view.container.querySelectorAll("span[aria-hidden='true']")).map((dot) =>
            dot.className.includes("scale-150"),
        );
    return { scheduler, audio, litFlags };
}

const note = (midi: number, at: number): EarNote => ({
    note: midi,
    at,
    velocity: 82,
    duration: 0.9,
});

describe("the listening stage", () => {
    it("sounds every note of the question with its own delay", () => {
        const { audio } = mount([note(60, 0), note(67, 0.75)]);
        expect(audio.strikes.map((strike) => strike.note)).toEqual([60, 67]);
    });

    it("blooms a dot only while its own note sounds", () => {
        const { scheduler, litFlags } = mount([note(60, 0), note(67, 0.75)]);
        expect(litFlags()).toEqual([false, false]);

        act(() => scheduler.advance(10));
        expect(litFlags()).toEqual([true, false]);

        act(() => scheduler.advance(800)); // the second note has joined the first
        expect(litFlags()).toEqual([true, true]);

        act(() => scheduler.advance(200)); // the first has rung out, the second has not
        expect(litFlags()).toEqual([false, true]);
    });

    // A unison sounds one pitch twice. Tracking pitches rather than positions would light
    // both dots at once here, which both contradicts what is heard and hands over the
    // answer — a unison is the only interval whose notes share a number, so a player
    // could read it off the screen without listening.
    it("keeps a unison's two notes separate rather than giving the round away", () => {
        const { scheduler, litFlags } = mount([note(60, 0), note(60, 0.75)]);

        act(() => scheduler.advance(10));
        expect(litFlags()).toEqual([true, false]);

        act(() => scheduler.advance(800));
        expect(litFlags()).toEqual([true, true]);

        act(() => scheduler.advance(200));
        expect(litFlags()).toEqual([false, true]);
    });

    it("blooms both dots at once when the notes are heard together", () => {
        const { scheduler, litFlags } = mount([note(60, 0), note(67, 0)]);
        act(() => scheduler.advance(10));
        expect(litFlags()).toEqual([true, true]);
    });
});
