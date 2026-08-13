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
import { performanceLengthMs, performanceOf } from "../../core/scorePerformance";
import {
    DEFAULT_KEYBOARD_DEPTH,
    DEFAULT_NOTE_COLOR,
    keyboardDepthFraction,
    noteColorHex,
} from "../../core/videoLook";
import { webCodecsVideoExporter } from "../../app/adapters/webCodecsVideo";
import { takeHighwayPainter } from "../../app/lib/videoPainter";
import { collectMatchSteps } from "../../app/hooks/useScoreMatcher";

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
};

export async function renderPromo(request: PromoRequest): Promise<Uint8Array> {
    if (!(await webCodecsVideoExporter.supported())) {
        throw new Error("this browser cannot encode; nothing to render");
    }
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
    const steps = collectMatchSteps(osmd, "both");
    host.remove();

    const notes = performanceOf(steps, { speed: request.speed, withinMs: request.clipMs });
    if (notes.length === 0) {
        throw new Error(`${request.scoreUrl}: nothing to play`);
    }
    // To the end of the last note still sounding, so the clip does not cut the final
    // chord — plus a breath of silence to let it ring.
    const durationMs = Math.round(performanceLengthMs(notes) + 700);

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
        keyboardDepth: keyboardDepthFraction(request.keyboardDepth ?? DEFAULT_KEYBOARD_DEPTH),
    });

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
