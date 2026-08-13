// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { CIRCLE, type CircleKey, signatureNotes } from "../../core/circleOfFifths";
import { routeMeta, webPageData } from "../../core/site";
import { bpmOf, NO_TAPS, type TapState, tap, tapCount } from "../../core/tapTempo";
import { NOTE_LABELS } from "../../core/keyMap";
import {
    CHORD_QUALITIES,
    type ChordQuality,
    chordPitches,
    NOTE_TEXT,
    noteNameOf,
    SCALE_IDS,
    type ScaleId,
    scalePitches,
} from "../../core/theory";
import { DEMO_FROM, SoundingKeyboard } from "../components/features/soundingKeyboard";
import { Button } from "../components/ui/button";
import { SegmentedControl } from "../components/ui/segmentedControl";
import { useSynth } from "../hooks/useSynth";
import { chordName, scaleName } from "../lib/theoryNames";
import { m } from "../paraglide/messages.js";
import { getLocale } from "../paraglide/runtime.js";
import type { Route } from "./+types/tools";

export function meta(_args: Route.MetaArgs) {
    return [
        ...routeMeta(m.tools_title(), m.meta_tools_description()),
        {
            "script:ld+json": webPageData(
                m.tools_title(),
                m.meta_tools_description(),
                getLocale(),
                "/tools/",
                "CollectionPage",
            ),
        },
    ];
}

// Middle C's octave, so every tool sounds and draws in the same register a beginner
// sits in front of.
const ROOT = DEMO_FROM;

const NOTE_SECONDS = 0.45;

function Panel({
    title,
    hint,
    children,
}: {
    title: string;
    hint: string;
    children: React.ReactNode;
}) {
    return (
        <section className="space-y-3 rounded-lg border border-line bg-surface p-4">
            <div className="space-y-1">
                <h2 className="font-medium text-body">{title}</h2>
                <p className="text-xs text-muted">{hint}</p>
            </div>
            {children}
        </section>
    );
}

// A ring of the twelve major keys with their signatures and relative minors. Clicking
// one sounds its tonic triad, so the diagram is something you can hear rather than
// only read.
// A key spells its own notes: the key of D flat contains no C sharp, so the diagram
// must say D flat. The explorers below stay on the sharp-only keyboard table, because
// there a root is a key on the instrument rather than a key signature.
function spell(pitch: number, key: CircleKey): string {
    return NOTE_TEXT[noteNameOf(pitch, key.spelling)];
}

function CircleOfFifths() {
    const [selected, setSelected] = useState<CircleKey>(CIRCLE[0] as CircleKey);
    const synth = useSynth();
    const notes = signatureNotes(selected);
    const pick = (key: CircleKey) => {
        setSelected(key);
        for (const pitch of chordPitches(ROOT + key.tonic, "major")) {
            synth.playNote(pitch, { duration: NOTE_SECONDS });
        }
    };
    return (
        <Panel title={m.tools_circle_title()} hint={m.tools_circle_hint()}>
            <ul className="flex flex-wrap gap-2">
                {CIRCLE.map((key) => (
                    <li key={key.tonic}>
                        <Button
                            variant={key.tonic === selected.tonic ? "primary" : "secondary"}
                            onClick={() => pick(key)}
                        >
                            {spell(key.tonic, key)}
                        </Button>
                    </li>
                ))}
            </ul>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                <dt className="text-muted">{m.tools_circle_signature()}</dt>
                <dd>
                    {notes.length === 0
                        ? m.tools_circle_none()
                        : notes.map((name) => NOTE_TEXT[name]).join(" · ")}
                </dd>
                <dt className="text-muted">{m.tools_circle_relative()}</dt>
                <dd>{m.tools_circle_minor({ note: spell(selected.relativeMinor, selected) })}</dd>
            </dl>
        </Panel>
    );
}

