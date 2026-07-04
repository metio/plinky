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
        // biome-ignore lint/a11y/useButtonType: type is set from a defaulted prop
        <button
            type={type}
            className={`inline-flex min-h-11 items-center justify-center rounded-full border px-3.5 text-sm font-medium transition-colors disabled:opacity-50 ${
                selected
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : "border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            } ${className}`}
            {...rest}
        >
            {children}
        </button>
    );
}
