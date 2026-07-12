// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Composition, decodeComposition } from "../../core/composition";
import { parseMidiFile } from "../../core/midiParse";
import { useCompositionExport } from "./useCompositionExport";

const downloads: { mime: string; filename: string; data: Uint8Array | string }[] = [];
vi.mock("../lib/download", () => ({
    downloadBlob: (data: Uint8Array | string, mime: string, filename: string) =>
        downloads.push({ data, mime, filename }),
}));

const COMPOSITION: Composition = {
    notes: [
        { pitch: 60, startMs: 0, durationMs: 400, velocity: 90 },
        { pitch: 64, startMs: 500, durationMs: 400, velocity: 90 },
    ],
    tempo: 120,
    beatsPerBar: 4,
};

afterEach(() => {
    downloads.length = 0;
    vi.unstubAllGlobals();
});

describe("useCompositionExport", () => {
    it("copies a share link whose code decodes back to the composition", async () => {
        const written: string[] = [];
        vi.stubGlobal("navigator", {
            clipboard: {
                writeText: (text: string) => {
                    written.push(text);
                    return Promise.resolve();
                },
            },
        });
        const { result } = renderHook(() => useCompositionExport(COMPOSITION, "My Tune"));
        act(() => result.current.share());
        await waitFor(() => expect(result.current.copied).toBe(true));
        const url = new URL(written[0] ?? "");
        expect(url.pathname.endsWith("/compose")).toBe(true);
        expect(decodeComposition(url.searchParams.get("c") ?? "")).toEqual(COMPOSITION);
    });

    it("downloads a MIDI file that parses back to the recorded notes", () => {
        const { result } = renderHook(() => useCompositionExport(COMPOSITION, "My Tune"));
        act(() => result.current.downloadMidi());
        const file = downloads[0];
        expect(file?.mime).toBe("audio/midi");
        expect(file?.filename).toBe("my-tune.mid");
        const parsed = parseMidiFile(file?.data as Uint8Array);
        expect(parsed?.notes.map((note) => note.pitch)).toEqual([60, 64]);
        expect(parsed?.tempo).toBe(120);
    });

    it("downloads MusicXML carrying the title", () => {
        const { result } = renderHook(() => useCompositionExport(COMPOSITION, "My Tune"));
        act(() => result.current.downloadMusicXml());
        const file = downloads[0];
        expect(file?.mime).toBe("application/vnd.recordare.musicxml+xml");
        expect(file?.filename).toBe("my-tune.musicxml");
        expect(String(file?.data)).toContain("My Tune");
        expect(String(file?.data)).toContain("<score-partwise");
    });
});
