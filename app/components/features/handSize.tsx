// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useState } from "react";
import { useMidiInput } from "../../contexts/midi";
import { noteName } from "../../../core/midi";
import { spanName } from "../../lib/theoryNames";
import type { HandSpan } from "../../../core/prefs";
import { usePrefs } from "../../hooks/usePrefs";
import { m } from "../../paraglide/messages.js";
import { Button } from "../ui/button";
import { SettingsSection } from "../ui/settingsSection";
import { PianoKeyboard } from "./pianoKeyboard";

type Side = "left" | "right";
const SIDES: Side[] = ["left", "right"];

// Lets a player record each hand's comfortable thumb-to-pinky reach so the
// fingering suggestions fit their hand. Each hand is independent, so someone with
// one hand simply sets the hand they have. Capture works through the same input
// funnel as practice — a tap on the on-screen keys or a real MIDI piano both land
// as note events — so the two furthest keys the player reaches give the span.
export function HandSize() {
    const { prefs, update } = usePrefs();
    const spans = prefs.handSpan;
    const [active, setActive] = useState<Side | null>(null);
    const [captured, setCaptured] = useState<number[]>([]);

    useMidiInput({
        onNoteOn: (event) => {
            if (!active) {
                return;
            }
            // First key is the thumb, second the pinky; a third starts over.
            setCaptured((keys) => (keys.length >= 2 ? [event.note] : [...keys, event.note]));
        },
    });

    const thumb = captured[0];
    const pinky = captured[1];
    const measured = thumb !== undefined && pinky !== undefined ? Math.abs(pinky - thumb) : null;

    const begin = (side: Side) => {
        setActive(side);
        setCaptured([]);
    };
    const cancel = () => {
        setActive(null);
        setCaptured([]);
    };
    const persist = (next: HandSpan) => update({ handSpan: next });
    const save = () => {
        if (active && measured !== null) {
            persist({ ...spans, [active]: measured });
            cancel();
        }
    };

    const sideLabel: Record<Side, string> = { left: m.hand_left(), right: m.hand_right() };

    let readout: string;
    if (thumb === undefined) {
        readout = m.hand_size_tap_thumb();
    } else if (pinky === undefined) {
        readout = `${noteName(thumb)} — ${m.hand_size_tap_pinky()}`;
    } else {
        const span = Math.abs(pinky - thumb);
        // The semitone count always shows; the interval name is an extra gloss that a
        // very wide reach (a stray MIDI value) drops, so the count stands alone.
        const name = spanName(span);
        const glossed = `${noteName(thumb)} → ${noteName(pinky)} · ${m.hand_size_semitones({ count: span })}`;
        readout = name ? `${glossed} · ${name}` : glossed;
    }

    return (
        <SettingsSection
            title={m.settings_hand_size()}
            hint={m.settings_hand_size_hint()}
            level={3}
        >
            <div className="space-y-2">
                {SIDES.map((side) => {
                    const span = spans[side];
                    return (
                        <div
                            key={side}
                            className="flex items-center justify-between gap-3 rounded-md border border-gray-200 px-3 py-2 dark:border-gray-800"
                        >
                            <span className="text-sm">
                                <span className="font-medium">{sideLabel[side]}</span>{" "}
                                {span !== null ? (
                                    <span className="text-gray-500 dark:text-gray-400">
                                        {m.hand_size_semitones({ count: span })}
                                        {spanName(span) ? ` · ${spanName(span)}` : ""}
                                    </span>
                                ) : (
                                    <span className="text-gray-500 dark:text-gray-400">
                                        {m.hand_size_not_set()}
                                    </span>
                                )}
                            </span>
                            <span className="flex shrink-0 gap-2">
                                <Button variant="secondary" onClick={() => begin(side)}>
                                    {span !== null ? m.hand_size_edit() : m.hand_size_set()}
                                </Button>
                                {span !== null && (
                                    <Button
                                        variant="secondary"
                                        onClick={() => persist({ ...spans, [side]: null })}
                                    >
                                        {m.action_remove()}
                                    </Button>
                                )}
                            </span>
                        </div>
                    );
                })}
            </div>

            {active && (
                <div className="space-y-2 rounded-md border border-indigo-200 bg-indigo-50 p-3 dark:border-indigo-900 dark:bg-indigo-950">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                        {sideLabel[active]} — {m.hand_size_instruction()}
                    </p>
                    <p className="font-mono text-sm text-gray-800 dark:text-gray-200">{readout}</p>
                    <PianoKeyboard expected={captured} from={48} to={72} />
                    <div className="flex gap-2">
                        <Button variant="primary" onClick={save} disabled={measured === null}>
                            {m.action_save()}
                        </Button>
                        <Button variant="secondary" onClick={cancel}>
                            {m.import_cancel()}
                        </Button>
                    </div>
                </div>
            )}
        </SettingsSection>
    );
}
