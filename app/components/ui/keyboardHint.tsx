// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
    DEFAULT_KEY_MAP,
    type Hand,
    type KeyMap,
    keyCapOf,
    keyForSlot,
} from "../../../core/keyMap";
import { m } from "../../paraglide/messages.js";
import { linkClasses } from "./classes";
import { LocalizedLink as Link } from "./localizedLink";

function formatOffset(offset: number): string {
    return offset > 0 ? `+${offset}` : `${offset}`;
}

// The computer-keyboard mapping, tucked behind a one-line disclosure rather than spelled
// out in full on every play page — the detail is there for whoever needs it, but a wall
// of text doesn't greet everyone (most play with a MIDI piano, touch, or already know it).
// The caps a hand's row of keys wears, in keyboard order: the seven naturals, then the
// five sharps with the gap a keyboard has between the E♭ and F♯ groups. Read off the
// player's own map, so a rebound key is the key the hint names.
function capsOf(map: KeyMap, hand: Hand): { whites: string; blacks: string } {
    const cap = (semitone: number) => keyCapOf(keyForSlot(map, hand, semitone));
    return {
        whites: [0, 2, 4, 5, 7, 9, 11].map(cap).join(" "),
        blacks: `${[1, 3].map(cap).join(" ")}\u00a0\u00a0${[6, 8, 10].map(cap).join(" ")}`,
    };
}

export function KeyboardHint({
    octaveOffset,
    keyMap = DEFAULT_KEY_MAP,
}: {
    octaveOffset: number;
    keyMap?: KeyMap;
}) {
    const left = capsOf(keyMap, "left");
    const right = capsOf(keyMap, "right");
    return (
        <details className="rounded-md border border-line bg-sunken p-3 text-xs text-muted">
            <summary className="cursor-pointer font-medium text-body">
                {m.keyboard_hint_no_piano()}
            </summary>
            <div className="space-y-1 pt-2">
                <p>
                    <span className="font-medium">{m.keyboard_hint_left()}</span> —{" "}
                    <span className="font-mono">{left.whites}</span>
                    {m.keyboard_hint_white_keys()} <span className="font-mono">{left.blacks}</span>
                    {m.keyboard_hint_black_keys()}
                </p>
                <p>
                    <span className="font-medium">{m.keyboard_hint_right()}</span> —{" "}
                    <span className="font-mono">{right.whites}</span>
                    {m.keyboard_hint_white_keys()} <span className="font-mono">{right.blacks}</span>
                    {m.keyboard_hint_black_keys()}
                </p>
                <p>
                    <span className="font-mono">↑ / ↓</span>
                    {m.keyboard_hint_shift()}
                    <span className="font-mono">{formatOffset(octaveOffset)}</span>.
                </p>
                <p>
                    <Link to="/settings" className={linkClasses}>
                        {m.keyboard_hint_customise()}
                    </Link>
                </p>
            </div>
        </details>
    );
}
