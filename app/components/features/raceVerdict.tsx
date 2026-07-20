// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { ReactNode } from "react";
import { formatRaceMargin, type RaceVerdict as Verdict } from "../../../core/ghost";
import { m } from "../../paraglide/messages.js";
import { GhostIcon, KeysIcon } from "../ui/icons";

// The head-to-head payoff shown with the grade when a raced run finishes: who crossed the
// line first and by how much. A win wears your indigo and the keys; a loss wears the
// ghost's fuchsia; a dead heat stays neutral — the same colour language as the race strip
// so the result reads as the end of that same duel.
export function RaceVerdict({ verdict }: { verdict: Verdict }) {
    const margin = formatRaceMargin(verdict.marginMs);

    if (verdict.outcome === "tie") {
        return (
            <Card tone="border-gray-300 bg-gray-50 text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200">
                <Badge fill="bg-gray-400">
                    <KeysIcon className="h-3.5 w-3.5" />
                </Badge>
                {m.ghost_verdict_tie()}
            </Card>
        );
    }

    const won = verdict.outcome === "won";
    return won ? (
        <Card tone="border-green-300 bg-green-50 text-green-800 dark:border-green-700 dark:bg-green-950 dark:text-green-300">
            <Badge fill="bg-indigo-600">
                <KeysIcon className="h-3.5 w-3.5" />
            </Badge>
            {m.ghost_verdict_won({ margin })}
        </Card>
    ) : (
        <Card tone="border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-300">
            <Badge fill="bg-fuchsia-500">
                <GhostIcon className="h-3.5 w-3.5" />
            </Badge>
            {m.ghost_verdict_lost({ margin })}
        </Card>
    );
}

function Card({ tone, children }: { tone: string; children: ReactNode }) {
    return (
        <div
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${tone}`}
        >
            {children}
        </div>
    );
}

function Badge({ fill, children }: { fill: string; children: ReactNode }) {
    return (
        <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white ${fill}`}
        >
            {children}
        </span>
    );
}
