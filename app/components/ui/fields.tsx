// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { ReactNode } from "react";
import { SegmentedControl } from "./segmentedControl";

// A labelled multiple-choice preference: every option visible and tappable as a
// segment — no dropdown to open, no hidden choices — with an optional help line
// that explains the pick in plain words.
export function ChoiceField<T extends string>({
    label,
    value,
    onChange,
    options,
    help,
}: {
    label: string;
    value: T;
    onChange: (value: T) => void;
    options: { id: T; label: string }[];
    help?: string;
}) {
    return (
        <div className="space-y-1">
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {label}
            </span>
            <SegmentedControl label={label} options={options} value={value} onChange={onChange} />
            {help !== undefined && (
                <p className="text-xs text-gray-500 dark:text-gray-400">{help}</p>
            )}
        </div>
    );
}

// A labelled checkbox — the standard shape of a boolean preference. The wrapping
// <label> makes the text part of the click target.
export function CheckboxField({
    label,
    checked,
    onChange,
    disabled = false,
}: {
    label: ReactNode;
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
}) {
    return (
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={(event) => onChange(event.target.checked)}
            />
            {label}
        </label>
    );
}
