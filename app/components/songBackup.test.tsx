// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SongBackup } from "./songBackup";

const PACK = JSON.stringify({
    format: "plinky-songs",
    version: 1,
    curriculums: [{ id: "g1", name: "Grade 1" }],
    songs: [
        { id: "x", title: "X", xml: "<score-partwise><part/></score-partwise>" },
        { id: "y", title: "Y", xml: "<score-partwise><part/></score-partwise>" },
    ],
});

function fileInput(container: HTMLElement): HTMLInputElement {
    const input = container.querySelector('input[type="file"]');
    if (!input) {
        throw new Error("file input not found");
    }
    return input as HTMLInputElement;
}

afterEach(() => localStorage.clear());

describe("SongBackup", () => {
    it("imports a pack from a file and reports the counts", async () => {
        const { container } = render(<SongBackup />);
        fireEvent.change(fileInput(container), {
            target: { files: [new File([PACK], "pack.json", { type: "application/json" })] },
        });
        expect(await screen.findByText("Imported 2 songs and 1 curriculum.")).toBeTruthy();
    });

    it("reports a friendly error for a file that is not a pack", async () => {
        const { container } = render(<SongBackup />);
        fireEvent.change(fileInput(container), {
            target: { files: [new File(["not json"], "x.json")] },
        });
        expect(await screen.findByText(/not valid JSON/)).toBeTruthy();
    });
});
