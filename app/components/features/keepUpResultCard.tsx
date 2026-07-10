// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { KeepUpResult } from "../../../core/grade";
import { m } from "../../paraglide/messages.js";
import { GradeLetter } from "../ui/gradeLetter";

// The play-along result — how many beats you kept up with — shown when a
// tempo-locked run finishes, in place of the self-paced grade panel.
export function KeepUpResultCard({ result }: { result: KeepUpResult }) {
    return (
        <div className="flex items-center gap-4 rounded-md border border-gray-200 p-3 dark:border-gray-800">
            <GradeLetter letter={result.letter} />
            <p className="text-sm text-gray-700 dark:text-gray-300">
                {m.keep_up_result({ inTime: result.inTime, total: result.total })}
            </p>
        </div>
    );
}
