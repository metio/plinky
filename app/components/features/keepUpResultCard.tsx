// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { KeepUpResult } from "../../../core/grade";
import { m } from "../../paraglide/messages.js";
import { FolioRow } from "../ui/folio";
import { GradeLetter } from "../ui/gradeLetter";

// The play-along result — how many beats you kept up with — shown when a
// tempo-locked run finishes, in place of the self-paced grade panel. A Folio row: the
// letter in the margin, the count as its name.
export function KeepUpResultCard({ result }: { result: KeepUpResult }) {
    return (
        <FolioRow
            margin={<GradeLetter letter={result.letter} />}
            name={m.keep_up_result({ inTime: result.inTime, total: result.total })}
        />
    );
}
