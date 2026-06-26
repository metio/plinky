// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useState } from "react";
import { useMidiInput } from "../contexts/midi";
import { intervalName } from "../lib/intervals";
import { noteName } from "../lib/midi";
import { type HandSpan, loadPrefs, savePrefs } from "../lib/prefs";
import { m } from "../paraglide/messages.js";
import { PianoKeyboard } from "./pianoKeyboard";

type Side = "left" | "right";
const SIDES: Side[] = ["left", "right"];

const PILL =
    "rounded-md border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300";

// Lets a player record each hand's comfortable thumb-to-pinky reach so the
// fingering suggestions fit their hand. Each hand is independent, so someone with
// one hand simply sets the hand they have. Capture works through the same input
// funnel as practice — a tap on the on-screen keys or a real MIDI piano both land
// as note events — so the two furthest keys the player reaches give the span.
export function HandSize() {
    const [spans, setSpans] = useState<HandSpan>({ left: null, right: null });
    const [active, setActive] = useState<Side | null>(null);
    const [captured, setCaptured] = useState<number[]>([]);

    useEffect(() => {
        setSpans(loadPrefs().handSpan);
    }, []);

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
        savePrefs({ ...loadPrefs(), handSpan: next });
        setSpans(next);
    };
    const save = () => {
        if (active && measured !== null) {
            persist({ ...loadPrefs().handSpan, [active]: measured });
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
                                <button type="button" onClick={() => begin(side)} className={PILL}>
                                    {span !== null ? m.hand_size_edit() : m.hand_size_set()}
                                </button>
                                {span !== null && (
                                    <button
                                        type="button"
                                        onClick={() => persist({ ...spans, [side]: null })}
                                        className={PILL}
                                    >
                                        {m.action_remove()}
                                    </button>
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
                        <button
                            type="button"
                            onClick={save}
                            disabled={measured === null}
                            className="rounded-md bg-indigo-600 px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
                        >
                            {m.action_save()}
                        </button>
                        <button type="button" onClick={cancel} className={PILL}>
                            {m.import_cancel()}
                        </button>
                    </div>
                </div>
            )}
        </section>
    );
}
