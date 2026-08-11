// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

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
            <Card tone="border-line-strong bg-sunken text-body">
                <Badge fill="bg-key-spent">
                    <KeysIcon className="h-3.5 w-3.5" />
                </Badge>
                {m.ghost_verdict_tie()}
            </Card>
        );
    }

    const won = verdict.outcome === "won";
    return won ? (
        <Card tone="border-success-line bg-success-surface text-success">
            <Badge fill="bg-accent-solid">
                <KeysIcon className="h-3.5 w-3.5" />
            </Badge>
            {m.ghost_verdict_won({ margin })}
        </Card>
    ) : (
        <Card tone="border-ghost-line bg-ghost-surface text-ghost-text">
            <Badge fill="bg-ghost">
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
