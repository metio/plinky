// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useCallback, useEffect, useState } from "react";
import {
    DEFAULT_KEY_MAP,
    type Hand,
    HANDS,
    type KeyMap,
    keyForSlot,
    NOTE_LABELS,
    rebind,
    SEMITONES,
} from "../lib/keyMap";
import { loadPrefs, savePrefs } from "../lib/prefs";
import { m } from "../paraglide/messages.js";
import { Button } from "./button";

const HAND_LABEL: Record<Hand, () => string> = {
    left: m.keyboard_hint_left,
    right: m.keyboard_hint_right,
};

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
// Saving dispatches a prefs-changed event, so the keyboard input layer picks up the new
// layout immediately. Off by default visually — most players use a piano, touch, or the
// stock layout — but one tap away for anyone who wants their own keys.
export function KeyMapping() {
    const [map, setMap] = useState<KeyMap>(DEFAULT_KEY_MAP);
    // The slot currently listening for a key, or null when idle.
    const [arming, setArming] = useState<{ hand: Hand; semitone: number } | null>(null);

    useEffect(() => {
        setMap(loadPrefs().keyMap);
    }, []);

    const persist = useCallback((next: KeyMap) => {
        setMap(next);
        // Merge onto the latest stored prefs so a change elsewhere on the page isn't lost.
        savePrefs({ ...loadPrefs(), keyMap: next });
    }, []);

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
                            const armed = arming?.hand === hand && arming.semitone === semitone;
                            return (
                                <button
                                    key={semitone}
                                    type="button"
                                    onClick={() => setArming(armed ? null : { hand, semitone })}
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
            <div className="flex items-center gap-3">
                {arming && (
                    <span className="text-xs text-indigo-700 dark:text-indigo-300">
                        {m.keymap_press()}
                    </span>
                )}
                <Button
                    variant="secondary"
                    onClick={() => {
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
