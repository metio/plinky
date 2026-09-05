// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { CIRCLE, type CircleKey, signatureNotes } from "../../core/circleOfFifths";
import { routeMeta, webPageData } from "../../core/site";
import {
    bpmOf,
    MAX_BPM,
    MIN_BPM,
    NO_TAPS,
    type TapState,
    tap,
    tapCount,
} from "../../core/tapTempo";
import { NOTE_LABELS } from "../../core/keyMap";
import {
    CHORD_QUALITIES,
    type ChordQuality,
    chordPitches,
    INTERVAL_IDS,
    type IntervalId,
    NOTE_TEXT,
    noteNameOf,
    SCALE_IDS,
    type ScaleId,
    scalePitches,
    semitonesOf,
    pitchClassOf,
} from "../../core/theory";
import { ChordChanges } from "../components/features/chordChanges";
import { FeatureBoundary } from "../components/features/featureBoundary";
import { SaveDiagram, SavePictureButton } from "../components/features/savePictureButton";
import { DEMO_FROM, SoundingKeyboard } from "../components/features/soundingKeyboard";
import { scoreOf } from "../../core/theoryDemo";
import { Button } from "../components/ui/button";
import { SegmentedControl } from "../components/ui/segmentedControl";
import { useMetronome } from "../hooks/useMetronome";
import { useSynth } from "../hooks/useSynth";
import { chordName, intervalName, scaleName } from "../lib/theoryNames";
import { diatonicSheetDiagrams } from "../../core/chordSheet";
import { svgDiagramSheet } from "../../core/keyboardDiagram";
import { m } from "../paraglide/messages.js";
import { getLocale } from "../paraglide/runtime.js";
import type { Route } from "./+types/tools";
import { PageHeader } from "../components/ui/pageHeader";
import { Card } from "../components/ui/card";

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
        <Card className="space-y-3">
            <div className="space-y-1">
                <h2 className="text-base font-semibold text-ink">{title}</h2>
                <p className="text-sm text-muted">{hint}</p>
            </div>
            {children}
        </Card>
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
            {/* Picking one of twelve is the same gesture as picking one of thirteen
                scales two panels down, so it is the same control — a filled primary
                Button meant "the thing to press", which a key you have not chosen is
                not. */}
            <SegmentedControl
                options={CIRCLE.map((key) => ({
                    id: String(key.tonic),
                    label: spell(key.tonic, key),
                }))}
                value={String(selected.tonic)}
                onChange={(tonic) => {
                    const key = CIRCLE.find((one) => String(one.tonic) === tonic);
                    if (key) {
                        pick(key);
                    }
                }}
                label={m.tools_circle_title()}
            />
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
            {/* The seven chords leave together or not at all. Saved one at a time they
                arrive as seven files with no order and no title, and what they were
                teaching — that they belong to this key, in this sequence — is the part
                that goes missing. */}
            <SaveDiagram
                svg={() =>
                    svgDiagramSheet({
                        title: m.tools_circle_sheet_title({
                            key: spell(selected.tonic, selected),
                        }),
                        diagrams: diatonicSheetDiagrams(ROOT + selected.tonic, selected.spelling),
                    })
                }
                filename={`plinky-chords-${spell(selected.tonic, selected)}`}
                pictureLabel={m.tools_circle_save_chords()}
            />
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
                score={scoreOf([pitches], { spread: true })}
                label={m.tools_hear_it()}
            />
            {/* A scale is as worth taking away as a chord, and the README and the
                changelog both said so before this existed. The span holds it: a scale
                from the twelfth semitone reaches an octave above, which is inside the two
                the picture draws. */}
            <SavePictureButton
                from={ROOT}
                to={ROOT + 24}
                keys={pitches.map((note) => ({ note }))}
                caption={`${NOTE_TEXT[noteNameOf(pitchClassOf(ROOT + Number(tonic)))]} ${scaleName(scale)}`}
                filename="plinky-scale"
            />
        </Panel>
    );
}

function ChordExplorer() {
    const [root, setRoot] = useState("0");
    const [quality, setQuality] = useState<ChordQuality>("major");
    const pitches = chordPitches(ROOT + Number(root), quality);
    // Two octaves from the root, or as far as the chord reaches: a ninth on B climbs past
    // the top of two octaves and would lose its top note off the keyboard and the picture.
    const top = Math.max(ROOT + 24, ...pitches);
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
            <SoundingKeyboard score={scoreOf([pitches])} label={m.tools_hear_it()} to={top} />
            <SavePictureButton
                from={ROOT}
                to={top}
                keys={pitches.map((note) => ({ note }))}
                caption={`${NOTE_TEXT[noteNameOf(pitchClassOf(ROOT + Number(root)))]} ${chordName(quality)}`}
                filename="plinky-chord"
            />
        </Panel>
    );
}

