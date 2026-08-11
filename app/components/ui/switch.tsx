// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ReactNode } from "react";

// An on/off switch — a real `role="switch"`, not a pressed button, so assistive tech
// announces the state. The whole control (track + trailing label) is the 44px tap
// target. Only the knob moves and only the track colour crossfades — one motion, one
// accent — and it snaps instantly under reduced-motion.
export function Switch({
    checked,
    onChange,
    label,
    disabled = false,
    title,
}: {
    checked: boolean;
    onChange: (next: boolean) => void;
    label: ReactNode;
    disabled?: boolean;
    title?: string;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            title={title}
            onClick={() => onChange(!checked)}
            className="inline-flex min-h-11 items-center gap-2.5 text-sm font-medium text-body transition-opacity disabled:opacity-50"
        >
            <span
                aria-hidden="true"
                className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors ${
                    checked ? "bg-accent-solid" : "bg-key-spent"
                }`}
            >
                <span
                    className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out motion-reduce:transition-none ${
                        checked ? "translate-x-[1.125rem]" : "translate-x-0.5"
                    }`}
                />
            </span>
            <span>{label}</span>
        </button>
    );
}
