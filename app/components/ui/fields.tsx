// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { ReactNode } from "react";
import { SegmentedControl } from "./segmentedControl";
import { Switch } from "./switch";

// A labelled multiple-choice preference: every option visible and tappable as a
// segment — no dropdown to open, no hidden choices — with an optional help line
// that explains the pick in plain words.
export function ChoiceField<T extends string>({
    label,
    value,
    onChange,
    options,
    help,
    disabled = false,
}: {
    label: string;
    value: T;
    onChange: (value: T) => void;
    options: { id: T; label: string }[];
    help?: string;
    disabled?: boolean;
}) {
    return (
        <div className="space-y-1">
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {label}
            </span>
            <SegmentedControl
                label={label}
                options={options}
                value={value}
                onChange={onChange}
                disabled={disabled}
            />
            {help !== undefined && (
                <p className="text-xs text-gray-500 dark:text-gray-400">{help}</p>
            )}
        </div>
    );
}

// A switch with an optional help line — the standard shape of a boolean
// preference, everywhere one appears: the Settings page, the run-setup panel,
// the compose row. Without `help` it is just the Switch.
export function SwitchField({
    label,
    checked,
    onChange,
    help,
    disabled = false,
}: {
    label: ReactNode;
    checked: boolean;
    onChange: (checked: boolean) => void;
    help?: string;
    disabled?: boolean;
}) {
    if (help === undefined) {
        return <Switch label={label} checked={checked} onChange={onChange} disabled={disabled} />;
    }
    return (
        <div className="space-y-1">
            <Switch label={label} checked={checked} onChange={onChange} disabled={disabled} />
            <p className="text-xs text-gray-500 dark:text-gray-400">{help}</p>
        </div>
    );
}
