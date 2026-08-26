// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { m } from "../../paraglide/messages.js";
import { pressed } from "../../testing/controls";
import { KeyboardQuickControls } from "./keyboardQuickControls";

afterEach(cleanup);

const noop = () => {};

function renderControls(overrides: Partial<Parameters<typeof KeyboardQuickControls>[0]> = {}) {
    return render(
        <KeyboardQuickControls
            hidden={false}
            onToggleHidden={noop}
            noteLabels="c"
            onNoteLabels={noop}
            noteHints="miss"
            onNoteHints={noop}
            {...overrides}
        />,
    );
}

describe("KeyboardQuickControls", () => {
    it("cycles the note names from every key to just C to off", () => {
        const onNoteLabels = vi.fn();
        renderControls({ noteLabels: "all", onNoteLabels });
        fireEvent.click(screen.getByRole("button", { name: "Note names on the keys: Every key" }));
        expect(onNoteLabels).toHaveBeenCalledWith("c");
    });

    it("cycles the next-note hint and wraps never back to always", () => {
        const onNoteHints = vi.fn();
        const { rerender } = renderControls({ noteHints: "miss", onNoteHints });
        fireEvent.click(
            screen.getByRole("button", { name: /Show the next note.*|.*next note.*/i }),
        );
        expect(onNoteHints).toHaveBeenCalledWith("never");

        rerender(
            <KeyboardQuickControls
                hidden={false}
                onToggleHidden={noop}
                noteLabels="c"
                onNoteLabels={noop}
                noteHints="never"
                onNoteHints={onNoteHints}
            />,
        );
        fireEvent.click(
            screen.getByRole("button", { name: /Show the next note.*|.*next note.*/i }),
        );
        expect(onNoteHints).toHaveBeenLastCalledWith("always");
    });

    it("hands the sound to an instrument that makes its own", () => {
        const onInstrumentSounds = vi.fn();
        renderControls({ instrumentSounds: false, onInstrumentSounds });
        fireEvent.click(screen.getByRole("button", { name: m.settings_instrument_sounds() }));
        expect(onInstrumentSounds).toHaveBeenCalledWith(true);
    });

    it("keeps the sound switch reachable with the keys folded away", () => {
        // Folding the keys away is what somebody playing a real piano does, and they are
        // exactly the player this switch is for — so it outlives the cycles.
        renderControls({ hidden: true, instrumentSounds: true, onInstrumentSounds: noop });
        expect(pressed(m.settings_instrument_sounds)).toBe(true);
    });

    it("folds down to just the way back when the keys are hidden", () => {
        const onToggleHidden = vi.fn();
        renderControls({ hidden: true, onToggleHidden });
        // The cycles disappear with the keys; only the show-keys toggle remains.
        expect(screen.getAllByRole("button")).toHaveLength(1);
        fireEvent.click(screen.getByRole("button", { name: "Show keys" }));
        expect(onToggleHidden).toHaveBeenCalledTimes(1);
    });
});
