// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toMusicXml } from "../../core/composition";
import { ExportButton } from "./exportButton";

const xml = toMusicXml({
    notes: [
        { pitch: 60, startMs: 0, durationMs: 500, velocity: 90 },
        { pitch: 62, startMs: 500, durationMs: 500, velocity: 90 },
    ],
    tempo: 120,
    beatsPerBar: 4,
});

let downloadName: string | null;
let exported: Blob | null;

beforeEach(() => {
    downloadName = null;
    exported = null;
    URL.createObjectURL = vi.fn((blob: Blob) => {
        exported = blob;
        return "blob:midi";
    });
    URL.revokeObjectURL = vi.fn();
    // Capture the anchor the export builds so the download name can be asserted
    // without a real navigation.
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
        const el = realCreate(tag);
        if (tag === "a") {
            vi.spyOn(el as HTMLAnchorElement, "click").mockImplementation(() => {
                downloadName = (el as HTMLAnchorElement).download;
            });
        }
        return el;
    });
});

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

describe("ExportButton", () => {
    it("downloads a .mid file named from the title, derived from the MusicXML", async () => {
        render(<ExportButton xml={xml} title="My Song" />);
        fireEvent.click(screen.getByRole("button", { name: /midi/i }));
        expect(downloadName).toMatch(/\.mid$/);
        expect(downloadName).toContain("my-song");
        // A Standard MIDI File opens with the "MThd" header chunk.
        const head = new Uint8Array((await exported!.arrayBuffer()).slice(0, 4));
        expect(String.fromCharCode(...head)).toBe("MThd");
    });

    it("does nothing for a score it cannot parse", () => {
        render(<ExportButton xml="not musicxml" title="Broken" />);
        fireEvent.click(screen.getByRole("button", { name: /midi/i }));
        expect(URL.createObjectURL).not.toHaveBeenCalled();
    });
});
