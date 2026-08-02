// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// A selector that reads as a selector, not a row of action buttons. The options sit in
// a recessed track and the chosen one lifts out as a card — visually distinct from the
// filled primary Button — so a tab can't be mistaken for "the thing to press". Touch-
// first, so each segment clears the 44px target. Rendered as an ARIA tablist.

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
    return (
        <div
            role="tablist"
            aria-label={label}
            className={`inline-flex flex-wrap gap-1 rounded-lg bg-subtle p-1 ${className}`}
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
                        className={`inline-flex min-h-11 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors disabled:opacity-50 ${
                            selected
                                ? "bg-surface text-accent-strong shadow-sm"
                                : // `body`, not `muted`: an unselected tab is a control the
                                  // reader is meant to act on, and it sits on the tinted
                                  // track, where helper-text grey drops under 4.5:1.
                                  "text-body hover:text-ink"
                        }`}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}
