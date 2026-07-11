// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KeyboardQuickControls } from "./keyboardQuickControls";

afterEach(cleanup);

const noop = () => {};

describe("KeyboardQuickControls", () => {
    it("cycles the window width wider and wraps All back to one octave", () => {
        const onOctaves = vi.fn();
        const { rerender } = render(
            <KeyboardQuickControls
                hidden={false}
                onToggleHidden={noop}
                octaves={2}
                onOctaves={onOctaves}
                noteLabels="c"
                onNoteLabels={noop}
            />,
        );
        fireEvent.click(screen.getByRole("button", { name: "Keys: 2" }));
        expect(onOctaves).toHaveBeenCalledWith(3);

        rerender(
            <KeyboardQuickControls
                hidden={false}
                onToggleHidden={noop}
                octaves={0}
                onOctaves={onOctaves}
                noteLabels="c"
                onNoteLabels={noop}
            />,
        );
        fireEvent.click(screen.getByRole("button", { name: "Keys: All" }));
        expect(onOctaves).toHaveBeenLastCalledWith(1);
    });

    it("cycles the note names from every key to just C to off", () => {
        const onNoteLabels = vi.fn();
        render(
            <KeyboardQuickControls
                hidden={false}
                onToggleHidden={noop}
                octaves={2}
                onOctaves={noop}
                noteLabels="all"
                onNoteLabels={onNoteLabels}
            />,
        );
        fireEvent.click(screen.getByRole("button", { name: "Note names on the keys: Every key" }));
        expect(onNoteLabels).toHaveBeenCalledWith("c");
    });

    it("folds down to just the way back when the keys are hidden", () => {
        const onToggleHidden = vi.fn();
        render(
            <KeyboardQuickControls
                hidden
                onToggleHidden={onToggleHidden}
                octaves={2}
                onOctaves={noop}
                noteLabels="c"
                onNoteLabels={noop}
            />,
        );
        // The cycles disappear with the keys; only the show-keys toggle remains.
        expect(screen.getAllByRole("button")).toHaveLength(1);
        fireEvent.click(screen.getByRole("button", { name: "Show keys" }));
        expect(onToggleHidden).toHaveBeenCalledTimes(1);
    });
});
