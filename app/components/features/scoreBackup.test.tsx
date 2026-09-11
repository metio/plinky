// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { m } from "../../paraglide/messages.js";
import { afterEach, describe, expect, it } from "vitest";
import { memoryStore } from "../../adapters/memoryStore";
import { removeUserScore, type Score, saveUserScore } from "../../lib/catalog";
import { renderWithServices } from "../../testing/renderWithServices";
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

afterEach(() => {
    cleanup();
    localStorage.clear();
});

describe("ScoreBackup", () => {
    it("imports a bundle from a file and reports the count", async () => {
        const { container } = render(
            <MemoryRouter>
                <ScoreBackup />
            </MemoryRouter>,
        );
        fireEvent.change(fileInput(container), {
            target: { files: [new File([PACK], "pack.json", { type: "application/json" })] },
        });
        expect(await screen.findByText("Imported 2 scores.")).toBeTruthy();
    });

    it("reports a friendly error for a file that is not a pack", async () => {
        const { container } = render(
            <MemoryRouter>
                <ScoreBackup />
            </MemoryRouter>,
        );
        fireEvent.change(fileInput(container), {
            target: { files: [new File(["not json"], "x.json")] },
        });
        // The message is the app's translated one, not core's English: core has no
        // language, and asserting its wording here is what let English reach the other
        // twenty-five locales unnoticed.
        expect(await screen.findByText(m.backup_import_error())).toBeTruthy();
    });

    it("ignores a slower earlier read once a newer file has been picked", async () => {
        const { container } = render(
            <MemoryRouter>
                <ScoreBackup />
            </MemoryRouter>,
        );
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

describe("ScoreBackup's count of the library", () => {
    const score: Score = {
        id: "mine",
        title: "Mine",
        composer: "",
        description: "",
        xml: "<score-partwise><part/></score-partwise>",
        tempo: 90,
        beatsPerBar: 4,
        bundled: false,
    };
    const mount = () =>
        renderWithServices(
            <MemoryRouter>
                <ScoreBackup />
            </MemoryRouter>,
        );
    const downloadMine = () => screen.getByRole("button", { name: m.backup_download() });
    const intro = (count: number) => m.backup_intro({ count: m.backup_scores({ count }) });

    it("follows a score added elsewhere on the page", () => {
        // The import sits right above the backup on the Manage tab and saves through the
        // catalogue, not through this component — the backup has to hear about it anyway.
        const { services } = mount();
        expect(screen.getByText(intro(0))).toBeTruthy();
        expect(downloadMine().hasAttribute("disabled")).toBe(true);

        act(() => {
            saveUserScore(services.store, score);
        });

        expect(screen.getByText(intro(1))).toBeTruthy();
        expect(downloadMine().hasAttribute("disabled")).toBe(false);
    });

    it("follows a score removed elsewhere, back to nothing to download", () => {
        const store = memoryStore();
        saveUserScore(store, score);
        renderWithServices(
            <MemoryRouter>
                <ScoreBackup />
            </MemoryRouter>,
            { store },
        );
        expect(downloadMine().hasAttribute("disabled")).toBe(false);

        act(() => {
            removeUserScore(store, score.id);
        });

        expect(screen.getByText(intro(0))).toBeTruthy();
        expect(downloadMine().hasAttribute("disabled")).toBe(true);
    });

    it("counts what its own bundle import brought in", async () => {
        const { container } = mount();
        fireEvent.change(fileInput(container), {
            target: { files: [new File([PACK], "pack.json", { type: "application/json" })] },
        });
        expect(await screen.findByText(intro(2))).toBeTruthy();
        expect(downloadMine().hasAttribute("disabled")).toBe(false);
    });
});
