// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { m } from "../paraglide/messages.js";

function formatOffset(offset: number): string {
    return offset > 0 ? `+${offset}` : `${offset}`;
}

export function KeyboardHint({ octaveOffset }: { octaveOffset: number }) {
    return (
        <div className="space-y-1 rounded-md border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-3 text-xs text-gray-600 dark:text-gray-300">
            <p className="font-medium text-gray-700 dark:text-gray-300">
                {m.keyboard_hint_no_piano()}
            </p>
            <p>
                <span className="font-medium">{m.keyboard_hint_left()}</span> —{" "}
                <span className="font-mono">A S D F G</span>
                {m.keyboard_hint_white_keys()} <span className="font-mono">W E&nbsp;&nbsp;T</span>
                {m.keyboard_hint_black_keys()}
            </p>
            <p>
                <span className="font-medium">{m.keyboard_hint_right()}</span> —{" "}
                <span className="font-mono">H J K L ;</span>
                {m.keyboard_hint_white_keys()} <span className="font-mono">U I&nbsp;&nbsp;P</span>
                {m.keyboard_hint_black_keys()}
            </p>
            <p>
                <span className="font-mono">↑ / ↓</span>
                {m.keyboard_hint_shift()}
                <span className="font-mono">{formatOffset(octaveOffset)}</span>.
            </p>
        </div>
    );
}
