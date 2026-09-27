// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Generated from changelog.yaml by dev/changelog.mts — do not edit.
//
// The newest releases, in the page's own bundle so the /news document says what
// changed without waiting for a fetch. The rest of the list is fetched.

import type { Release } from "./changelog";

export const LATEST_RELEASES: Release[] = [
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
    {
        date: "2026-09-27",
        label: "evening",
        entries: [
            {
                body: "**Settings opens without redrawing itself.** The recorded-piano panel arrived already\ncrediting the instrument and counting 637 recordings — figures that were never this\ndevice's — and the browser threw the page away and drew it again to correct them. It\nnow opens saying nothing has arrived yet, and fills in with what your device holds.",
                twip: true,
            },
        ],
    },
];