// Two notes and the distance between them. The scale and chord panels answer "what is
// in this?"; this one answers "how far is that?", which is the question a reader asks
// with a finger on the page rather than on the keys.
function IntervalFinder() {
    const [root, setRoot] = useState("0");
    const [interval, pickInterval] = useState<IntervalId>("perfect-fifth");
    const from = ROOT + Number(root);
    const to = from + semitonesOf(interval);
    return (
        <Panel title={m.tools_interval_title()} hint={m.tools_interval_hint()}>
            <SegmentedControl
                label={m.tools_root()}
                value={root}
                onChange={setRoot}
                options={tonicOptions()}
            />
            <SegmentedControl
                label={m.tools_interval_label()}
                value={interval}
                onChange={pickInterval}
                options={INTERVAL_IDS.map((id) => ({ id, label: intervalName(id) }))}
            />
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm text-body">
                <dt className="text-muted">{m.tools_interval_lands()}</dt>
                <dd>{NOTE_LABELS[to % 12] ?? ""}</dd>
            </dl>
            {/* Sounded together and then apart: an interval is a distance you can hear
                either way round, and hearing both is how the name sticks. */}
            <SoundingKeyboard
                score={{
                    clef: "treble",
                    fifths: 0,
                    steps: [
                        { notes: [from, to], value: "half" },
                        { notes: [from], value: "half" },
                        { notes: [to], value: "half" },
                    ],
                }}
                label={m.tools_hear_it()}
            />
        </Panel>
    );
}

// The click on its own, away from a piece. The tempo it keeps is the one the tap tool
// found, because tapping along to something and then playing at that speed is one
// errand rather than two.
const BEATS_IN_A_BAR = ["2", "3", "4", "6"];

// A walking pace: fast enough to be a pulse, slow enough to play something over.
const DEFAULT_BPM = 90;

function Metronome({ bpm, onBpm }: { bpm: number; onBpm: (bpm: number) => void }) {
    const [on, setOn] = useState(false);
    const [beats, setBeats] = useState("4");
    useMetronome(on, bpm, Number(beats));
    return (
        <Panel title={m.tools_metro_title()} hint={m.tools_metro_hint()}>
            <div className="flex flex-wrap items-center gap-3 text-sm text-body">
                <label className="flex flex-1 items-center gap-3">
                    <span className="text-muted">{m.tools_metro_tempo()}</span>
                    <input
                        type="range"
                        min={MIN_BPM}
                        max={MAX_BPM}
                        value={bpm}
                        onChange={(event) => onBpm(Number(event.target.value))}
                        className="h-11 min-w-48 flex-1 accent-accent-solid"
                    />
                </label>
                <span className="font-mono text-2xl tabular-nums text-body">
                    {m.tools_tap_bpm({ bpm })}
                </span>
            </div>
            <SegmentedControl
                label={m.tools_metro_beats()}
                value={beats}
                onChange={setBeats}
                options={BEATS_IN_A_BAR.map((id) => ({ id, label: id }))}
            />
            <Button variant={on ? "secondary" : "primary"} onClick={() => setOn((was) => !was)}>
                {on ? m.tools_metro_stop() : m.tools_metro_start()}
            </Button>
        </Panel>
    );
}

// Tap along and read the tempo back. Wall-clock rather than the monotonic scheduler
// clock: a tap is an event in the player's own time, and the reading is handed to a
// metronome that speaks in beats a minute.
function TapTempo({ onFound }: { onFound: (bpm: number) => void }) {
    const [state, setState] = useState<TapState>(NO_TAPS);
    const bpm = bpmOf(state);
    return (
        <Panel title={m.tools_tap_title()} hint={m.tools_tap_hint()}>
            <div className="flex flex-wrap items-center gap-3">
                <Button
                    variant="primary"
                    onClick={() => {
                        const next = tap(state, Date.now());
                        setState(next);
                        const found = bpmOf(next);
                        if (found !== null) {
                            onFound(found);
                        }
                    }}
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
    // The tempo the tap tool finds is the tempo the metronome should keep, so the number
    // lives in the one place both panels can see rather than being typed in twice.
    const [bpm, setBpm] = useState(DEFAULT_BPM);
    return (
        <main className="mx-auto max-w-3xl space-y-8 p-6 font-sans">
            <PageHeader title={m.tools_title()} hint={m.tools_intro()} />
            {/* A boundary per tool. Each one is a self-contained thing a player looks up
                mid-practice, reading nothing the others read — so a stumble in the chord
                arithmetic has no business taking the metronome away from somebody who
                came for the metronome. The tap tempo and the metronome share a number and
                so share a boundary: split, a crash in one would leave the other holding a
                tempo whose source had vanished. */}
            <FeatureBoundary feature="CircleOfFifths">
                <CircleOfFifths />
            </FeatureBoundary>
            <FeatureBoundary feature="ScaleExplorer">
                <ScaleExplorer />
            </FeatureBoundary>
            <FeatureBoundary feature="ChordExplorer">
                <ChordExplorer />
            </FeatureBoundary>
            <FeatureBoundary feature="ChordChanges">
                <Panel title={m.tools_changes_title()} hint={m.tools_changes_hint()}>
                    <ChordChanges root={ROOT} />
                </Panel>
            </FeatureBoundary>
            <FeatureBoundary feature="IntervalFinder">
                <IntervalFinder />
            </FeatureBoundary>
            <FeatureBoundary feature="TapTempoAndMetronome">
                <TapTempo onFound={setBpm} />
                <Metronome bpm={bpm} onBpm={setBpm} />
            </FeatureBoundary>
        </main>
    );
}
