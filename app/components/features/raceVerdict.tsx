// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ReactNode } from "react";
import { formatRaceMargin, type RaceVerdict as Verdict } from "../../../core/ghost";
import { m } from "../../paraglide/messages.js";
import { getLocale } from "../../paraglide/runtime.js";
import { FolioRow } from "../ui/folio";
import { GhostIcon, KeysIcon } from "../ui/icons";

// The head-to-head payoff shown with the grade when a raced run finishes: who crossed the
// line first and by how much. A win wears your indigo and the keys; a loss wears the
// ghost's fuchsia; a dead heat stays neutral — the same colour language as the race strip
// so the result reads as the end of that same duel. A Folio row: the badge in the margin,
// the verdict as its name, in the verdict's colour.
export function RaceVerdict({ verdict }: { verdict: Verdict }) {
    const margin = formatRaceMargin(verdict.marginMs, getLocale());

    if (verdict.outcome === "tie") {
        return (
            <Row
                badge={
                    <Badge fill="bg-key-spent">
                        <KeysIcon className="h-5 w-5" />
                    </Badge>
                }
                ink="text-body"
            >
                {m.ghost_verdict_tie()}
            </Row>
        );
    }

    return verdict.outcome === "won" ? (
        <Row
            badge={
                <Badge fill="bg-accent-solid">
                    <KeysIcon className="h-5 w-5" />
                </Badge>
            }
            ink="text-success"
        >
            {m.ghost_verdict_won({ margin })}
        </Row>
    ) : (
        <Row
            badge={
                <Badge fill="bg-ghost">
                    <GhostIcon className="h-5 w-5" />
                </Badge>
            }
            ink="text-ghost-text"
        >
            {m.ghost_verdict_lost({ margin })}
        </Row>
    );
}

function Row({ badge, ink, children }: { badge: ReactNode; ink: string; children: ReactNode }) {
    return <FolioRow margin={badge} name={<span className={ink}>{children}</span>} />;
}

function Badge({ fill, children }: { fill: string; children: ReactNode }) {
    return (
        <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white ${fill}`}
        >
            {children}
        </span>
    );
}
