// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useState, useSyncExternalStore } from "react";
import type { NoteLabels } from "../../../core/prefs";
import type { HoldFeed } from "../../hooks/useHoldIndicator";
import { useMidiConnection, useHeldNotes } from "../../contexts/midi";
import { useKeyboardTheme } from "../../hooks/useKeyboardTheme";
import { useNoteLabels } from "../../hooks/useNoteLabels";
import { Keyboard } from "../ui/keyboard";
import { MidiBadge } from "./midiBadge";

// The practice-mode keyboard: the shared Keyboard wired to the live input funnel,
// so a tap feeds the same path as a MIDI device. Held keys light green, the note to
// play next is highlighted, and a wrong key flashes red.
const NO_HOLDS: ReadonlyMap<number, number> = new Map();
// A feed for the surfaces that have no holds at all (compose). Stable, so the
// subscription below is the same shape whether or not a run is under way.
const QUIET: HoldFeed = { subscribe: () => () => {}, get: () => NO_HOLDS };

export function PianoKeyboard({
    expected = [],
    sounding,
    wrong = null,
    holds,
    from = 60,
    to = 84,
    well,
    labels: labelsOverride,
}: {
    expected?: number[];
    // Notes the app is sounding right now, by hand — what Listen lights as it plays.
    sounding?: ReadonlyMap<number, "left" | "right">;
    wrong?: { note: number; seq: number } | null;
    // The hold-duration fills, subscribed to here rather than passed as a value.
    // They move every animation frame while a note is held, and handing them down as a
    // prop meant every ancestor re-rendered at that rate to deliver them — the whole
    // play surface repainting sixty times a second to fill one key. Subscribing at the
    // one component that paints them keeps the frames where they belong.
    holds?: HoldFeed;
    from?: number;
    to?: number;
    // The keybed's width and centring. Omitted falls back to the shared
    // centred, capped instrument; full screen passes a full-width well so the
    // keys use the whole page.
    well?: string;
    // Override the saved key labels for this keybed. A sight-read run passes "off"
    // so the run reads without them while the player's own setting stands for
    // everything else.
    labels?: NoteLabels;
}) {
    const feed = holds ?? QUIET;
    // The one subscription to the per-frame fills. Everything above this component is
    // untouched by a hold; only these keys repaint.
    const holdFractions = useSyncExternalStore(feed.subscribe, feed.get, () => NO_HOLDS);
    const { pressKey, releaseKey, pedalHeld, subscribe } = useMidiConnection();
    const heldNotes = useHeldNotes();
    const savedLabels = useNoteLabels();
    const labels = labelsOverride ?? savedLabels;
    const theme = useKeyboardTheme();

    // Reflect the sustain pedal on the keybed. The held-pedal set lives in a ref (no
    // re-render on change), so subscribe to pedal events and mirror sustain into state,
    // seeded from the current value in case it is already down at mount.
    const [sustained, setSustained] = useState(() => pedalHeld("sustain"));
    useEffect(
        () =>
            subscribe({
                onPedal: (pedal, down) => {
                    if (pedal === "sustain") {
                        setSustained(down);
                    }
                },
            }),
        [subscribe],
    );

    // A key still held when this surface tears down never delivers its pointer-up; the
    // shared Keyboard releases its own on-screen sources on unmount, so its voice does not
    // ring on. A MIDI or mic note held then is genuinely still down (that device keeps
    // streaming its own note-off), so it is deliberately left alone rather than cut short.

    return (
        <Keyboard
            from={from}
            to={to}
            well={well}
            lit={new Set(heldNotes)}
            expected={expected}
            sounding={sounding}
            wrong={wrong}
            holds={holdFractions}
            labels={labels}
            sustained={sustained}
            theme={theme}
            badge={<MidiBadge />}
            onPress={pressKey}
            onRelease={releaseKey}
        />
    );
}
