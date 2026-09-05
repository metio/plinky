// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { createRef, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { toMusicXml } from "../../core/composition";
import type { XmlCodec } from "../../core/xml";
import { domXmlCodec } from "../adapters/domXmlCodec";
import { memoryStore } from "../adapters/memoryStore";
import { ServicesProvider } from "../contexts/services";
import { useOsmdScore } from "./useOsmdScore";

// OSMD is heavy and browser-only; the reload only needs it to accept a load and draw
// something, so the fake records the loads and leaves an SVG behind.
const osmdCalls = vi.hoisted(() => ({ load: 0 }));
vi.mock("opensheetmusicdisplay", () => ({
    ColoringModes: { CustomColorSet: 1, XML: 0 },
    OpenSheetMusicDisplay: class {
        private host: HTMLElement;
        rules = {};
        Zoom = 1;
        FollowCursor = false;
        Sheet = { getCompleteNumberOfStaves: () => 2, SourceMeasures: [{}] };
        // An empty walk: the measure boxes are read off the cursor after every render.
        cursor = {
            show: () => {},
            hide: () => {},
            reset: () => {},
            next: () => {},
            iterator: { EndReached: true, CurrentMeasureIndex: 0 },
            GNotesUnderCursor: () => [],
        };
        constructor(host: HTMLElement) {
            this.host = host;
        }
        async load() {
            osmdCalls.load++;
        }
        render() {
            this.host.innerHTML = "<svg></svg>";
        }
        clear() {}
    },
}));

afterEach(cleanup);

const xml = toMusicXml({
    notes: [
        { pitch: 60, startMs: 0, durationMs: 500, velocity: 90 },
        { pitch: 62, startMs: 500, durationMs: 500, velocity: 90 },
    ],
    tempo: 120,
    beatsPerBar: 4,
});

const layout = {
    xml,
    transpose: 0,
    showMine: false,
    saved: {},
    barsPerRow: 0,
    noteScale: 1,
    barNumbers: false,
    treadmill: false,
    showBeams: true,
    showAccompaniment: false,
    colorNotes: false,
    focus: null,
    showFingerings: true,
    scrollFollow: true,
    onReload: () => {},
    onRendered: () => {},
    onFingeringRedraw: () => {},
};

function mount() {
    let parses = 0;
    const counting: XmlCodec = {
        parse: (text) => {
            parses += 1;
            return domXmlCodec.parse(text);
        },
        serialize: domXmlCodec.serialize,
    };
    // One world per mount: a store made per render would hand the hook fresh preferences
    // each time, which is a change of hand span and so of the notes.
    const store = memoryStore();
    const containerRef = createRef<HTMLDivElement>();
    (containerRef as { current: HTMLDivElement | null }).current = document.createElement("div");
    const wrapper = ({ children }: { children: ReactNode }) => (
        <ServicesProvider services={{ store, xml: counting }}>{children}</ServicesProvider>
    );
    const hook = renderHook((props: typeof layout) => useOsmdScore(containerRef, props), {
        wrapper,
        initialProps: layout,
    });
    return { hook, parses: () => parses };
}

describe("useOsmdScore", () => {
    it("reloads the engraver on a layout change without re-reading the notes", async () => {
        // Zoom, bars per row, bar numbers, the treadmill and a focus range change how the
        // piece is drawn and nothing about its notes; the transposition, fingering and
        // part-stripping passes over the MusicXML are settled once per change of the
        // notes and reused across every relayout.
        const { hook, parses } = mount();
        await waitFor(() =>
            expect(hook.result.current.loadError || hook.result.current.ready).toBe(true),
        );
        expect(hook.result.current.loadError).toBe(false);
        const loads = osmdCalls.load;
        const readings = parses();
        expect(readings).toBeGreaterThan(0);
        hook.rerender({ ...layout, noteScale: 1.5, barsPerRow: 2, barNumbers: true });
        await waitFor(() => expect(osmdCalls.load).toBe(loads + 1));
        await waitFor(() => expect(hook.result.current.ready).toBe(true));
        expect(parses()).toBe(readings);
    });

    it("re-reads the notes when what decides them changes", async () => {
        const { hook, parses } = mount();
        await waitFor(() => expect(hook.result.current.ready).toBe(true));
        const readings = parses();
        hook.rerender({ ...layout, transpose: 2 });
        await waitFor(() => expect(hook.result.current.ready).toBe(true));
        expect(parses()).toBeGreaterThan(readings);
    });
});
