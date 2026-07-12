// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toMusicXml } from "../../../core/composition";
import { ExportMenu } from "./exportMenu";

// OSMD is heavy and browser-only; print only needs it to leave an SVG in the
// off-screen host, so the fake renders one and records the lifecycle calls.
const osmdCalls = vi.hoisted(() => ({ load: 0, cleared: 0 }));
vi.mock("opensheetmusicdisplay", () => ({
    OpenSheetMusicDisplay: class {
        private host: HTMLElement;
        constructor(host: HTMLElement) {
            this.host = host;
        }
        async load() {
            osmdCalls.load++;
        }
        render() {
            this.host.innerHTML = "<svg><text>score</text></svg>";
        }
        clear() {
            osmdCalls.cleared++;
        }
    },
}));

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

    it("prints through a new window when the pop-up is allowed", async () => {
        const win = {
            document: { write: vi.fn(), close: vi.fn() },
            focus: vi.fn(),
            print: vi.fn(),
        };
        const open = vi.spyOn(window, "open").mockReturnValue(win as unknown as Window);
        openMenu();

        fireEvent.click(screen.getByRole("button", { name: /Print/ }));
        await waitFor(() => expect(win.print).toHaveBeenCalled());
        expect(open).toHaveBeenCalledWith("", "_blank");
        // The printed document carries the rendered staff and the title.
        expect(win.document.write.mock.calls[0]?.[0]).toContain("<svg>");
        expect(win.document.write.mock.calls[0]?.[0]).toContain("My Song");
        // The off-screen render host is torn down again (the toolbar's icon SVGs
        // remain — only the -99999px staging div must be gone).
        expect(osmdCalls.cleared).toBeGreaterThan(0);
        expect(document.querySelector('div[style*="-99999"]')).toBeNull();
    });

    it("falls back to a hidden iframe when the pop-up is blocked", async () => {
        vi.spyOn(window, "open").mockReturnValue(null);
        openMenu();

        fireEvent.click(screen.getByRole("button", { name: /Print/ }));
        await waitFor(() => expect(document.querySelector("iframe")).toBeTruthy());
        document.querySelector("iframe")?.remove();
    });

    it("exports nothing as MIDI for a score it cannot parse", () => {
        render(<ExportMenu xml="not musicxml" title="Broken" />);
        fireEvent.click(screen.getByRole("button", { name: "Export" }));
        fireEvent.click(screen.getByRole("button", { name: /Export MIDI/ }));
        expect(URL.createObjectURL).not.toHaveBeenCalled();
    });
});
