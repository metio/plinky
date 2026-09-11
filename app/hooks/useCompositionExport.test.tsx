// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Composition, decodeComposition } from "../../core/composition";
import { parseMidiFile } from "../../core/midiParse";
import { m } from "../paraglide/messages.js";
import { baseLocale, overwriteGetLocale } from "../paraglide/runtime.js";
import { useCompositionExport } from "./useCompositionExport";

const downloads: { mime: string; filename: string; data: Uint8Array | string }[] = [];
// The mock keeps the real media types and extensions, so the assertions below still pin
// what actually reaches the browser rather than what the hook meant to send.
vi.mock("../lib/download", () => ({
    downloadBlob: (data: Uint8Array | string, mime: string, filename: string) =>
        downloads.push({ data, mime, filename }),
    downloadMidi: (data: Uint8Array | string, stem: string) =>
        downloads.push({ data, mime: "audio/midi", filename: `${stem}.mid` }),
    downloadMusicXml: (data: Uint8Array | string, stem: string) =>
        downloads.push({
            data,
            mime: "application/vnd.recordare.musicxml+xml",
            filename: `${stem}.musicxml`,
        }),
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
        expect(url.pathname.endsWith("/compose/")).toBe(true);
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

    it("names and heads a fresh take's files in the reader's language", () => {
        // The title a fresh take starts with, as Compose seeds it: in Spanish the word
        // differs from English, so an English literal cannot pass for it.
        overwriteGetLocale(() => "es");
        try {
            const title = m.compose_default_title();
            expect(title).toBe("Improvisación");
            const { result } = renderHook(() => useCompositionExport(COMPOSITION, title));
            act(() => result.current.downloadMidi());
            act(() => result.current.downloadMusicXml());
            expect(downloads.map((file) => file.filename)).toEqual([
                "improvisacion.mid",
                "improvisacion.musicxml",
            ]);
            expect(String(downloads[1]?.data)).toContain("<work-title>Improvisación</work-title>");
        } finally {
            overwriteGetLocale(() => baseLocale);
        }
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
