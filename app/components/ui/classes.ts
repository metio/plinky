// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Shared Tailwind class strings for elements that must match a common look without
// a component wrapper — the class-string counterpart of `buttonClasses`. Kept as
// plain literals so the class gate can verify every name compiles.

// The standard text input.
export const fieldClasses =
    "rounded-md border border-line-strong bg-transparent px-2 py-1.5 text-sm text-ink-soft";

// The compact input/select used in dense control rows.
export const compactFieldClasses =
    "rounded-md border border-line-strong bg-transparent px-2 py-1 text-sm text-body";

// The inline text link.
export const linkClasses = "text-accent-strong underline";

// The label over a group of things — a section of a page, a panel in Settings, a unit of
// a course. Small, letter-spaced brass caps: the app's one way of saying "these belong
// together", so a reader learns it once and recognises it everywhere.
export const sectionLabelClasses =
    "text-xs font-semibold uppercase tracking-[0.16em] text-spark-strong";

// The same label with the hairline under it, for a group that owns the width it sits in.
export const sectionHeadingClasses = `border-b border-line pb-1.5 ${sectionLabelClasses}`;
