// SPDX-FileCopyrightText: The Klimpi Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { todayKey } from "./daily";

// Klimpi answered to plinky.fun before it was called Klimpi, and that address still
// serves the app. Practice is kept in the browser under the origin that stored it, so
// nobody's work can be carried across on its own: klimpi.app cannot read plinky.fun's
// storage, and no amount of code on either side changes that. What the old address can
// do is say where the app went, and point at the one thing that does cross over — the
// progress bundle, which a player saves here and restores there.

export const OLD_HOST = "plinky.fun";

// Where the move leads. The notice names it in full, because a player reading it on the
// old domain has to be able to type it somewhere else if they want to.
export const NEW_HOST = "klimpi.app";

// How long the notice is worth a strip across every page. A surface with no end
// condition becomes permanent, so the end is written down rather than remembered: past
// this day `offerMove` is false whatever the host, and taking the component out again is
// a deletion with nothing left to decide.
export const MOVE_NOTICE_UNTIL = "2027-02-01";

// Whether this page should offer to move the player's practice. Date keys are
// `YYYY-MM-DD`, which compares in the right order as plain text.
export function offerMove(hostname: string, now: Date): boolean {
    return hostname === OLD_HOST && todayKey(now) < MOVE_NOTICE_UNTIL;
}
