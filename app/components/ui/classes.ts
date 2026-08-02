// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

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
