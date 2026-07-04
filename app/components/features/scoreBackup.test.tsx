// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ScoreBackup } from "./scoreBackup";

const PACK = JSON.stringify({
    format: "plinky-scores",
    version: 1,
    scores: [
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

describe("ScoreBackup", () => {
    it("imports a bundle from a file and reports the count", async () => {
        const { container } = render(<ScoreBackup />);
        fireEvent.change(fileInput(container), {
            target: { files: [new File([PACK], "pack.json", { type: "application/json" })] },
        });
        expect(await screen.findByText("Imported 2 scores.")).toBeTruthy();
    });

    it("reports a friendly error for a file that is not a pack", async () => {
        const { container } = render(<ScoreBackup />);
        fireEvent.change(fileInput(container), {
            target: { files: [new File(["not json"], "x.json")] },
        });
        expect(await screen.findByText(/not valid JSON/)).toBeTruthy();
    });

    it("ignores a slower earlier read once a newer file has been picked", async () => {
        const { container } = render(<ScoreBackup />);
        const pack = (n: number) =>
            JSON.stringify({
                format: "plinky-scores",
                version: 1,
                scores: Array.from({ length: n }, (_, i) => ({
                    id: `s${i}`,
                    title: `S${i}`,
                    xml: "<score-partwise><part/></score-partwise>",
                })),
            });
        // The first pick reads slowly; the second resolves first. The status must
        // reflect the newer pick, and the stale read must not clobber it.
        let releaseSlow = () => {};
        const slow = {
            name: "a.json",
            text: () =>
                new Promise<string>((r) => {
                    releaseSlow = () => r(pack(1));
                }),
        };
        const fast = { name: "b.json", text: () => Promise.resolve(pack(3)) };

        const input = fileInput(container);
        fireEvent.change(input, { target: { files: [slow] } });
        fireEvent.change(input, { target: { files: [fast] } });

        expect(await screen.findByText("Imported 3 scores.")).toBeTruthy();
        releaseSlow();
        // Let the slow read settle; the guard keeps the newer status in place.
        await new Promise((r) => setTimeout(r, 0));
        expect(screen.queryByText("Imported 1 score.")).toBeNull();
        expect(screen.getByText("Imported 3 scores.")).toBeTruthy();
    });
});
