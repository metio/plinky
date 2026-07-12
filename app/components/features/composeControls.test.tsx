// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ComposeControls } from "./composeControls";

const noop = () => {};

const mount = (overrides: Partial<Parameters<typeof ComposeControls>[0]> = {}) =>
    render(
        <ComposeControls
            empty={false}
            playing={false}
            countingIn={false}
            checkpoint={null}
            onCountIn={noop}
            onPlay={noop}
            onStop={noop}
            onSetCheckpoint={noop}
            onResetToCheckpoint={noop}
            onClear={noop}
            {...overrides}
        />,
    );

afterEach(cleanup);

describe("ComposeControls", () => {
    it("swaps Play for Stop while the take replays", () => {
        const onPlay = vi.fn();
        const onStop = vi.fn();
        mount({ onPlay, onStop });
        fireEvent.click(screen.getByRole("button", { name: "Play" }));
        expect(onPlay).toHaveBeenCalledTimes(1);
        cleanup();
        mount({ playing: true, onPlay, onStop });
        fireEvent.click(screen.getByRole("button", { name: "Stop" }));
        expect(onStop).toHaveBeenCalledTimes(1);
    });

    it("disables the take-dependent actions while the canvas is empty", () => {
        mount({ empty: true });
        expect(screen.getByRole("button", { name: "Play" })).toHaveProperty("disabled", true);
        expect(screen.getByRole("button", { name: "Set checkpoint" })).toHaveProperty(
            "disabled",
            true,
        );
        expect(screen.getByRole("button", { name: "Clear" })).toHaveProperty("disabled", true);
        // Count in stays available — it starts a fresh take at beat one.
        expect(screen.getByRole("button", { name: "Count in" })).toHaveProperty("disabled", false);
    });

    it("cancels an armed count-in from either button, even on an empty canvas", () => {
        const onCountIn = vi.fn();
        const onStop = vi.fn();
        mount({ countingIn: true, empty: true, onCountIn, onStop });

        // The armed primary is a cancel, not a locked status.
        fireEvent.click(screen.getByRole("button", { name: /Counting in/ }));
        expect(onStop).toHaveBeenCalledTimes(1);
        expect(onCountIn).not.toHaveBeenCalled();

        // The transport button reads Stop and works too — no note needs to exist.
        const stop = screen.getByRole("button", { name: "Stop" });
        expect(stop).toHaveProperty("disabled", false);
        fireEvent.click(stop);
        expect(onStop).toHaveBeenCalledTimes(2);
    });

    it("labels the checkpoint reset with the kept note count", () => {
        const onResetToCheckpoint = vi.fn();
        mount({ checkpoint: 12, onResetToCheckpoint });
        fireEvent.click(screen.getByRole("button", { name: /Reset to checkpoint \(12\)/ }));
        expect(onResetToCheckpoint).toHaveBeenCalledTimes(1);
    });

    it("clears only after the armed confirm", () => {
        const onClear = vi.fn();
        mount({ onClear });
        fireEvent.click(screen.getByRole("button", { name: "Clear" }));
        expect(onClear).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "Clear all?" }));
        expect(onClear).toHaveBeenCalledTimes(1);
    });
});
