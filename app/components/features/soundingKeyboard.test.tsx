// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { DemoScore } from "../../../core/theoryDemo";
import { fakeAudioEngine } from "../../adapters/fakeAudioEngine";
import { advanceScheduler } from "../../testing/advanceScheduler";
import { fakeScheduler } from "../../testing/fakeScheduler";
import { renderWithServices } from "../../testing/renderWithServices";
import { SoundingKeyboard } from "./soundingKeyboard";

afterEach(cleanup);

// Two short runs with no note in common, so a note from one can never be mistaken for the
// other's.
const run = (...notes: number[]): DemoScore => ({
    clef: "treble",
    fifths: 0,
    steps: notes.map((note) => ({ notes: [note], value: "quarter" })),
});
const RISING = run(60, 62, 64, 65);
const FALLING = run(79, 77, 76);

const pressed = (note: number) =>
    document.querySelector(`[data-note="${note}"]`)?.getAttribute("aria-pressed");

function mount(score: DemoScore) {
    const audio = fakeAudioEngine();
    const scheduler = fakeScheduler();
    const view = renderWithServices(<SoundingKeyboard score={score} label="hear" />, {
        audio,
        scheduler,
    });
    return { audio, scheduler, ...view };
}

describe("SoundingKeyboard", () => {
    it("plays every note of its score in turn and returns to the shape", async () => {
        const view = mount(RISING);
        fireEvent.click(screen.getByRole("button", { name: "hear" }));
        await advanceScheduler(view.scheduler, 60_000);
        expect(view.audio.strikes.map((strike) => strike.note)).toEqual([60, 62, 64, 65]);
        expect(view.scheduler.pending().timers).toBe(0);
        // At rest the whole shape is lit again.
        expect([60, 62, 64, 65].map(pressed)).toEqual(["true", "true", "true", "true"]);
    });

    it("stops the score it was playing when it is handed another", async () => {
        const view = mount(RISING);
        fireEvent.click(screen.getByRole("button", { name: "hear" }));
        const struck = view.audio.strikes.length;

        view.rerender(<SoundingKeyboard score={FALLING} label="hear" />);
        await advanceScheduler(view.scheduler, 60_000);

        // Nothing more of the first score sounds, and none of it is lit on the second.
        expect(view.audio.strikes).toHaveLength(struck);
        expect(view.scheduler.pending().timers).toBe(0);
        expect([60, 62, 64, 65].map(pressed)).toEqual(["false", "false", "false", "false"]);
        expect([79, 77, 76].map(pressed)).toEqual(["true", "true", "true"]);
    });

    it("keeps playing through a render that hands it the same score afresh", async () => {
        // A caller building the score inline hands over a new object on every render;
        // what it describes is unchanged, so the phrase must carry on.
        const view = mount(RISING);
        fireEvent.click(screen.getByRole("button", { name: "hear" }));
        view.rerender(<SoundingKeyboard score={structuredClone(RISING)} label="hear, again" />);
        await advanceScheduler(view.scheduler, 60_000);
        expect(view.audio.strikes.map((strike) => strike.note)).toEqual([60, 62, 64, 65]);
    });

    it("cancels what it has left to play when it goes away", async () => {
        const view = mount(RISING);
        fireEvent.click(screen.getByRole("button", { name: "hear" }));
        view.unmount();
        expect(view.scheduler.pending().timers).toBe(0);
    });
});
