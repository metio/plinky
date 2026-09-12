// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { NoteRemap } from "../../lib/scoreColor";

// Everything on the play surface that holds on to drawn noteheads, each named so a caller
// cannot leave one out.
type RedrawFollowers = {
    hidden: { reconceal: () => void };
    vanishing: { rearm: () => void };
    listenPlayback: { retarget: (remap: NoteRemap) => void };
    keepUp: { retarget: (remap: NoteRemap) => void };
};

// The score was redrawn in place mid-run, rebuilding every notehead. The ear-mode conceal
// is applied again, so a hidden run's blanked answers are not exposed by the fresh render,
// the vanishing bars are re-armed, and both transports follow their lit notes to the fresh
// noteheads. A transport left holding the discarded ones would lift nothing and leave a
// fresh note lit for good.
export function followRedraw(followers: RedrawFollowers, remap: NoteRemap): void {
    followers.hidden.reconceal();
    followers.vanishing.rearm();
    followers.listenPlayback.retarget(remap);
    followers.keepUp.retarget(remap);
}
