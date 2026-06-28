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
    className = "",
}: {
    options: Option<T>[];
    value: T;
    onChange: (id: T) => void;
    label: string;
    className?: string;
}) {
    return (
        <div
            role="tablist"
            aria-label={label}
            className={`inline-flex flex-wrap gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800 ${className}`}
        >
            {options.map((option) => {
                const selected = option.id === value;
                return (
                    <button
                        key={option.id}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        onClick={() => onChange(option.id)}
                        className={`inline-flex min-h-11 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors ${
                            selected
                                ? "bg-white text-indigo-700 shadow-sm dark:bg-gray-950 dark:text-indigo-300"
                                : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                        }`}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}
