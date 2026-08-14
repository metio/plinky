// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ReactNode } from "react";
import type { Assignment } from "../../../core/assignment";
import { todayKey } from "../../../core/daily";
import { deadlineFor } from "../../../core/repertoire";
import type { trackSteps } from "../../../core/tracks";
import { m } from "../../paraglide/messages.js";
import { Button } from "../ui/button";
import { CheckIcon } from "../ui/icons";
import { BakedIncipit } from "../ui/incipit";
import { LocalizedLink as Link } from "../ui/localizedLink";

export type AssignmentSteps = ReturnType<typeof trackSteps>;

const STEP_MARK =
    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold";

// The numbered step list an assignment renders — shared by the built-in sets and
// the player's own. A dead id gets a labelled placeholder instead of a link into
// the play page's "not on this device" dead end.
export function AssignmentStepList({
    steps,
    titleOf,
    isMissing,
    incipitOf,
}: {
    steps: AssignmentSteps;
    titleOf: (id: string) => string;
    isMissing: (id: string) => boolean;
    // A step's opening bars, where the catalogue carries them. An ordered set of pieces
    // is where the mark earns most: a list of titles somebody else chose tells you
    // nothing about the music until you open each one.
    incipitOf?: (id: string) => string | undefined;
}) {
    return (
        <ol className="space-y-1">
            {steps.map((step, index) => (
                <li key={step.scoreId} className="flex items-center gap-2">
                    <span
                        aria-hidden="true"
                        className={`${STEP_MARK} ${
                            step.status === "done"
                                ? "bg-success-solid text-white"
                                : step.status === "current"
                                  ? "bg-accent-solid text-white"
                                  : "bg-subtle-strong text-muted"
                        }`}
                    >
                        {step.status === "done" ? <CheckIcon className="h-4 w-4" /> : index + 1}
                    </span>
                    {isMissing(step.scoreId) ? (
                        <span className="italic text-faint">{m.assignments_step_missing()}</span>
                    ) : (
                        <Link
                            to={`/play/${step.scoreId}`}
                            // Every step opens its piece, not only the one you are on, and
                            // a row of plain text does not say so on a screen with no
                            // hover. The same tinted row the library uses marks them as
                            // things you can press.
                            className={`flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 hover:bg-subtle ${
                                step.status === "current"
                                    ? "font-medium text-accent-strong"
                                    : "text-body"
                            }`}
                        >
                            <BakedIncipit
                                mark={incipitOf?.(step.scoreId)}
                                label={titleOf(step.scoreId)}
                                className="shrink-0 text-faint"
                            />
                            <span className="min-w-0 truncate">{titleOf(step.scoreId)}</span>
                        </Link>
                    )}
                </li>
            ))}
        </ol>
    );
}

// One assignment in a list: name + progress, the Share/Download pair, and the
// step list. Extra buttons slot in before Share (`actionsBefore`) and after
// Download (`actionsAfter`); the children are the rendered steps.
export function AssignmentCard({
    assignment,
    steps,
    copiedShare,
    onShare,
    onDownload,
    actionsBefore,
    actionsAfter,
    description,
    children,
}: {
    assignment: Assignment;
    steps: AssignmentSteps;
    copiedShare: string | null;
    onShare: (assignment: Assignment, key: string) => void;
    onDownload: (assignment: Assignment) => void;
    actionsBefore?: ReactNode;
    actionsAfter?: ReactNode;
    description?: string;
    children: ReactNode;
}) {
    const doneCount = steps.filter((step) => step.status === "done").length;
    // How the set stands against the day it is due, when it has one. A programme with
    // a date is the one case where "how much is left" and "how long is left" belong
    // side by side; a set with no date reports neither and reads exactly as before.
    const due = assignment.dueOn ? deadlineFor(assignment.dueOn, todayKey(new Date())) : null;
    return (
        <li className="space-y-2 rounded-md border border-line px-3 py-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
                <span className="flex-1">
                    <span className="font-medium">{assignment.name}</span>{" "}
                    <span className="tabular-nums text-muted">
                        {doneCount}/{steps.length}
                    </span>
                </span>
                {actionsBefore}
                <Button variant="secondary" onClick={() => onShare(assignment, assignment.id)}>
                    {copiedShare === assignment.id ? m.share_copied() : m.assignments_share()}
                </Button>
                <Button variant="secondary" onClick={() => onDownload(assignment)}>
                    {m.assignments_download()}
                </Button>
                {actionsAfter}
            </div>
            {due && (
                <p className="text-xs text-muted">
                    {due.passed
                        ? m.repertoire_date_passed({ date: due.date })
                        : m.repertoire_days_left({ date: due.date, count: due.daysLeft })}
                    {doneCount < steps.length &&
                        ` · ${m.assignments_left({ count: steps.length - doneCount })}`}
                </p>
            )}
            {/* Descriptions are real instructions, often several sentences with
                line breaks — give them their space instead of clamping. */}
            {description && (
                <p className="max-w-prose whitespace-pre-line text-sm leading-relaxed text-muted">
                    {description}
                </p>
            )}
            {children}
        </li>
    );
}
