// SPDX-FileCopyrightText: The Klimpi Authors
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
                body: "**Plinky is now Klimpi.** New name, new mark — a piano keyboard standing upright as\nthe K, with the key you press in fuchsia. Everything you have done is still here:\nyour scores, your pieces, your takes, all on your device as before. Nothing to sign\nin to, nothing to move across.",
                twip: true,
            },
            {
                body: "**A new set of colours to go with it.** Fuchsia for what you press, aubergine for\nthe page at night, brass for what you earned. It opens this way, and the two you\nalready know are still in Settings → Colours: Indigo and Violet. Any of the three\nworks in light, dark or black, so pick the pair you like.",
                twip: true,
            },
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
