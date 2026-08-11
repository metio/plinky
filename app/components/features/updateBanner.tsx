// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { m } from "../../paraglide/messages.js";
import { Banner } from "../ui/banner";

// A quiet, dismissible notice that this device can no longer receive new versions.
//
// There is deliberately nothing here about an update being *available*: a waiting build
// takes over by itself at the next route change or when the reader comes back to the
// tab, and never mid-run. Asking was a chore with only one sensible answer, and on a
// repo that deploys every push it was close to permanent. An app that has quietly
// stopped updating is the case still worth a word, because nothing else would ever
// reveal it.
export function UpdateBanner({ updateBroken = false }: { updateBroken?: boolean }) {
    // Dismissal lasts only until the next page load: a new version stays worth
    // offering on a fresh visit, and the notice never persists (nor needs to).
    const [dismissed, setDismissed] = useState(false);
    if (dismissed) {
        return null;
    }
    if (!updateBroken) {
        return null;
    }
    return (
        <Banner tone="amber" onDismiss={() => setDismissed(true)} dismissLabel={m.action_dismiss()}>
            {m.update_broken()}
        </Banner>
    );
}
