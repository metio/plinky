// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useMidiConnection } from "../contexts/midi";
import { Keyboard } from "./keyboard";
import { MidiBadge } from "./midiBadge";

// The practice-mode keyboard: the shared Keyboard wired to the live input funnel,
// so a tap feeds the same path as a MIDI device. Held keys light green, the note to
// play next is highlighted, and a wrong key flashes red.
export function PianoKeyboard({
    expected = [],
    wrong = null,
    from = 60,
    to = 84,
}: {
    expected?: number[];
    wrong?: { note: number; seq: number } | null;
    from?: number;
    to?: number;
}) {
    const { heldNotes, pressKey, releaseKey } = useMidiConnection();
    return (
        <Keyboard
            from={from}
            to={to}
            lit={new Set(heldNotes)}
            expected={expected}
            wrong={wrong}
            badge={<MidiBadge />}
            onPress={pressKey}
            onRelease={releaseKey}
        />
    );
}
