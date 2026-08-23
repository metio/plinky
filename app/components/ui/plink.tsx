// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The plink: a note falls, lands, and rings. It is the event the app is named after and
// the one the mark draws, so it is also what the app does while it is busy — one gesture
// used everywhere something is loading, rather than a turning ring here and a sweeping
// band there.
//
// Purely decorative, and silent to assistive technology: a caller that means "work is
// under way" says so in words beside it. Everything is CSS, so nothing here schedules a
// frame or holds a timer, and `motion-reduce` leaves a still dot resting on the key —
// the end of the gesture, which is a legible state rather than an absence.
//
// It fills the box it is given and derives every part from that box, so one component
// serves a 14px inline mark and a panel-sized one without a size prop.
export function Plink({ className = "" }: { className?: string }) {
    return (
        <span className={`relative block ${className}`} aria-hidden="true">
            <span className="absolute inset-x-0 top-0 mx-auto h-[70%] w-px origin-top animate-plink-trail bg-gradient-to-b from-transparent to-plink motion-reduce:hidden" />
            {/* The ring sits under the note so the note stays the brightest thing at the
                moment they overlap. */}
            <span className="absolute bottom-0 left-1/2 aspect-square w-[30%] -translate-x-1/2 animate-plink-ring rounded-full border border-plink motion-reduce:hidden" />
            <span className="absolute bottom-0 left-1/2 aspect-square w-[30%] -translate-x-1/2 animate-plink-fall rounded-full bg-plink motion-reduce:animate-none" />
        </span>
    );
}
