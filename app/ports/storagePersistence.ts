// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Asking the browser to keep what the player has done.
//
// Everything Plinky remembers lives in browser storage on one device, and by default a
// browser holds that in a best-effort bucket it is free to evict whole when the disk
// fills. A player who practised for months would open the app to grade 1, no history and
// no takes, with nothing to distinguish it from a first visit. Persistence moves the
// origin out of that bucket.
//
// A capability rather than a call, because the browsers disagree about it — one grants it
// silently on engagement, one asks the player, one has no such notion — and because the
// decision of WHEN to ask is a product decision that belongs above the platform. Asking
// too early gets a no; the adapter cannot know what "too early" means.
export interface StoragePersistence {
    // Ask that this origin's data be kept, and report whether it now is. Already-granted
    // counts as granted, so this is safe to call more than once — the adapter checks
    // before it asks, and a browser that cannot answer reports false rather than throwing.
    ensure(): Promise<boolean>;
}
