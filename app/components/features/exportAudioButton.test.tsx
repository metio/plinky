// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Take } from "../../../core/takes";
import { m } from "../../paraglide/messages.js";
import type { AudioExporter } from "../../ports/audioExporter";
import { renderWithServices } from "../../testing/renderWithServices";
import { ExportAudioButton } from "./exportAudioButton";

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
    URL.createObjectURL = vi.fn(() => "blob:audio");
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

const mount = (audioFile: AudioExporter) =>
    renderWithServices(<ExportAudioButton take={take} title="Menuet" />, { audioFile });

describe("ExportAudioButton", () => {
    it("names the file with the extension the engine actually produced", async () => {
        mount({
            export: async () => ({
                blob: new Blob(["x"], { type: "audio/mp4" }),
                extension: "m4a",
            }),
        });
        fireEvent.click(screen.getByRole("button", { name: m.takes_download_audio() }));
        await waitFor(() => expect(downloadName).toMatch(/\.m4a$/));
    });

    it("takes the extension from the export rather than assuming one", async () => {
        // The whole point of the port reporting a format: an engine with no encoder gets a
        // WAV, and a name hardcoded to .m4a would hand somebody a file their player refuses
        // for a reason nothing on screen explains.
        mount({
            export: async () => ({
                blob: new Blob(["x"], { type: "audio/wav" }),
                extension: "wav",
            }),
        });
        fireEvent.click(screen.getByRole("button", { name: m.takes_download_audio() }));
        await waitFor(() => expect(downloadName).toMatch(/\.wav$/));
    });

    it("is offered whatever the engine can do, unlike video", () => {
        mount({ export: vi.fn() });
        expect(screen.getByRole("button", { name: m.takes_download_audio() })).toBeTruthy();
    });

    it("says so in place when the export fails", async () => {
        mount({ export: async () => Promise.reject(new Error("no")) });
        fireEvent.click(screen.getByRole("button", { name: m.takes_download_audio() }));
        await waitFor(() =>
            expect(screen.getByRole("status").textContent).toBe(m.feature_broken()),
        );
        expect(downloadName).toBeNull();
    });

    it("comes back to life after a failure rather than staying disabled", async () => {
        // The busy flag is cleared in a finally, so a first attempt that throws must not
        // leave the button unusable for the rest of the session.
        let attempt = 0;
        mount({
            export: async () => {
                attempt += 1;
                if (attempt === 1) {
                    throw new Error("no");
                }
                return { blob: new Blob(["x"], { type: "audio/wav" }), extension: "wav" };
            },
        });
        const button = screen.getByRole("button", { name: m.takes_download_audio() });
        fireEvent.click(button);
        await waitFor(() => expect(screen.queryByRole("status")).not.toBeNull());
        fireEvent.click(screen.getByRole("button", { name: m.takes_download_audio() }));
        await waitFor(() => expect(downloadName).toMatch(/\.wav$/));
    });

    it("refuses a second export while one is running", async () => {
        let started = 0;
        mount({
            export: () => {
                started += 1;
                return new Promise(() => {});
            },
        });
        const button = screen.getByRole("button", { name: m.takes_download_audio() });
        fireEvent.click(button);
        await waitFor(() =>
            expect(screen.getByRole("button").textContent).toBe(m.takes_audio_working()),
        );
        fireEvent.click(screen.getByRole("button"));
        expect(started).toBe(1);
    });
});