// Plays a sequence one note at a time through the injected scheduler, so a scale
// unfolds rather than sounding as a cluster. Timers are the scheduler's, never the
// browser's — the architecture confines them and a test needs to advance them.
// The twelve roots, labelled the way the keyboard is: a root here is a key under the
// hand rather than a key signature.
function tonicOptions(): { id: string; label: string }[] {
    return Array.from({ length: 12 }, (_, pitch) => ({
        id: String(pitch),
        label: NOTE_LABELS[pitch] ?? "",
    }));
}

function ScaleExplorer() {
    const [tonic, setTonic] = useState("0");
    const [scale, setScale] = useState<ScaleId>("major");
    const pitches = scalePitches(ROOT + Number(tonic), scale);
    return (
        <Panel title={m.tools_scales_title()} hint={m.tools_scales_hint()}>
            <SegmentedControl
                label={m.tools_root()}
                value={tonic}
                onChange={setTonic}
                options={tonicOptions()}
            />
            <SegmentedControl
                label={m.tools_scale()}
                value={scale}
                onChange={setScale}
                options={SCALE_IDS.map((id) => ({ id, label: scaleName(id) }))}
            />
            <SoundingKeyboard
                lit={pitches}
                phrases={[{ notes: pitches, spread: true }]}
                label={m.tools_hear_it()}
            />
        </Panel>
    );
}

function ChordExplorer() {
    const [root, setRoot] = useState("0");
    const [quality, setQuality] = useState<ChordQuality>("major");
    const pitches = chordPitches(ROOT + Number(root), quality);
    return (
        <Panel title={m.tools_chords_title()} hint={m.tools_chords_hint()}>
            <SegmentedControl
                label={m.tools_root()}
                value={root}
                onChange={setRoot}
                options={tonicOptions()}
            />
            <SegmentedControl
                label={m.tools_chord()}
                value={quality}
                onChange={setQuality}
                options={CHORD_QUALITIES.map((id) => ({ id, label: chordName(id) }))}
            />
            <SoundingKeyboard
                lit={pitches}
                phrases={[{ notes: pitches }]}
                label={m.tools_hear_it()}
            />
        </Panel>
    );
}

// Tap along and read the tempo back. Wall-clock rather than the monotonic scheduler
// clock: a tap is an event in the player's own time, and the reading is handed to a
// metronome that speaks in beats a minute.
function TapTempo() {
    const [state, setState] = useState<TapState>(NO_TAPS);
    const bpm = bpmOf(state);
    return (
        <Panel title={m.tools_tap_title()} hint={m.tools_tap_hint()}>
            <div className="flex flex-wrap items-center gap-3">
                <Button
                    variant="primary"
                    onClick={() => setState((current) => tap(current, Date.now()))}
                >
                    {m.tools_tap_action()}
                </Button>
                <span className="font-mono text-2xl tabular-nums text-body">
                    {bpm === null ? "—" : m.tools_tap_bpm({ bpm })}
                </span>
                {tapCount(state) > 0 && (
                    <Button variant="ghost" onClick={() => setState(NO_TAPS)}>
                        {m.tools_tap_reset()}
                    </Button>
                )}
            </div>
        </Panel>
    );
}

// Small tools that need no account, no instrument and no lesson: a circle of fifths
// you can hear, a scale and a chord shown on the keys, and a tempo read off your own
// tapping. Each one is a thing a player looks up mid-practice, and each is built from
// the same engines the rest of Plinky runs on.
export default function ToolsRoute() {
    return (
        <main className="mx-auto max-w-3xl space-y-5 p-6 font-sans">
            <header className="space-y-1">
                <h1 className="font-display text-3xl font-semibold tracking-tight">
                    {m.tools_title()}
                </h1>
                <p className="text-sm text-muted">{m.tools_intro()}</p>
            </header>
            <CircleOfFifths />
            <ScaleExplorer />
            <ChordExplorer />
            <TapTempo />
        </main>
    );
}
