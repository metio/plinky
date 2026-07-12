// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { ReactNode } from "react";
import type { Assignment } from "../../../core/assignment";
import type { trackSteps } from "../../../core/tracks";
import { m } from "../../paraglide/messages.js";
import { Button } from "../ui/button";
import { CheckIcon } from "../ui/icons";
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
}: {
    steps: AssignmentSteps;
    titleOf: (id: string) => string;
    isMissing: (id: string) => boolean;
}) {
    return (
        <ol className="space-y-1">
            {steps.map((step, index) => (
                <li key={step.scoreId} className="flex items-center gap-2">
                    <span
                        aria-hidden="true"
                        className={`${STEP_MARK} ${
                            step.status === "done"
                                ? "bg-green-600 text-white"
                                : step.status === "current"
                                  ? "bg-indigo-600 text-white"
                                  : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                        }`}
                    >
                        {step.status === "done" ? <CheckIcon className="h-4 w-4" /> : index + 1}
                    </span>
                    {isMissing(step.scoreId) ? (
                        <span className="italic text-gray-400 dark:text-gray-500">
                            {m.assignments_step_missing()}
                        </span>
                    ) : (
                        <Link
                            to={`/play/${step.scoreId}`}
                            className={
                                step.status === "current"
                                    ? "font-medium text-indigo-700 dark:text-indigo-300"
                                    : "text-gray-700 hover:underline dark:text-gray-300"
                            }
                        >
                            {titleOf(step.scoreId)}
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
    return (
        <li className="space-y-2 rounded-md border border-gray-200 px-3 py-2 text-sm dark:border-gray-800">
            <div className="flex flex-wrap items-center gap-2">
                <span className="flex-1">
                    <span className="font-medium">{assignment.name}</span>{" "}
                    <span className="tabular-nums text-gray-500 dark:text-gray-400">
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
            {/* Descriptions are real instructions, often several sentences with
                line breaks — give them their space instead of clamping. */}
            {description && (
                <p className="max-w-prose whitespace-pre-line text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                    {description}
                </p>
            )}
            {children}
        </li>
    );
}
