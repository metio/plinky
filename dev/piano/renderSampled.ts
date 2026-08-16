// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Plays a catalogue piece through the Salamander Grand Piano and writes the result as a
// WAV, beside the same piece played by the synth the app ships. It answers one question
// before anything is built: how much better does a real sampled piano sound here, and what
// does it cost to fetch.
//
// It runs in a browser because that is where an OfflineAudioContext is, and it reads the
// piece exactly the way the promo renderer does — engraved by the same engine, performed
// by the same cost model — so the two recordings differ in nothing but the voice.
//
// Nothing here is shipped. It is dev tooling that happens to run in a browser.

import { decompressMxl } from "../../core/musicxmlFile";
import { performanceLengthMs, performanceOf } from "../../core/scorePerformance";
import { collectMatchSteps } from "../../app/hooks/useScoreMatcher";
import { renderTakeAudio } from "../../app/adapters/offlineAudio";
import { LEAD_IN_MS } from "../../core/videoFrames";
// @ts-expect-error — dev tooling, shared with the Node side as plain JavaScript.
import { regionFor } from "./voicing.mjs";

export type SampledRequest = {
    scoreUrl: string;
    // Where the sample server is listening. The library is 1.2 GB on disk and lives
    // outside the repository, so it is served from its own origin with CORS open.
    samplesBase: string;
    clipMs: number;
    speed?: number;
    // The library's own SFZ, parsed on the Node side and handed over whole. The lookup
    // runs here, where the notes are, and is the same function both sides call.
    regions: Region[];
};

type Region = {
    file: string;
    keyCentre: number;
    lowKey: number;
    highKey: number;
    lowVelocity: number;
    highVelocity: number;
};

// What the SFZ's group header asks for: the note rings on for a second after the key is
// released rather than stopping dead.
const RELEASE_S = 1;

// A sampled note is already at the loudness its layer was played at, so velocity is not
// applied again — the layer IS the dynamic. This is only the master trim that keeps a
// chord off the ceiling.
const SAMPLE_GAIN = 0.5;

export type SampledResult = {
    sampled: Uint8Array;
    synth: Uint8Array;
    noteCount: number;
    // What the piece actually needed: distinct recordings, and their total bytes over the
    // wire. The number that decides whether this ships as a download.
    sampleCount: number;
    sampleBytes: number;
    durationMs: number;
};

async function notesOf(request: SampledRequest) {
    const response = await fetch(request.scoreUrl);
    if (!response.ok) {
        throw new Error(`${request.scoreUrl}: ${response.status}`);
    }
    const xml = decompressMxl(new Uint8Array(await response.arrayBuffer()));
    if (!xml) {
        throw new Error(`${request.scoreUrl}: not a readable .mxl`);
    }
    const { OpenSheetMusicDisplay } = await import("opensheetmusicdisplay");
    const host = document.createElement("div");
    host.style.width = "1200px";
    document.body.appendChild(host);
    const osmd = new OpenSheetMusicDisplay(host, { drawingParameters: "compact" });
    await osmd.load(xml);
    osmd.render();
    const steps = collectMatchSteps(osmd, "both");
    host.remove();
    return performanceOf(
        steps,
        // No window means the whole piece, which is what a session plays.
        request.clipMs > 0 ? { speed: request.speed, withinMs: request.clipMs } : {},
    );
}

// The (pitch, velocity) pairs a whole piece plays, for measuring what a session would have
// to fetch. Exported from here because a bare module specifier only resolves inside a
// module the dev server served — an inline evaluate cannot import the engraver.
export async function playedPairs(scoreUrl: string): Promise<[number, number][]> {
    const notes = await notesOf({ scoreUrl, samplesBase: "", clipMs: 0, regions: [] });
    return notes.map((note) => [note.pitch, note.velocity]);
}

