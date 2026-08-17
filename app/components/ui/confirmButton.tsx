// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { type ReactNode, useState } from "react";
import { m } from "../../paraglide/messages.js";
import { Button, type ButtonVariant, IconButton } from "./button";

// A destructive action that takes two clicks: the first arms it (swapping in a red
// confirm button and a cancel), the second carries it out. Mirrors the Danger Zone
// reset so every irreversible action in the app asks the same way. Pass `label` to
// render the resting trigger as an icon button (the icon goes in `children`); omit
// it for a normal text button.
export function ConfirmButton({
    onConfirm,
    confirmLabel,
    children,
    label,
    variant = "secondary",
    disabled,
    className,
}: {
    onConfirm: () => void;
    // The label on the red confirm button once armed — phrase it as the question.
    // A function is resolved only once the button is armed, for a label whose text costs
    // something to work out — the library's names how many assignments a score is in, and
    // computing that for every row on every render is work for a question nobody asked.
    confirmLabel: string | (() => string);
    children: ReactNode;
    // When set, the resting trigger is an icon button with this accessible name.
    label?: string;
    variant?: ButtonVariant;
    disabled?: boolean;
    className?: string;
}) {
    const [armed, setArmed] = useState(false);

    if (armed) {
        return (
            <span className="inline-flex items-center gap-1">
                <Button
                    variant="danger"
                    onClick={() => {
                        setArmed(false);
                        onConfirm();
                    }}
                >
                    {typeof confirmLabel === "function" ? confirmLabel() : confirmLabel}
                </Button>
                <Button variant="ghost" onClick={() => setArmed(false)}>
                    {m.action_cancel()}
                </Button>
            </span>
        );
    }

    if (label) {
        return (
            <IconButton
                variant={variant}
                label={label}
                disabled={disabled}
                className={className}
                onClick={() => setArmed(true)}
            >
                {children}
            </IconButton>
        );
    }

    return (
        <Button
            variant={variant}
            disabled={disabled}
            className={className}
            onClick={() => setArmed(true)}
        >
            {children}
        </Button>
    );
}
