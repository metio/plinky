// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { smoothestMotion } from "../../../core/chordMotion";
import {
    type ChordQuality,
    CHORD_QUALITIES,
    chordPitches,
    NOTE_TEXT,
    noteNameOf,
    type PitchClass,
} from "../../../core/theory";
import { chordName } from "../../lib/theoryNames";
import { m } from "../../paraglide/messages.js";
import { SegmentedControl } from "../ui/segmentedControl";
import { SavePictureButton } from "./savePictureButton";
import { SoundingKeyboard } from "./soundingKeyboard";

// Why one change falls under the hand and another fights it.
//
// The other panels answer "what is in this chord?". A player who knows C and knows F
// still cannot say why moving between them is easy — that is a fact about the PAIR, and
// no chart of shapes can hold it. What answers it is the notes both chords keep and how
// far the rest have to travel, which is arithmetic nobody shows you.
export function ChordChanges({ root: rootNote }: { root: number }) {
    const [fromRoot, setFromRoot] = useState("0");
    const [fromQuality, setFromQuality] = useState<ChordQuality>("major");
    const [toRoot, setToRoot] = useState("5");
    const [toQuality, setToQuality] = useState<ChordQuality>("major");

    const from = chordPitches(rootNote + Number(fromRoot), fromQuality);
    const to = chordPitches(rootNote + Number(toRoot), toQuality);
    const motion = smoothestMotion(from, to);

    const noteText = (pitchClass: PitchClass) => NOTE_TEXT[noteNameOf(pitchClass)];
    const label = (root: string, quality: ChordQuality) =>
        `${noteText(((rootNote + Number(root)) % 12) as PitchClass)} ${chordName(quality)}`;

    // Each pair of pickers is headed by the chord it currently names. Four controls
    // labelled Root, Chord, Root, Chord tell a reader nothing about which half they are
    // touching — and the name is the thing they came to see anyway, so it earns the line
    // twice over. Notation plus a quality word, so nothing new needs translating.
    const pair = (
        name: string,
        root: string,
        onRoot: (value: string) => void,
        quality: ChordQuality,
        onQuality: (value: ChordQuality) => void,
    ) => (
        <div className="space-y-2">
            <p className="text-sm font-semibold text-ink">{name}</p>
            {/* The chord's own name goes into each control's accessible name. There are
                two of every control here and a third on the panel above; "Chord" three
                times over tells somebody listening which question they are answering but
                not which chord they are answering it about. */}
            <SegmentedControl
                label={`${m.tools_root()} · ${name}`}
                value={root}
                onChange={onRoot}
                options={tonics(rootNote)}
            />
            <SegmentedControl
                label={`${m.tools_chord()} · ${name}`}
                value={quality}
                onChange={onQuality}
                options={CHORD_QUALITIES.map((id) => ({ id, label: chordName(id) }))}
            />
        </div>
    );

    return (
        <>
            {pair(label(fromRoot, fromQuality), fromRoot, setFromRoot, fromQuality, setFromQuality)}
            {pair(label(toRoot, toQuality), toRoot, setToRoot, toQuality, setToQuality)}

            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <dt className="text-muted">{m.tools_changes_shared()}</dt>
                {/* Notation, so it reads the same in every language — and an em dash
                    rather than a sentence where a change shares nothing, because "none"
                    is the answer least worth a word. */}
                <dd className="tabular-nums">
                    {motion.common.length === 0 ? "—" : motion.common.map(noteText).join(" · ")}
                </dd>
                <dt className="text-muted">{m.tools_changes_travel()}</dt>
                <dd className="tabular-nums">{motion.distance}</dd>
            </dl>

            {/* Both chords in turn, so the ear gets the change the numbers describe. */}
            <SoundingKeyboard
                lit={from}
                phrases={[{ notes: from }, { notes: to }]}
                label={m.tools_hear_it()}
            />
            <SavePictureButton
                from={rootNote}
                to={rootNote + 24}
                keys={to.map((note) => ({ note }))}
                caption={`${label(fromRoot, fromQuality)} → ${label(toRoot, toQuality)}`}
                filename="plinky-chord-change.png"
            />
        </>
    );
}

function tonics(root: number): { id: string; label: string }[] {
    return Array.from({ length: 12 }, (_, step) => ({
        id: String(step),
        label: NOTE_TEXT[noteNameOf(((root + step) % 12) as PitchClass)],
    }));
}
