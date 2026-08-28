// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Renders a catalogue piece to a video file, in a real browser, through the app's own
// export path. Loaded by dev/promo-videos.mjs, which drives a headless Chromium against
// the dev server — WebCodecs and OfflineAudioContext exist nowhere else, and running the
// app's real painter and encoder is the point: a promo clip should look and sound exactly
// like what the app produces, not like a second renderer that drifts from it.
//
// Nothing here is shipped. It is dev tooling that happens to run in a browser.

import { decompressMxl } from "../../core/musicxmlFile";
import { clipCut, gapsIn, LOOKAHEAD_MS, PROMO_WINDOW } from "../../core/clipEnd";
import type { RecordedNote } from "../../core/composition";
import { listenPerformanceOf } from "../../core/listenPerformance";
import {
    DEFAULT_KEYBOARD_DEPTH,
    DEFAULT_NOTE_COLOR,
    keyboardDepthFraction,
    noteColorHex,
} from "../../core/videoLook";
import { GLOSSY } from "../../core/keyboardFinish";
import { DEFAULT_THEME } from "../../core/keyboardTheme";
import { webCodecsVideoExporter } from "../../app/adapters/webCodecsVideo";
import { webSampleSource } from "../../app/adapters/webSampleSource";
import { playFromSamples } from "../../app/adapters/webAudioEngine";
import { sampleLookup } from "../../app/lib/sampleVoices";
import { takeHighwayPainter } from "../../app/lib/videoPainter";
import { readScoreMarks, tempoAt } from "../../core/musicxmlMarks";
import { NOMINAL_BPM } from "../../core/elapsed";
import { collectListenSteps } from "../../app/lib/listenSteps";
import { readStartTempo } from "../../app/lib/scoreExpression";

export type PromoRequest = {
    // The .mxl path under public/, e.g. "/songs/cc0-1.0/TOBNVaraGATl.mxl".
    scoreUrl: string;
    title: string;
    // The provenance line, drawn on every frame — the catalogue is credit-required.
    credit: string;
    // Square for the feed; the painter keeps the waterfall over the keyboard at any
    // aspect it is not taller than it is wide.
    width: number;
    height: number;
    fps: number;
    // How much of the piece to play, in milliseconds of music.
    clipMs: number;
    speed?: number;
    // Named looks from core/videoLook, the same set the export panel offers.
    noteColor?: string;
    keyboardDepth?: string;
    // Where the recorded piano is published. Absent means the synthesised voice, which is
    // what a player without the recordings hears.
    samplesBase?: string;
};

// Fetches the recordings this clip will play and hands them to the engine, so the export
// carries the recorded piano rather than the synth.
//
// A clip is posted once and watched by people deciding whether to open the app at all, so
// unlike a player's own export it waits: nothing here is racing a pair of hands, and a
// promo that falls back mid-phrase would advertise the wrong instrument. It still falls
// back per note rather than failing — a recording that will not come is one the synth
// covers, and no clip is worth losing to it.
// One sample source for the whole batch, rather than one per clip.
//
// The recordings' BYTES are already shared: webSampleSource keeps them in Cache Storage,
// keyed by URL, and every clip runs in the same page. What was not shared is the decoded
// audio — `buffers` is a Map inside each instance, so a fresh source per clip re-decoded
// every region it needed, however many earlier clips had already decoded the same notes.
// Sixty-four pieces over one keyboard overlap almost completely, and the decoding was
// costing minutes a clip against eighteen seconds of encoding.
//
// Keyed by base URL because that is the only thing that would make an existing source the
// wrong one to reuse.
let shared: { base: string; samples: ReturnType<typeof webSampleSource> } | null = null;

async function loadSamples(base: string, notes: { pitch: number; velocity: number }[]) {
    if (shared?.base !== base) {
        const samples = webSampleSource({
            baseUrl: base,
            enabled: true,
            remember: () => {},
            // Decoded straight into the rate the export renders at, so nothing is resampled
            // between the fetch and the file.
            context: async () => new OfflineAudioContext(2, 1, 48_000),
        });
        playFromSamples(() => ({ source: sampleLookup(samples) }));
        shared = { base, samples };
    }
    // Only the regions this piece needs that are not already decoded; prepare skips what
    // the map already holds.
    await shared.samples.prepare(notes);
    return shared.samples.state();
}

