// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { createRef, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { toMusicXml } from "../../core/composition";
import type { XmlCodec } from "../../core/xml";
import { domXmlCodec } from "../adapters/domXmlCodec";
import { memoryStore } from "../adapters/memoryStore";
import { type AppServices, ServicesProvider } from "../contexts/services";
import { fakeScheduler } from "../testing/fakeScheduler";
import { useOsmdScore } from "./useOsmdScore";

// OSMD is heavy and browser-only; the reload only needs it to accept a load and draw
// something, so the fake records the loads and leaves an SVG behind. With `walk` on, the
// cursor stands on one note drawn as that SVG's <g>, so a redraw has a notehead to carry
// across the render; off, the walk is empty.
const osmdCalls = vi.hoisted(() => ({ load: 0, walk: false }));
vi.mock("opensheetmusicdisplay", () => ({
    ColoringModes: { CustomColorSet: 1, XML: 0 },
    OpenSheetMusicDisplay: class {
        private host: HTMLElement;
        private at = 0;
        rules = {};
        Zoom = 1;
        FollowCursor = false;
        Sheet = { getCompleteNumberOfStaves: () => 2, SourceMeasures: [{}] };
        cursor = ((osmd) => ({
            show: () => {},
            hide: () => {},
            reset: () => {
                osmd.at = 0;
            },
            next: () => {
                osmd.at += 1;
            },
            iterator: {
                get EndReached() {
                    return !osmdCalls.walk || osmd.at >= 1;
                },
                CurrentMeasureIndex: 0,
            },
            GNotesUnderCursor: () =>
                osmdCalls.walk && osmd.at < 1
                    ? [
                          {
                              sourceNote: { halfTone: 48, isRest: () => false },
                              getSVGGElement: () => osmd.host.querySelector("g") ?? undefined,
                          },
                      ]
                    : [],
        }))(this);
        constructor(host: HTMLElement) {
            this.host = host;
        }
        async load() {
            osmdCalls.load++;
        }
        render() {
            this.host.innerHTML = "<svg><g></g></svg>";
        }
        updateGraphic() {}
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
    chordSymbols: false,
    showAccompaniment: false,
    colorNotes: false,
    focus: null,
    showFingerings: true,
    scrollFollow: true,
    onReload: () => {},
    onRendered: () => {},
    onFingeringRedraw: () => {},
};

function mount(services: Partial<AppServices> = {}) {
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
        <ServicesProvider services={{ store, xml: counting, ...services }}>
            {children}
        </ServicesProvider>
    );
    const hook = renderHook((props: typeof layout) => useOsmdScore(containerRef, props), {
        wrapper,
        initialProps: layout,
    });
    return { hook, parses: () => parses, container: containerRef.current! };
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

    it("hands back the same object across a render that changes nothing", async () => {
        // The play session builds a context value on this; a fresh object per render
        // would re-render every consumer on every note.
        const { hook } = mount();
        await waitFor(() =>
            expect(hook.result.current.loadError || hook.result.current.ready).toBe(true),
        );
        const before = hook.result.current;
        hook.rerender(layout);
        expect(hook.result.current).toBe(before);
    });

    it("hands the in-place fingering redraw's remap on, from a notehead to its fresh one", async () => {
        // The transports holding lit noteheads follow them through this remap; a redraw
        // that did not pass it on would leave them lifting noteheads the render discarded.
        osmdCalls.walk = true;
        try {
            const scheduler = fakeScheduler();
            const { hook, container } = mount({ scheduler });
            await waitFor(() => expect(hook.result.current.ready).toBe(true));
            const drawn = container.querySelector("g");
            expect(drawn).not.toBeNull();
            const onFingeringRedraw = vi.fn();
            hook.rerender({ ...layout, showFingerings: false, onFingeringRedraw });
            act(() => scheduler.runFrames());
            expect(onFingeringRedraw).toHaveBeenCalledOnce();
            const fresh = container.querySelector("g");
            expect(fresh).not.toBe(drawn);
            expect(onFingeringRedraw.mock.calls[0]![0](drawn)).toBe(fresh);
        } finally {
            osmdCalls.walk = false;
        }
    });
});
