// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ReactNode } from "react";

// "Nothing here yet, and here is how to start."
//
// The same moment was drawn five ways: a centred bordered box on the ear page, a bare
// left-aligned button on the placement test, two underlined links and no button at all on
// the review session, one muted sentence on assignments. Same sentence, four typographic
// registers — so a reader learned nothing from having seen one before.
//
// One shape: the page's own left edge, a line of body text, and one thing to press. An
// empty screen is an invitation, so it always carries an action; where the action is
// genuinely elsewhere, `children` takes links instead.
export function EmptyState({ body, children }: { body: ReactNode; children?: ReactNode }) {
    return (
        <div className="space-y-3">
            <p className="text-sm text-muted">{body}</p>
            {children ? <div className="flex flex-wrap items-center gap-3">{children}</div> : null}
        </div>
    );
}
