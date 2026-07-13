// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { type ReactNode, useEffect, useRef, useState } from "react";
import { IconButton } from "./button";
import { MinusIcon, PlusIcon } from "./icons";

// A value that briefly emphasises itself the moment it changes — the confirmation that
// a tap landed, with no toast and no layout shift (tabular digits + a transform-only
// bump, so siblings never move). The colour tick alone still reads under reduced-motion.
export function BumpValue({ value, className = "" }: { value: ReactNode; className?: string }) {
    const [bumped, setBumped] = useState(false);
    const previous = useRef(value);

    useEffect(() => {
        if (previous.current !== value) {
            previous.current = value;
            setBumped(true);
            // A cosmetic bump — a pure UI primitive (ui-is-pure) owns its own
            // transition timer (allow-listed in dev/check-globals.mjs).
            const id = window.setTimeout(() => setBumped(false), 150);
            return () => window.clearTimeout(id);
        }
    }, [value]);

    return (
        <span
            className={`tabular-nums transition-[color,transform] duration-150 ${
                bumped
                    ? "scale-110 text-indigo-600 motion-reduce:scale-100 dark:text-indigo-400"
                    : ""
            } ${className}`}
        >
            {value}
        </span>
    );
}

// A −/value/+ stepper: two 44px buttons with the value held between them, so the tap
// targets are spread (no fat-finger reversals) and the feedback sits where the finger
// is. Bounds disable rather than hide a button, so the control never reflows.
export function Stepper({
    value,
    onDecrement,
    onIncrement,
    decrementLabel,
    incrementLabel,
    canDecrement = true,
    canIncrement = true,
}: {
    value: ReactNode;
    onDecrement: () => void;
    onIncrement: () => void;
    decrementLabel: string;
    incrementLabel: string;
    canDecrement?: boolean;
    canIncrement?: boolean;
}) {
    return (
        <span className="inline-flex items-center gap-2">
            <IconButton
                variant="secondary"
                label={decrementLabel}
                disabled={!canDecrement}
                onClick={onDecrement}
            >
                <MinusIcon className="h-5 w-5" />
            </IconButton>
            <BumpValue
                value={value}
                className="min-w-[3.25rem] text-center text-sm font-semibold text-gray-800 dark:text-gray-200"
            />
            <IconButton
                variant="secondary"
                label={incrementLabel}
                disabled={!canIncrement}
                onClick={onIncrement}
            >
                <PlusIcon className="h-5 w-5" />
            </IconButton>
        </span>
    );
}
