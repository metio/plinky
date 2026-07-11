// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { ReactNode } from "react";
import { IconButton } from "./button";

// An icon that is also a switch: pressed state announced to assistive tech and
// shown as the accent colour — the idiom every toggle in the fullscreen
// transport (finger numbers, follow-the-note, the fingering editor) shares.
export function ToggleIconButton({
    pressed,
    label,
    onClick,
    children,
}: {
    pressed: boolean;
    label: string;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <IconButton
            onClick={onClick}
            aria-pressed={pressed}
            label={label}
            className={pressed ? "text-indigo-600 dark:text-indigo-400" : ""}
        >
            {children}
        </IconButton>
    );
}
