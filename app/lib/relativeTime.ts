// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// How long ago something happened, in the reader's own language.
//
// Not in core/: it reads Intl, which nothing in that layer does, and the layer's rule is
// that time arrives as a parameter — which it does here — rather than that formatting does.
// app/lib is where the other Intl-shaped helper already lives.

// A short "3 minutes ago" for when a take was saved, localised without a message
// per unit by leaning on the platform's relative-time formatter.
export function formatAgo(fromMs: number, nowMs: number, locale: string): string {
    const seconds = Math.round((fromMs - nowMs) / 1000);
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    const abs = Math.abs(seconds);
    if (abs < 60) {
        return rtf.format(seconds, "second");
    }
    const minutes = Math.round(seconds / 60);
    if (Math.abs(minutes) < 60) {
        return rtf.format(minutes, "minute");
    }
    const hours = Math.round(minutes / 60);
    if (Math.abs(hours) < 24) {
        return rtf.format(hours, "hour");
    }
    return rtf.format(Math.round(hours / 24), "day");
}
