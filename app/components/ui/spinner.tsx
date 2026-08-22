// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Work is under way and there is nothing yet to show for it. Sized to sit beside a label
// rather than to fill a panel, and named out loud, because a ring that turns silently tells
// a screen reader nothing at all.
export function Spinner({ label }: { label: string }) {
    return (
        <span
            className="inline-block size-3.5 shrink-0 animate-spin rounded-full border-2 border-line border-t-accent-solid motion-reduce:animate-none"
            role="status"
            aria-label={label}
        />
    );
}
