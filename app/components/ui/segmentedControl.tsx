// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A selector that reads as a selector, not a row of action buttons. The options sit in
// a recessed track and the chosen one lifts out as a card — visually distinct from the
// filled primary Button — so a tab can't be mistaken for "the thing to press". Touch-
// first, so each segment clears the 44px target. Rendered as an ARIA tablist.
//
// Past a handful of options the track stops being a track: twelve keys or thirteen scale
// names wrap into a solid tinted slab that reads as a tag cloud, and the one lifted
// segment is lost in it. Beyond that count the same control drops the track and outlines
// each option instead — same roles, same behaviour, a shape that survives wrapping.

// Where a row of segments stops reading as one control. Six fits a phone on one or two
// lines; the twelve-key and thirteen-scale pickers are the ones this is for.
const TRACK_LIMIT = 6;

type Option<T extends string> = { id: T; label: string };

export function SegmentedControl<T extends string>({
    options,
    value,
    onChange,
    label,
    disabled = false,
    className = "",
}: {
    options: Option<T>[];
    value: T;
    onChange: (id: T) => void;
    label: string;
    disabled?: boolean;
    className?: string;
}) {
    const loose = options.length > TRACK_LIMIT;
    return (
        <div
            role="tablist"
            aria-label={label}
            className={`inline-flex flex-wrap gap-1 ${loose ? "" : "rounded-lg bg-subtle p-1"} ${className}`}
        >
            {options.map((option) => {
                const selected = option.id === value;
                return (
                    <button
                        key={option.id}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        disabled={disabled}
                        onClick={() => onChange(option.id)}
                        className={`inline-flex min-h-11 items-center justify-center px-4 text-sm font-medium transition-colors disabled:opacity-50 ${
                            loose
                                ? `rounded-full border ${
                                      selected
                                          ? "border-accent-line-strong bg-accent-surface text-accent-strong"
                                          : "border-line-strong text-body hover:border-accent-line-strong hover:text-accent-strong"
                                  }`
                                : `rounded-md ${
                                      selected
                                          ? "bg-surface text-accent-strong shadow-sm"
                                          : // `body`, not `muted`: an unselected tab is a
                                            // control the reader is meant to act on, and it
                                            // sits on the tinted track, where helper-text
                                            // grey drops under 4.5:1.
                                            "text-body hover:text-ink"
                                  }`
                        }`}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}
