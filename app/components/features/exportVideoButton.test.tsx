// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Take } from "../../../core/takes";
import { takeFileStem } from "../../lib/takeFile";
import type { VideoExporter } from "../../ports/videoExporter";
import { renderWithServices } from "../../testing/renderWithServices";
import { ExportVideoButton } from "./exportVideoButton";

const take: Take = {
    id: "t1",
    createdAt: 0,
    letter: "A",
    complete: true,
    metrics: null,
    composition: {
        notes: [{ pitch: 60, startMs: 0, durationMs: 500, velocity: 90 }],
        tempo: 120,
        beatsPerBar: 4,
    },
};

let downloadName: string | null;

beforeEach(() => {
    downloadName = null;
    URL.createObjectURL = vi.fn(() => "blob:video");
    URL.revokeObjectURL = vi.fn();
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

const mount = (video: VideoExporter) =>
    renderWithServices(<ExportVideoButton take={take} title="Menuet" credit="Menuet · Bach" />, {
        video,
    });

describe("ExportVideoButton", () => {
    it("stays out of the panel where the engine can't encode", async () => {
        mount({ supported: async () => false, export: vi.fn() });
        // Give the capability check a beat, then confirm nothing appeared.
        await waitFor(() => expect(screen.queryByRole("button")).toBeNull());
    });

    it("exports the take's notes and downloads the file", async () => {
        const exportMock = vi.fn<VideoExporter["export"]>(
            async () => new Blob(["mp4"], { type: "video/mp4" }),
        );
        mount({ supported: async () => true, export: exportMock });
        fireEvent.click(await screen.findByRole("button", { name: "Video" }));
        fireEvent.click(screen.getByRole("button", { name: "Save video" }));
        await waitFor(() => expect(downloadName).toBe(`${takeFileStem("Menuet", take)}.mp4`));
        expect(exportMock.mock.calls[0]?.[0]?.notes).toEqual(take.composition.notes);
        // The default orientation is landscape 720p.
        expect(exportMock.mock.calls[0]?.[0]?.width).toBe(1280);
        expect(exportMock.mock.calls[0]?.[0]?.height).toBe(720);
    });

    it("swaps the axes when the 9:16 format is picked", async () => {
        const exportMock = vi.fn<VideoExporter["export"]>(
            async () => new Blob(["mp4"], { type: "video/mp4" }),
        );
        mount({ supported: async () => true, export: exportMock });
        fireEvent.click(await screen.findByRole("button", { name: "Video" }));
        fireEvent.click(screen.getByRole("tab", { name: "9:16" }));
        fireEvent.click(screen.getByRole("button", { name: /Save a portrait video/ }));
        await waitFor(() => expect(downloadName).toBe(`${takeFileStem("Menuet", take)}.mp4`));
        expect(exportMock.mock.calls[0]?.[0]?.width).toBe(720);
        expect(exportMock.mock.calls[0]?.[0]?.height).toBe(1280);
    });

    it("scales the encode to the picked quality and frame rate", async () => {
        const exportMock = vi.fn<VideoExporter["export"]>(
            async () => new Blob(["mp4"], { type: "video/mp4" }),
        );
        mount({ supported: async () => true, export: exportMock });
        fireEvent.click(await screen.findByRole("button", { name: "Video" }));
        fireEvent.click(screen.getByRole("tab", { name: "1080p" }));
        fireEvent.click(screen.getByRole("tab", { name: "60" }));
        fireEvent.click(screen.getByRole("button", { name: "Save video" }));
        await waitFor(() => expect(downloadName).toBe(`${takeFileStem("Menuet", take)}.mp4`));
        expect(exportMock.mock.calls[0]?.[0]?.width).toBe(1920);
        expect(exportMock.mock.calls[0]?.[0]?.height).toBe(1080);
        expect(exportMock.mock.calls[0]?.[0]?.fps).toBe(60);
    });

    it("offers the title and watermark switches, on by default", async () => {
        mount({ supported: async () => true, export: vi.fn() });
        fireEvent.click(await screen.findByRole("button", { name: "Video" }));
        const title = await screen.findByRole("switch", { name: "Title" });
        const watermark = screen.getByRole("switch", { name: "Watermark" });
        expect(title.getAttribute("aria-checked")).toBe("true");
        expect(watermark.getAttribute("aria-checked")).toBe("true");
        // Both are independent of the layout switches, so they stay put in portrait too.
        fireEvent.click(title);
        expect(title.getAttribute("aria-checked")).toBe("false");
        fireEvent.click(screen.getByRole("tab", { name: "9:16" }));
        expect(screen.getByRole("switch", { name: "Watermark" })).toBeTruthy();
    });

    it("hides the keyboard switch where it has no effect", async () => {
        mount({ supported: async () => true, export: vi.fn() });
        fireEvent.click(await screen.findByRole("button", { name: "Video" }));
        // Landscape with the score on offers it…
        expect(await screen.findByRole("switch", { name: "Keyboard" })).toBeTruthy();
        // …the score off leaves only the keyboard, so the switch goes…
        fireEvent.click(screen.getByRole("switch", { name: "Score" }));
        expect(screen.queryByRole("switch", { name: "Keyboard" })).toBeNull();
        // …and portrait is score-only by design.
        fireEvent.click(screen.getByRole("switch", { name: "Score" }));
        fireEvent.click(screen.getByRole("tab", { name: "9:16" }));
        expect(screen.queryByRole("switch", { name: "Keyboard" })).toBeNull();
    });
});