// Reads a catalogue piece into the performance a clip is cut from.
//
// Split out from the render so the cut can be reported without encoding anything: an
// hour of video is a poor way to find out where the clips end, and a report that
// re-implemented the reading would answer for a different performance than the one that
// ships.
export async function readPerformance(request: PromoRequest): Promise<RecordedNote[]> {
    const response = await fetch(request.scoreUrl);
    if (!response.ok) {
        throw new Error(`${request.scoreUrl}: ${response.status}`);
    }
    const xml = decompressMxl(new Uint8Array(await response.arrayBuffer()));
    if (!xml) {
        throw new Error(`${request.scoreUrl}: not a readable .mxl`);
    }

    // The engraving is what the step model is read from, so the performance carries the
    // repeats, tempo marks and fermatas the score writes.
    const { OpenSheetMusicDisplay } = await import("opensheetmusicdisplay");
    const host = document.createElement("div");
    host.style.width = "1200px";
    document.body.appendChild(host);
    const osmd = new OpenSheetMusicDisplay(host, { drawingParameters: "compact" });
    await osmd.load(xml);
    osmd.render();
    // The marks come from the file, not the engraving: without them every note is struck
    // at the same even touch, which is the one thing that makes a rendered piece sound
    // like a machine playing it.
    const marks = readScoreMarks(new DOMParser().parseFromString(xml, "application/xml"));
    // Read the way LISTEN reads, not the way a run is graded. The graded reading asks for
    // the written note where the page prints an ornament, a tremolo or a glissando —
    // deliberately, because nobody can be graded on a trill note by note — and plays every
    // rolled chord as a block. A clip is the shop window: it should sound like the app
    // sounds, so it comes off the same model Listen sounds.
    const steps = collectListenSteps(osmd, marks);
    // Every position is counted in the same proportion to the opening tempo that its own
    // mark stands in, which is what the transport does with the dial at the written tempo.
    const startBpm = tempoAt(marks.tempi, 0) ?? readStartTempo(osmd) ?? NOMINAL_BPM;
    host.remove();

    // Read long enough to choose where to stop, then cut at a silence. A short clip asked
    // for a flat twenty seconds and got whatever fell there — mid-phrase, mid-chord, on a
    // note that had only just begun. Read PAST the window's far edge, not to it: a reading
    // that stops at thirty seconds ends at thirty seconds, and a cut that cannot tell that
    // from a piece which genuinely ends there awards it a perfect ending and lands every
    // continuous piece on the same bound.
    const played = listenPerformanceOf(steps, {
        startBpm,
        speed: request.speed,
        // No window means the whole piece, which is what a full-length upload is.
        ...(request.clipMs > 0 ? { withinMs: PROMO_WINDOW.latestMs + LOOKAHEAD_MS } : {}),
    });
    if (played.length === 0) {
        throw new Error(`${request.scoreUrl}: nothing to play`);
    }
    return played;
}

export async function renderPromo(request: PromoRequest): Promise<Uint8Array> {
    if (!(await webCodecsVideoExporter.supported())) {
        throw new Error("this browser cannot encode; nothing to render");
    }
    const played = await readPerformance(request);
    // Which notes to keep and how long to run is the cut, and the cut is pure — it lives in
    // core so it can be reasoned about and tested away from a browser. A full-length upload
    // asks for no window and gets the whole piece.
    const { notes, durationMs } = clipCut(played, request.clipMs > 0 ? PROMO_WINDOW : null);

    // The notes waterfall: takeHighwayPainter is the falling-blocks scene. The other
    // exported painter, takeScenePainter, draws the lit keyboard with an optional notation
    // panel and no blocks at all — the two are separate entry points in the same file, and
    // picking the wrong one silently produces a video of the keyboard alone.
    const paint = takeHighwayPainter({
        title: request.title,
        credit: request.credit,
        notes,
        durationMs,
        width: request.width,
        height: request.height,
        showTitle: true,
        showWordmark: true,
        // The same looks the export panel offers, so a promo clip is a take export with
        // its options set rather than a second renderer with its own palette.
        accent: noteColorHex(request.noteColor ?? DEFAULT_NOTE_COLOR),
        // The performance is fingered by the cost model and knows its hands, so a scheme
        // that reads either paints each note accordingly — the same mapping in every clip.
        scheme: request.noteColor ?? DEFAULT_NOTE_COLOR,
        keyboardDepth: keyboardDepthFraction(request.keyboardDepth ?? DEFAULT_KEYBOARD_DEPTH),
        // The keys a player sees, named rather than left to a default. Omitting this was
        // the one thing that made a promo clip look unlike an export of the same take: the
        // painter fell back to a palette of its own, and the export panel — which passes
        // the player's chosen theme — never went near it.
        keyColors: { white: DEFAULT_THEME.whiteHex, black: DEFAULT_THEME.blackHex },
        // Always glossy, whatever the app's default is. A clip is an advertisement seen by
        // somebody deciding whether to open Plinky at all, and the instrument should look
        // like an instrument there; the app itself opens joyful, because the person in
        // front of it has already arrived and may never have played before.
        finish: GLOSSY,
    });

    if (request.samplesBase) {
        const held = await loadSamples(request.samplesBase, notes);
        if (held.ready === 0) {
            throw new Error(`no recordings loaded from ${request.samplesBase}`);
        }
    }

    const blob = await webCodecsVideoExporter.export({
        width: request.width,
        height: request.height,
        fps: request.fps,
        durationMs,
        paint,
        notes,
    });
    return new Uint8Array(await blob.arrayBuffer());
}

// Where a clip of this piece would end, and what the window had to choose among. The
// report behind `npm run promo:cuts`, which is how a batch's lengths are checked without
// rendering one.
export async function reportCut(request: PromoRequest) {
    const played = await readPerformance(request);
    const cut = clipCut(played, PROMO_WINDOW);
    return {
        endMs: cut.endMs,
        pauseMs: cut.pauseMs,
        durationMs: cut.durationMs,
        gaps: gapsIn(played, PROMO_WINDOW),
        performanceMs: played.reduce((end, n) => Math.max(end, n.startMs + n.durationMs), 0),
        noteCount: played.length,
    };
}
