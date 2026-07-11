// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { m } from "../../paraglide/messages.js";
import { linkClasses } from "./classes";
import { LocalizedLink as Link } from "./localizedLink";

function formatOffset(offset: number): string {
    return offset > 0 ? `+${offset}` : `${offset}`;
}

// The computer-keyboard mapping, tucked behind a one-line disclosure rather than spelled
// out in full on every play page — the detail is there for whoever needs it, but a wall
// of text doesn't greet everyone (most play with a MIDI piano, touch, or already know it).
export function KeyboardHint({ octaveOffset }: { octaveOffset: number }) {
    return (
        <details className="rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
            <summary className="cursor-pointer font-medium text-gray-700 dark:text-gray-300">
                {m.keyboard_hint_no_piano()}
            </summary>
            <div className="space-y-1 pt-2">
                <p>
                    <span className="font-medium">{m.keyboard_hint_left()}</span> —{" "}
                    <span className="font-mono">Z X C V B N M</span>
                    {m.keyboard_hint_white_keys()}{" "}
                    <span className="font-mono">S D&nbsp;&nbsp;G H J</span>
                    {m.keyboard_hint_black_keys()}
                </p>
                <p>
                    <span className="font-medium">{m.keyboard_hint_right()}</span> —{" "}
                    <span className="font-mono">Q W E R T Y U</span>
                    {m.keyboard_hint_white_keys()}{" "}
                    <span className="font-mono">2 3&nbsp;&nbsp;5 6 7</span>
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
