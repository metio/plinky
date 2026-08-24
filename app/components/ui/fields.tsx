// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

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
            <span className="block text-sm font-medium text-body">{label}</span>
            <SegmentedControl
                label={label}
                options={options}
                value={value}
                onChange={onChange}
                disabled={disabled}
            />
            {help !== undefined && <p className="text-xs text-muted">{help}</p>}
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
            <p className="text-xs text-muted">{help}</p>
        </div>
    );
}

// A labelled 0–100 slider with its reading beside it.
//
// It wraps, and the slider gives up its width first: a label, a slider and a reading do not
// fit across a 320px phone in one line, and the slider is the only one of the three that is
// still itself when it is narrower. The reading has a fixed width and tabular figures so it
// does not shuffle the row as the number changes.
export function SliderField({
    label,
    value,
    onChange,
    disabled = false,
}: {
    label: string;
    value: number;
    onChange: (value: number) => void;
    disabled?: boolean;
}) {
    return (
        <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-body">{label}</span>
            <input
                type="range"
                className="min-w-24 flex-1"
                aria-label={label}
                min={0}
                max={100}
                value={value}
                disabled={disabled}
                onChange={(event) => onChange(Number(event.target.value))}
            />
            <span className="w-8 font-mono text-sm tabular-nums">{value}</span>
        </div>
    );
}
