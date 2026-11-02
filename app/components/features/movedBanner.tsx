// SPDX-FileCopyrightText: The Klimpi Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { Link } from "react-router";
import { NEW_HOST } from "../../../core/oldDomain";
import { m } from "../../paraglide/messages.js";
import { Banner } from "../ui/banner";
import { localizedHref } from "../ui/href";

// Shown only on the address Klimpi used to answer to, and only while the move is still
// recent — `core/oldDomain` owns both of those conditions, and this component is handed
// the answer rather than working it out.
//
// What a reader needs from it is the part that is not obvious: practice is kept in the
// browser under the origin that stored it, so arriving at the new address shows an empty
// app however much work is sitting here. The two links are the whole crossing — the
// backup on this side, the restore on the other — so the second one lands on the page
// that does the restoring rather than the new home page.
//
// The actions go in the footer slot, which gives the message the full width: three things
// on one line leaves the sentence about eighty pixels on a narrow phone.
export function MovedBanner({ offer }: { offer: boolean }) {
    // Dismissal lasts until the next load, as the other banners' does. Nothing is
    // persisted for it: a reader who has not moved yet is better served by seeing this
    // again than by a flag that silently hides where the app went.
    const [dismissed, setDismissed] = useState(false);
    if (!offer || dismissed) {
        return null;
    }
    // Both sides of the crossing are the same page, in the reader's own language.
    const settings = localizedHref("/settings");
    return (
        <Banner
            tone="amber"
            onDismiss={() => setDismissed(true)}
            dismissLabel={m.action_dismiss()}
            footer={
                <div className="flex flex-wrap items-center gap-3">
                    <Link
                        to={settings}
                        className="rounded-md bg-accent-solid px-3 py-1 text-sm font-medium text-white hover:bg-chart-peak"
                    >
                        {m.moved_backup()}
                    </Link>
                    <a
                        href={`https://${NEW_HOST}${settings}`}
                        className="text-sm text-warn-ink underline"
                    >
                        {m.moved_new_home({ host: NEW_HOST })}
                    </a>
                </div>
            }
        >
            {m.moved_notice({ host: NEW_HOST })}
        </Banner>
    );
}
