// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ReactNode } from "react";
import { EarIcon, MetronomeIcon, NotesIcon } from "../ui/icons";
import { LocalizedLink as Link } from "../ui/localizedLink";
import { m } from "../../paraglide/messages.js";

// The day's own thing, across the width: the challenge everybody gets. `lead` is on while
// it is still unopened, which is the one reason to weigh a warm-up more than its
// neighbours — and the reason it is a button rather than one pill among four.
function LeadWay({ to, lead, children }: { to: string; lead: boolean; children: ReactNode }) {
    return (
        <Link
            to={to}
            className={`flex w-full items-center gap-2.5 rounded-xl border px-4 py-3 text-base font-semibold transition ${
                lead
                    ? "border-spark bg-spark-surface text-spark-strong hover:border-spark-strong"
                    : "border-line-strong bg-sunken text-ink hover:border-accent-line-strong hover:text-accent-strong"
            }`}
        >
            {children}
            <span aria-hidden="true" className="ml-auto text-sm font-medium opacity-70">
                →
            </span>
        </Link>
    );
}

// One of the three other ways in, each an equal third of the row.
//
// Thirds rather than pills, because four pills of four different widths, centred, have no
// shared edge to rest on: any wrap reads as debris rather than as a row, and on a phone
// they always wrap. Three fixed columns cannot.
function Way({
    to,
    Icon,
    label,
    note,
}: {
    to: string;
    Icon: (props: { className?: string }) => ReactNode;
    label: string;
    // What a reader wants to know before pressing it — the key the arcade is about to ask
    // for, what a drill drills. Optional: a way in that has nothing to add says nothing.
    note?: string;
}) {
    return (
        <Link
            to={to}
            className="flex flex-col items-center gap-1 rounded-xl border border-line bg-raised px-2 py-2.5 text-center transition hover:border-accent-line-strong hover:text-accent-strong"
        >
            <Icon className="h-5 w-5 text-accent" />
            <span className="text-xs font-semibold leading-tight text-ink">{label}</span>
            {note && <span className="text-[11px] leading-tight text-muted">{note}</span>}
        </Link>
    );
}

// The four ways to start a session, above the keyboard they all lead to.
//
// One lead and three thirds rather than four pills. Four pills of four different widths,
// centred, share no edge, so on a phone — where they always wrap — the row read as debris
// rather than as a set of choices. Three fixed columns cannot wrap at all.
//
// The same shape on every width. A lead button capped at the reading column with three
// beneath it is as true on a desktop as on a phone, and one layout is one thing to keep
// right.
export function WarmUpWays({
    daily,
    arcadeTo,
    arcadeKey,
}: {
    // The day's challenge. Absent while the day's tasks are still being worked out, which
    // is a moment rather than a state — the three other ways in stand alone meanwhile.
    daily?: { to: string; label: string; done: boolean };
    arcadeTo: string;
    // The key the ladder is about to ask for. It used to show the rung as a number, which
    // told a reader nothing: the ladder has no end, so seven is not seven of anything.
    arcadeKey: string;
}) {
    return (
        <div className="mx-auto max-w-md space-y-2">
            {daily && (
                <LeadWay to={daily.to} lead={!daily.done}>
                    {daily.label}
                </LeadWay>
            )}
            <div className="grid grid-cols-3 gap-2">
                <Way to={arcadeTo} Icon={NotesIcon} label={m.arcade_title()} note={arcadeKey} />
                <Way to="/daily?tab=warmup" Icon={MetronomeIcon} label={m.today_drill()} />
                <Way to="/ear" Icon={EarIcon} label={m.ear_title()} />
            </div>
        </div>
    );
}