export async function renderSampled(request: SampledRequest): Promise<SampledResult> {
    const notes = await notesOf(request);
    if (notes.length === 0) {
        throw new Error(`${request.scoreUrl}: nothing to play`);
    }
    const durationMs = Math.round(performanceLengthMs(notes) + 700 + RELEASE_S * 1000);

    // Only what this piece asks for. The app knows its notes before it plays them — a
    // score is the whole list — so a sampled instrument never has to hold the keyboard it
    // is not using. This is the same reasoning a download would use.
    const voiced = new Map<string, Region>();
    for (const note of notes) {
        const key = `${note.pitch}:${note.velocity}`;
        if (!voiced.has(key)) {
            voiced.set(key, regionFor(request.regions, note.pitch, note.velocity) as Region);
        }
    }
    const wanted = new Map<string, Region>();
    for (const region of voiced.values()) {
        wanted.set(region.file, region);
    }

    const context = new AudioContext();
    let sampleBytes = 0;
    const buffers = new Map<string, AudioBuffer>();
    await Promise.all(
        [...wanted.values()].map(async ({ file }) => {
            // The library names its sharps F#2v11.wav, and a bare # in a URL is the start
            // of a fragment — the request would arrive as a truncated path.
            const path = file.split("/").map(encodeURIComponent).join("/");
            const response = await fetch(`${request.samplesBase}/${path}`);
            const bytes = await response.arrayBuffer();
            sampleBytes += bytes.byteLength;
            buffers.set(file, await context.decodeAudioData(bytes));
        }),
    );
    await context.close();

    const rate = 48_000;
    const offline = new OfflineAudioContext(2, Math.ceil((durationMs / 1000) * rate), rate);
    const master = offline.createGain();
    master.gain.value = SAMPLE_GAIN;
    master.connect(offline.destination);

    for (const note of notes) {
        const voice = voiced.get(`${note.pitch}:${note.velocity}`);
        const buffer = voice ? buffers.get(voice.file) : undefined;
        if (!voice || !buffer) {
            continue;
        }
        const source = offline.createBufferSource();
        source.buffer = buffer;
        // The grid is sampled in minor thirds, so most notes are a shifted neighbour. Two
        // semitones at most, which is where pitch-shifting still sounds like the piano it
        // came from.
        source.playbackRate.value = 2 ** ((note.pitch - voice.keyCentre) / 12);
        const envelope = offline.createGain();
        const at = (LEAD_IN_MS + note.startMs) / 1000;
        const until = at + note.durationMs / 1000;
        envelope.gain.setValueAtTime(1, at);
        // The damper falling, not a gate closing: the string is still ringing when the key
        // comes up, and cutting it there is what makes a sampler sound like a synthesiser.
        envelope.gain.setValueAtTime(1, until);
        envelope.gain.exponentialRampToValueAtTime(0.0001, until + RELEASE_S);
        source.connect(envelope);
        envelope.connect(master);
        source.start(at);
        source.stop(until + RELEASE_S);
    }

    const [sampled, synth] = await Promise.all([
        offline.startRendering(),
        renderTakeAudio(notes, rate),
    ]);
    return {
        sampled: toWav(sampled),
        synth: toWav(synth),
        noteCount: notes.length,
        sampleCount: wanted.size,
        sampleBytes,
        durationMs,
    };
}

// A plain 16-bit WAV, so the file can be listened to and re-encoded without a decoder
// that only exists in a browser.
function toWav(buffer: AudioBuffer): Uint8Array {
    const channels = buffer.numberOfChannels;
    const frames = buffer.length;
    const bytes = new ArrayBuffer(44 + frames * channels * 2);
    const view = new DataView(bytes);
    const text = (offset: string, at: number) => {
        for (let i = 0; i < offset.length; i++) {
            view.setUint8(at + i, offset.charCodeAt(i));
        }
    };
    text("RIFF", 0);
    view.setUint32(4, 36 + frames * channels * 2, true);
    text("WAVE", 8);
    text("fmt ", 12);
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, buffer.sampleRate, true);
    view.setUint32(28, buffer.sampleRate * channels * 2, true);
    view.setUint16(32, channels * 2, true);
    view.setUint16(34, 16, true);
    text("data", 36);
    view.setUint32(40, frames * channels * 2, true);
    const data = Array.from({ length: channels }, (_, channel) => buffer.getChannelData(channel));
    let at = 44;
    for (let frame = 0; frame < frames; frame++) {
        for (let channel = 0; channel < channels; channel++) {
            const value = Math.max(-1, Math.min(1, data[channel]?.[frame] ?? 0));
            view.setInt16(at, value < 0 ? value * 0x8000 : value * 0x7fff, true);
            at += 2;
        }
    }
    return new Uint8Array(bytes);
}
