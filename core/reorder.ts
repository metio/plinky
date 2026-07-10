// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Pure list-reordering math shared by the drag handles and any other reorder
// affordance: moving an element to a new position, and translating a pointer's
// vertical position into the row it is over.

// The list with the element at `from` moved to `to` (both final positions).
// An out-of-range index or a no-op move returns the original array unchanged,
// so callers can bail on identity.
export function moveTo<T>(items: readonly T[], from: number, to: number): T[] {
    if (
        from === to ||
        from < 0 ||
        to < 0 ||
        from >= items.length ||
        to >= items.length ||
        !Number.isInteger(from) ||
        !Number.isInteger(to)
    ) {
        return items as T[];
    }
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved as T);
    return next;
}

// Which row a pointer at vertical position `y` lands on, given each row's vertical
// midpoint in the same coordinate space: the number of midpoints above it, clamped
// to the last row. An empty list yields 0 so a caller can treat it as "first".
export function rowAt(y: number, midpoints: readonly number[]): number {
    let index = 0;
    for (const midpoint of midpoints) {
        if (y > midpoint) {
            index += 1;
        }
    }
    return Math.min(index, Math.max(midpoints.length - 1, 0));
}
