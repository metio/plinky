// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { decodeGhost } from "../../../core/ghost";
import { ShareGhostButton } from "./shareGhostButton";

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

describe("ShareGhostButton", () => {
    it("copies a link carrying the run's onsets and confirms it", async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal("navigator", { clipboard: { writeText } });
        render(
            <ShareGhostButton id="song" title="Song" onsets={[0, 250, 500]} label="Challenge" />,
        );
        fireEvent.click(screen.getByRole("button", { name: /challenge/i }));
        expect(await screen.findByText(/link copied/i)).toBeTruthy();

        const url = writeText.mock.calls[0]![0] as string;
        expect(url).toContain("/play/song?ghost=");
        const code = new URL(url).searchParams.get("ghost") ?? "";
        // The shared code round-trips back to the same run the friend will race.
        expect(decodeGhost(code)).toEqual([0, 250, 500]);
    });

    it("uses the native share sheet when one exists, without copying", async () => {
        const share = vi.fn().mockResolvedValue(undefined);
        const writeText = vi.fn();
        vi.stubGlobal("navigator", { share, clipboard: { writeText } });
        render(<ShareGhostButton id="song" title="Song" onsets={[0, 100]} label="Challenge" />);
        fireEvent.click(screen.getByRole("button", { name: /challenge/i }));
        await Promise.resolve();
        expect(share).toHaveBeenCalledOnce();
        expect(writeText).not.toHaveBeenCalled();
        expect(screen.queryByText(/link copied/i)).toBeNull();
    });

    it("shows the label as visible text in the standalone variant", () => {
        vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn() } });
        render(
            <ShareGhostButton
                id="song"
                title="Song"
                onsets={[0]}
                label="Challenge a friend"
                showLabel
            />,
        );
        expect(screen.getByRole("button", { name: /challenge a friend/i }).textContent).toContain(
            "Challenge a friend",
        );
    });
});
