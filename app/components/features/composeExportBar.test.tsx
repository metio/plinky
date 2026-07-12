// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ComposeExportBar } from "./composeExportBar";

const noop = () => {};

const mount = (overrides: Partial<Parameters<typeof ComposeExportBar>[0]> = {}) =>
    render(
        <ComposeExportBar
            empty={false}
            noteCount={2}
            copied={false}
            onShare={noop}
            onDownloadMidi={noop}
            onDownloadMusicXml={noop}
            onOpenFile={noop}
            uploadError={null}
            pendingReplace={false}
            onConfirmReplace={noop}
            onCancelReplace={noop}
            {...overrides}
        />,
    );

afterEach(cleanup);

describe("ComposeExportBar", () => {
    it("shares and downloads through the callbacks, showing the copied flash", () => {
        const onShare = vi.fn();
        const onDownloadMidi = vi.fn();
        const onDownloadMusicXml = vi.fn();
        mount({ onShare, onDownloadMidi, onDownloadMusicXml });
        fireEvent.click(screen.getByRole("button", { name: "Copy share link" }));
        fireEvent.click(screen.getByRole("button", { name: "Download MIDI" }));
        fireEvent.click(screen.getByRole("button", { name: "Download MusicXML" }));
        expect(onShare).toHaveBeenCalledTimes(1);
        expect(onDownloadMidi).toHaveBeenCalledTimes(1);
        expect(onDownloadMusicXml).toHaveBeenCalledTimes(1);
        cleanup();
        mount({ copied: true });
        expect(screen.getByRole("button", { name: "Copied!" })).toBeTruthy();
    });

    it("disables exports for an empty take and shows the note count", () => {
        mount({ empty: true, noteCount: 0 });
        expect(screen.getByRole("button", { name: "Copy share link" })).toHaveProperty(
            "disabled",
            true,
        );
        expect(screen.getByText("0 notes")).toBeTruthy();
    });

    it("hands a chosen file over and resets the input so the same file reopens", () => {
        const onOpenFile = vi.fn();
        const { container } = mount({ onOpenFile });
        const input = container.querySelector('input[type="file"]') as HTMLInputElement;
        const file = new File(["x"], "take.mid", { type: "audio/midi" });
        fireEvent.change(input, { target: { files: [file] } });
        expect(onOpenFile).toHaveBeenCalledWith(file);
        expect(input.value).toBe("");
    });

    it("surfaces an upload error", () => {
        mount({ uploadError: "Couldn't read that file." });
        expect(screen.getByText("Couldn't read that file.")).toBeTruthy();
    });

    it("offers the replace confirmation with confirm and cancel", () => {
        const onConfirmReplace = vi.fn();
        const onCancelReplace = vi.fn();
        mount({ pendingReplace: true, onConfirmReplace, onCancelReplace });
        expect(screen.getByText("Replace your current recording?")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "Replace" }));
        expect(onConfirmReplace).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
        expect(onCancelReplace).toHaveBeenCalledTimes(1);
    });
});
