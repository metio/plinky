// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useRef } from "react";
import { useMidiConnection } from "../../contexts/midi";
import { useNoteLabels } from "../../hooks/useNoteLabels";
import { Keyboard } from "../ui/keyboard";
import { MidiBadge } from "./midiBadge";

// The practice-mode keyboard: the shared Keyboard wired to the live input funnel,
// so a tap feeds the same path as a MIDI device. Held keys light green, the note to
// play next is highlighted, and a wrong key flashes red.
export function PianoKeyboard({
    expected = [],
    wrong = null,
    from = 60,
    to = 84,
    well,
}: {
    expected?: number[];
    wrong?: { note: number; seq: number } | null;
    from?: number;
    to?: number;
    // The keybed's width and centring. Omitted falls back to the shared
    // centred, capped instrument; full screen passes a full-width well so the
    // keys use the whole page.
    well?: string;
}) {
    const { heldNotes, pressKey, releaseKey } = useMidiConnection();
    const labels = useNoteLabels();

    // A key still held when this surface tears down (a run ending, leaving full
    // screen) never delivers its pointer-up, so its note would stay lit and its
    // voice would ring on. Release whatever is held as the keybed unmounts. The
    // latest held set is read through a ref so the cleanup isn't pinned to a stale
    // render.
    const heldRef = useRef(heldNotes);
    heldRef.current = heldNotes;
    useEffect(
        () => () => {
            for (const note of heldRef.current) {
                releaseKey(note);
            }
        },
        [releaseKey],
    );

    return (
        <Keyboard
            from={from}
            to={to}
            well={well}
            lit={new Set(heldNotes)}
            expected={expected}
            wrong={wrong}
            labels={labels}
            badge={<MidiBadge />}
            onPress={pressKey}
            onRelease={releaseKey}
        />
    );
}
