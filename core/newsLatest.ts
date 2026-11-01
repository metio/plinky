// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Generated from changelog.yaml by dev/changelog.mts — do not edit.
//
// The newest releases, in the page's own bundle so the /news document says what
// changed without waiting for a fetch. The rest of the list is fetched.

import type { Release } from "./changelog";

export const LATEST_RELEASES: Release[] = [
    {
        date: "2026-11-01",
        label: null,
        entries: [
            {
                body: "**A link that opens a particular ear drill, or the shelf's Manage tab, opens without\nredrawing itself.** A link naming an exercise and its level — a review link, or one\nof today's suggestions — arrives as the same page everyone gets, with only the\naddress saying which drill it is, and the browser threw that page away and drew it\nagain the moment it read the address. Those links now open as they arrive, and still\nland where they name.",
                twip: true,
            },
        ],
    },
    {
        date: "2026-09-27",
        label: "night",
        entries: [
            {
                body: "**Composer pages, piece pages and the music shelves open without redrawing\nthemselves.** Each of those arrives already written for the piece or the person it\nis about, and the browser was throwing that page away and drawing it again from\nnothing the moment it opened. They now open as they arrive.",
                twip: true,
            },
        ],
    },
];
