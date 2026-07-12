// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { ReactNode } from "react";

// A lead-in label for a selector or slider, so each control names itself without a
// separate heading per row.
export function Labeled({ label, children }: { label: ReactNode; children: ReactNode }) {
    return (
        <span className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <span>{label}</span>
            {children}
        </span>
    );
}

// A control paired with a caption beneath it, so each option explains what it does — and
// what its values mean — inline, rather than leaving the help to a tooltip that never
// shows on touch. Full width, so the options stack one per row with room for the caption.
export function Option({ caption, children }: { caption: string; children: ReactNode }) {
    return (
        <span className="flex w-full flex-col gap-1">
            {children}
            <span className="text-xs text-gray-500 dark:text-gray-400">{caption}</span>
        </span>
    );
}
