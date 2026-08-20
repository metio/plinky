// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { m } from "../../paraglide/messages.js";
import { SaveDiagram } from "./savePictureButton";

const downloads: { mime: string; filename: string; data: unknown }[] = [];
vi.mock("../../lib/download", () => ({
    downloadBlob: (data: unknown, mime: string, filename: string) =>
        downloads.push({ data, mime, filename }),
}));

// jsdom has no canvas, so the real rasteriser can only ever fail here — which is exactly
// the case the failure notice exists for, and it is stubbed per test where a PNG is
// meant to succeed.
vi.mock("../../lib/rasterize", () => ({ svgToPng: vi.fn(async () => null) }));
const { svgToPng } = await import("../../lib/rasterize");

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="460"></svg>';

afterEach(() => {
    cleanup();
    downloads.length = 0;
    vi.mocked(svgToPng).mockReset();
    vi.mocked(svgToPng).mockResolvedValue(null);
});

describe("SaveDiagram", () => {
    it("saves the drawing itself as SVG, with no rasteriser in the way", async () => {
        // The point of the format: a worksheet goes on paper, and the drawing prints at
        // whatever size the page is rather than the size it happened to be rasterised at.
        render(<SaveDiagram svg={() => SVG} filename="plinky-test" />);
        fireEvent.click(screen.getByRole("button", { name: m.tools_save_svg() }));
        await screen.findByRole("button", { name: m.tools_save_svg() });

        expect(downloads).toEqual([
            { data: SVG, mime: "image/svg+xml", filename: "plinky-test.svg" },
        ]);
        expect(svgToPng).not.toHaveBeenCalled();
    });

    it("rasterises for the picture format, at the document's own size", async () => {
        vi.mocked(svgToPng).mockResolvedValue(new Blob([new Uint8Array([1, 2, 3])]));
        render(<SaveDiagram svg={() => SVG} filename="plinky-test" />);
        fireEvent.click(screen.getByRole("button", { name: m.tools_save_picture() }));
        await vi.waitFor(() => expect(downloads).toHaveLength(1));

        expect(svgToPng).toHaveBeenCalledWith(SVG, 1200, 460);
        expect(downloads[0]).toMatchObject({ mime: "image/png", filename: "plinky-test.png" });
    });

    it("says so when a picture cannot be made, rather than dropping the press", async () => {
        render(<SaveDiagram svg={() => SVG} filename="plinky-test" />);
        fireEvent.click(screen.getByRole("button", { name: m.tools_save_picture() }));

        expect(await screen.findByText(m.feature_broken())).toBeTruthy();
        expect(downloads).toHaveLength(0);
    });

    it("builds nothing until a format is chosen", () => {
        // The markup is a thunk on purpose: a panel renders this button on every keystroke
        // and a drawing nobody saves should cost nothing.
        const build = vi.fn(() => SVG);
        render(<SaveDiagram svg={build} filename="plinky-test" />);
        expect(build).not.toHaveBeenCalled();
    });

    it("lets the caller name the picture button for what it saves", () => {
        render(
            <SaveDiagram svg={() => SVG} filename="plinky-test" pictureLabel="Save all seven" />,
        );
        expect(screen.getByRole("button", { name: "Save all seven" })).toBeTruthy();
    });
});
