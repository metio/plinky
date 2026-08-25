// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useSearchParams } from "react-router";
import { m } from "../../paraglide/messages.js";
import { LocalizedLink as Link } from "../ui/localizedLink";
import { UndoIcon } from "../ui/icons";

// The way back from a warm-up to the piece it was opened to prepare.
//
// The pairing only works if the two are minutes apart, and a drill that ends by leaving
// somebody wherever they landed is a detour rather than a warm-up. So the piece travels
// with the link — its id to go back to, its title to say so — and this appears only when
// something actually sent the player here.
//
// The title rides in the address rather than being looked up, which keeps the link correct
// on the first paint and costs the exercise page no catalogue read of its own.
export function ReturnToPiece() {
    const [params] = useSearchParams();
    const id = params.get("then");
    const title = params.get("fromTitle");
    // Both or neither: a link with no title cannot say where it goes, and a title with no
    // id has nowhere to send anybody.
    if (!id || !title) {
        return null;
    }
    return (
        <Link
            to={`/play/${id}`}
            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-accent-strong hover:underline"
        >
            <UndoIcon className="h-4 w-4" />
            {m.warmup_back({ title })}
        </Link>
    );
}
