// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toMusicXml } from "../../../core/composition";
import { ExportMenu } from "./exportMenu";

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
        return "blob:export";
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

const openMenu = () => {
    render(<ExportMenu xml={xml} title="My Song" />);
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
};

describe("ExportMenu", () => {
    it("stays closed until asked, then explains every option in plain words", () => {
        render(<ExportMenu xml={xml} title="My Song" />);
        expect(screen.queryByText(/GarageBand/)).toBeNull();
        const toggle = screen.getByRole("button", { name: "Export" });
        expect(toggle.getAttribute("aria-expanded")).toBe("false");
        fireEvent.click(toggle);
        expect(toggle.getAttribute("aria-expanded")).toBe("true");
        // Each option carries a what-is-this-for line, not just a format name.
        expect(screen.getByText(/or save it as a PDF/)).toBeTruthy();
        expect(screen.getByText(/GarageBand/)).toBeTruthy();
        expect(screen.getByText(/MuseScore/)).toBeTruthy();
    });

    it("downloads a .mid file named from the title, then closes", async () => {
        openMenu();
        fireEvent.click(screen.getByRole("button", { name: /Export MIDI/ }));
        expect(downloadName).toMatch(/\.mid$/);
        expect(downloadName).toContain("my-song");
        // A Standard MIDI File opens with the "MThd" header chunk.
        const head = new Uint8Array((await exported!.arrayBuffer()).slice(0, 4));
        expect(String.fromCharCode(...head)).toBe("MThd");
        expect(screen.queryByText(/GarageBand/)).toBeNull();
    });

    it("downloads the MusicXML itself, named from the title", async () => {
        openMenu();
        fireEvent.click(screen.getByRole("button", { name: /Export MusicXML/ }));
        expect(downloadName).toMatch(/\.musicxml$/);
        expect(await exported!.text()).toBe(xml);
    });

    it("exports nothing as MIDI for a score it cannot parse", () => {
        render(<ExportMenu xml="not musicxml" title="Broken" />);
        fireEvent.click(screen.getByRole("button", { name: "Export" }));
        fireEvent.click(screen.getByRole("button", { name: /Export MIDI/ }));
        expect(URL.createObjectURL).not.toHaveBeenCalled();
    });
});
