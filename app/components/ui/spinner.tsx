// SPDX-FileCopyrightText: The Klimpi Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Tinkle } from "./tinkle";

// Work is under way and there is nothing yet to show for it. Sized to sit beside a label
// rather than to fill a panel, and named out loud, because a mark that moves silently
// tells a screen reader nothing at all — the name is the whole accessible content, which
// is why the tinkle inside is hidden from the tree rather than described twice.
export function Spinner({ label }: { label: string }) {
    return (
        <span className="inline-block shrink-0 align-middle" role="status" aria-label={label}>
            <Tinkle className="size-4" />
        </span>
    );
}
