// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useState } from "react";
import { useMidiInput } from "../../contexts/midi";
import { intervalName } from "../../../core/intervals";
import { noteName } from "../../../core/midi";
import type { HandSpan } from "../../../core/prefs";
import { usePrefsStore } from "../../contexts/services";
import { m } from "../../paraglide/messages.js";
import { Button } from "../ui/button";
import { PianoKeyboard } from "./pianoKeyboard";

type Side = "left" | "right";
const SIDES: Side[] = ["left", "right"];

// Lets a player record each hand's comfortable thumb-to-pinky reach so the
// fingering suggestions fit their hand. Each hand is independent, so someone with
// one hand simply sets the hand they have. Capture works through the same input
// funnel as practice — a tap on the on-screen keys or a real MIDI piano both land
// as note events — so the two furthest keys the player reaches give the span.
export function HandSize() {
    const prefsStore = usePrefsStore();
    const [spans, setSpans] = useState<HandSpan>({ left: null, right: null });
    const [active, setActive] = useState<Side | null>(null);
    const [captured, setCaptured] = useState<number[]>([]);

    useEffect(() => {
        setSpans(prefsStore.load().handSpan);
    }, [prefsStore.load]);

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
    const persist = (next: HandSpan) => {
        prefsStore.save({ ...prefsStore.load(), handSpan: next });
        setSpans(next);
    };
    const save = () => {
        if (active && measured !== null) {
            persist({ ...prefsStore.load().handSpan, [active]: measured });
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
        readout = `${noteName(thumb)} → ${noteName(pinky)} · ${m.hand_size_semitones({ count: span })} · ${intervalName(span)}`;
    }

    return (
        <section className="space-y-3">
            <div>
                <h3 className="text-sm font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {m.settings_hand_size()}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    {m.settings_hand_size_hint()}
                </p>
            </div>

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
                                        {m.hand_size_semitones({ count: span })} ·{" "}
                                        {intervalName(span)}
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
        </section>
    );
}
