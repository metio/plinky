// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { ButtonHTMLAttributes } from "react";

// A filter pill, selected or not, 44px-tall for touch. One look for every filter so a
// row of them reads as a coherent group rather than a wall of ad-hoc buttons. The
// caller sets the semantics: a single-select group leaves aria-pressed unset, a toggle
// passes aria-pressed so assistive tech announces the on/off state.
export function Chip({
    selected = false,
    type = "button",
    className = "",
    children,
    ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
    return (
        <button
            type={type}
            className={`inline-flex min-h-11 items-center justify-center rounded-md border px-3.5 text-sm font-medium transition-colors disabled:opacity-50 ${
                selected
                    ? "border-accent-solid bg-accent-solid text-white"
                    : "border-line-strong text-body hover:bg-subtle"
            } ${className}`}
            {...rest}
        >
            {children}
        </button>
    );
}
