// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useSyncExternalStore } from "react";
import type { LoggedError } from "../../../core/errorLog";
import { useErrorLogStore } from "../../contexts/services";
import { issueUrl, REPO_ISSUES } from "../../lib/errorReport";
import { m } from "../../paraglide/messages.js";
import { buttonClasses } from "../ui/button";
import { ConfirmButton } from "../ui/confirmButton";
import { QuestionIcon } from "../ui/icons";
import { SettingsSection } from "../ui/settingsSection";

// The faults this device has hit that no boundary caught.
//
// A crash during render shows the reader a fallback with a report link at the moment it
// happens. Everything else — a promise nobody caught, a throw from a timer — leaves no
// trace on screen at all, and the reader is left with a feature that quietly does
// nothing. This is where those surface, with the same one-press report the crash page
// offers, so noticing and reporting are one step apart rather than impossible.
//
// Absent entirely when nothing has gone wrong, which is the ordinary case: a permanent
// "Problems (0)" heading in Settings invites worry and answers nothing.
export function RecentProblems() {
    const store = useErrorLogStore();
    const faults = useSyncExternalStore(store.subscribe, store.load, () => EMPTY);

    if (faults.length === 0) {
        return null;
    }
    return (
        <SettingsSection
            title={m.problems_title()}
            hint={m.problems_hint()}
            icon={<QuestionIcon />}
            tone="danger"
        >
            <ul className="space-y-3">
                {faults.map((fault) => (
                    <Fault key={`${fault.where}:${fault.message}`} fault={fault} />
                ))}
            </ul>
            <ConfirmButton
                variant="secondary"
                confirmLabel={m.problems_clear_confirm()}
                onConfirm={() => store.clear()}
            >
                {m.problems_clear()}
            </ConfirmButton>
        </SettingsSection>
    );
}

// A stable empty log for the server render: useSyncExternalStore compares snapshots by
// identity, and a fresh [] every call would loop.
const EMPTY: LoggedError[] = [];

function Fault({ fault }: { fault: LoggedError }) {
    // The reader's own locale and zone: a timestamp is only useful if they can place it
    // against when they were playing.
    const when = new Date(fault.at).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
    });
    return (
        <li className="space-y-1 rounded-md border border-line p-3">
            <p className="text-xs text-muted">
                {when} · {fault.where}
                {fault.count > 1 ? ` · ×${fault.count}` : ""}
            </p>
            <p className="break-words font-mono text-xs text-ink">{fault.message}</p>
            <a
                href={issueUrl(
                    REPO_ISSUES,
                    { notFound: false, technical: fault.message },
                    fault.where,
                    typeof navigator === "undefined" ? "" : navigator.userAgent,
                )}
                target="_blank"
                rel="noreferrer"
                className={buttonClasses("ghost")}
            >
                {m.action_report_problem()}
            </a>
        </li>
    );
}
