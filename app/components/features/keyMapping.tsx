// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useCallback, useEffect, useState } from "react";
import {
    DEFAULT_KEY_MAP,
    type Hand,
    HANDS,
    type KeyMap,
    keyForSlot,
    keyPlaysNote,
    NOTE_LABELS,
    rebind,
    rebindPedal,
    SEMITONES,
} from "../../../core/keyMap";
import { type PedalKind, PEDAL_KINDS } from "../../../core/pedals";
import { useOnboardingStore } from "../../contexts/services";
import { usePrefs } from "../../hooks/usePrefs";
import { m } from "../../paraglide/messages.js";
import { Button } from "../ui/button";

const HAND_LABEL: Record<Hand, () => string> = {
    left: m.keyboard_hint_left,
    right: m.keyboard_hint_right,
};

const PEDAL_LABEL: Record<PedalKind, () => string> = {
    sustain: m.pedal_sustain,
    sostenuto: m.pedal_sostenuto,
    soft: m.pedal_soft,
};

// What the editor is currently listening for a key to bind — a hand's note slot, or a
// pedal — or null when idle.
type Arming = { kind: "note"; hand: Hand; semitone: number } | { kind: "pedal"; pedal: PedalKind };

// The label shown on a key cap. The space key prints as a word so it isn't a blank
// cap; everything else shows uppercased, the way it's printed on a real keyboard.
function keyCap(key: string | null): string {
    if (key === null) {
        return "—";
    }
    return key === " " ? "␣" : key.toUpperCase();
}

// Remap which computer key plays each note, per hand. Each note is a cap showing its
// current key; clicking it arms the cap, and the next key pressed becomes its binding.
// Saving notifies the prefs store's subscribers, so the keyboard input layer picks up
// the new layout immediately. Off by default visually — most players use a piano,
// touch, or the stock layout — but one tap away for anyone who wants their own keys.
export function KeyMapping() {
    const { prefs, update } = usePrefs();
    const map = prefs.keyMap;
    const onboarding = useOnboardingStore();
    // The slot or pedal currently listening for a key, or null when idle.
    const [arming, setArming] = useState<Arming | null>(null);
    // Set when a pedal bind is refused because the pressed key already plays a note, so the
    // editor can say why rather than appearing to swallow the keystroke.
    const [pedalClash, setPedalClash] = useState(false);

    // Engaging with the editor — arming a cap to rebind, or resetting to the standard
    // layout — ticks off the "set up your keys" discovery step, so a player content with
    // the defaults completes it too, not only one who lands on a non-default binding.
    const markEngaged = () => onboarding.markDiscovered("keysCustomized");

    const persist = useCallback((next: KeyMap) => update({ keyMap: next }), [update]);

    // While a cap is armed, capture the next keystroke before it reaches the keyboard
    // input layer (capture phase + stopPropagation), so arming a cap can't sound a note.
    // Escape cancels; a printable single key binds; anything else is ignored.
    useEffect(() => {
        if (!arming) {
            return;
        }
        const onKeyDown = (event: KeyboardEvent) => {
            event.preventDefault();
            event.stopPropagation();
            if (event.key === "Escape") {
                setArming(null);
                setPedalClash(false);
                return;
            }
            if (arming.kind === "pedal") {
                // Backspace/Delete clears the pedal; a pedal takes almost any free key, Space
                // included — the natural key for a foot pedal on a computer keyboard.
                if (event.key === "Backspace" || event.key === "Delete") {
                    persist(rebindPedal(map, arming.pedal, null));
                    setArming(null);
                    return;
                }
                if (event.key.length !== 1 || event.metaKey || event.ctrlKey) {
                    return;
                }
                // A pedal may only take a key no note uses — binding a note key would strand
                // that note and be silently discarded on reload. Refuse and say why, keeping
                // the cap armed so the player can try a free key.
                if (keyPlaysNote(map, event.key)) {
                    setPedalClash(true);
                    return;
                }
                setPedalClash(false);
                persist(rebindPedal(map, arming.pedal, event.key));
                setArming(null);
                return;
            }
            if (event.key.length !== 1 || event.key === " " || event.metaKey || event.ctrlKey) {
                return;
            }
            persist(rebind(map, arming.hand, arming.semitone, event.key));
            setArming(null);
        };
        window.addEventListener("keydown", onKeyDown, true);
        return () => window.removeEventListener("keydown", onKeyDown, true);
    }, [arming, map, persist]);

    return (
        <div className="space-y-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">{m.keymap_help()}</p>
            {HANDS.map((hand) => (
                <div key={hand} className="space-y-1">
                    <div className="text-xs font-medium text-gray-600 dark:text-gray-400">
                        {HAND_LABEL[hand]()}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {SEMITONES.map((semitone) => {
                            const armed =
                                arming?.kind === "note" &&
                                arming.hand === hand &&
                                arming.semitone === semitone;
                            return (
                                <button
                                    key={semitone}
                                    type="button"
                                    onClick={() => {
                                        markEngaged();
                                        setPedalClash(false);
                                        setArming(armed ? null : { kind: "note", hand, semitone });
                                    }}
                                    aria-label={m.keymap_rebind({
                                        note: NOTE_LABELS[semitone]!,
                                        hand: HAND_LABEL[hand](),
                                    })}
                                    aria-pressed={armed}
                                    className={`flex w-12 flex-col items-center rounded-md border px-1 py-1 text-center ${
                                        armed
                                            ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950"
                                            : "border-gray-300 hover:border-indigo-400 dark:border-gray-700"
                                    }`}
                                >
                                    <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                        {NOTE_LABELS[semitone]}
                                    </span>
                                    <span className="font-mono text-sm font-semibold">
                                        {armed ? "…" : keyCap(keyForSlot(map, hand, semitone))}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}
            <div className="space-y-1">
                <div className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    {m.keymap_pedals()}
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {PEDAL_KINDS.map((pedal) => {
                        const armed = arming?.kind === "pedal" && arming.pedal === pedal;
                        return (
                            <button
                                key={pedal}
                                type="button"
                                onClick={() => {
                                    markEngaged();
                                    setPedalClash(false);
                                    setArming(armed ? null : { kind: "pedal", pedal });
                                }}
                                aria-label={m.keymap_rebind_pedal({ pedal: PEDAL_LABEL[pedal]() })}
                                aria-pressed={armed}
                                className={`flex w-20 flex-col items-center rounded-md border px-1 py-1 text-center ${
                                    armed
                                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950"
                                        : "border-gray-300 hover:border-indigo-400 dark:border-gray-700"
                                }`}
                            >
                                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                    {PEDAL_LABEL[pedal]()}
                                </span>
                                <span className="font-mono text-sm font-semibold">
                                    {armed ? "…" : keyCap(map.pedals[pedal])}
                                </span>
                            </button>
                        );
                    })}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{m.keymap_pedals_help()}</p>
            </div>
            <div className="flex items-center gap-3">
                {pedalClash ? (
                    <span className="text-xs text-red-600 dark:text-red-400">
                        {m.keymap_pedal_taken()}
                    </span>
                ) : (
                    arming && (
                        <span className="text-xs text-indigo-700 dark:text-indigo-300">
                            {arming.kind === "pedal" ? m.keymap_press_pedal() : m.keymap_press()}
                        </span>
                    )
                )}
                <Button
                    variant="secondary"
                    onClick={() => {
                        markEngaged();
                        setArming(null);
                        persist(DEFAULT_KEY_MAP);
                    }}
                >
                    {m.keymap_reset()}
                </Button>
            </div>
        </div>
    );
}
