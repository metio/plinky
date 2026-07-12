// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { LibraryItem } from "../../../core/library";
import { canonicalComposer, personSlug } from "../../../core/person";
import { m } from "../../paraglide/messages.js";
import { IconButton } from "../ui/button";
import { ConfirmButton } from "../ui/confirmButton";
import { CheckIcon, ClockIcon, CloseIcon, StarIcon } from "../ui/icons";
import { LocalizedLink as Link } from "../ui/localizedLink";
import { GradeChip } from "./scoreGrade";

type LibraryRowProps = {
    item: LibraryItem;
    starred: boolean;
    learned: boolean;
    due: boolean;
    onToggleStar: () => void;
    // Present only for removable (user-imported) scores; the label names the
    // blast radius when saved assignments still reference the piece.
    onRemove?: () => void;
    removeConfirmLabel?: string;
};

// One library list row: star toggle, the piece card linking to its play page
// (with learned/due badges and a composer link), and — for user imports — the
// confirm-guarded remove control.
export function LibraryRow({
    item,
    starred,
    learned,
    due,
    onToggleStar,
    onRemove,
    removeConfirmLabel,
}: LibraryRowProps) {
    return (
        <li className="flex items-center gap-2">
            <IconButton
                variant="ghost"
                onClick={onToggleStar}
                aria-pressed={starred}
                label={starred ? m.scores_unfavorite() : m.scores_favorite()}
                className={starred ? "text-amber-500 dark:text-amber-400" : "text-gray-400"}
            >
                <StarIcon className="h-5 w-5" filled={starred} />
            </IconButton>
            {/* min-w-0 lets this flex child shrink below its content so a long title
                truncates instead of pushing the row — and the whole page — wider than
                the viewport (which would clip the fixed bottom nav). The title link
                stretches over the whole card (after:inset-0); the composer link stacks
                above the stretch (z-10) so it opens the person page instead. */}
            <div className="relative flex min-w-0 flex-1 items-center gap-2 rounded-md border border-gray-300 px-3 py-2 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
                <span className="min-w-0 flex-1">
                    <Link
                        to={`/play/${item.id}`}
                        className="block truncate font-medium after:absolute after:inset-0"
                    >
                        {item.title}
                        {learned && (
                            <span className="ml-1 inline-flex items-center text-green-600 dark:text-green-400">
                                <CheckIcon className="h-4 w-4" />
                                <span className="sr-only">{m.mastery_learned()}</span>
                            </span>
                        )}
                        {due && (
                            <span className="ml-1 inline-flex items-center text-amber-600 dark:text-amber-400">
                                <ClockIcon className="h-4 w-4" />
                                <span className="sr-only">{m.mastery_due()}</span>
                            </span>
                        )}
                    </Link>
                    {item.composer &&
                        (personSlug(item.composer) ? (
                            <Link
                                to={`/person/${personSlug(item.composer)}`}
                                className="relative z-10 block w-fit max-w-full truncate text-xs text-gray-600 hover:text-indigo-600 hover:underline dark:text-gray-400 dark:hover:text-indigo-400"
                            >
                                {canonicalComposer(item.composer)}
                            </Link>
                        ) : (
                            <span className="block truncate text-xs text-gray-600 dark:text-gray-400">
                                {item.composer}
                            </span>
                        ))}
                </span>
                <GradeChip grade={item.grade} />
            </div>
            {onRemove && (
                <ConfirmButton
                    variant="ghost"
                    onConfirm={onRemove}
                    confirmLabel={removeConfirmLabel ?? m.action_remove_confirm()}
                    label={m.action_remove()}
                    className="text-red-600 dark:text-red-400"
                >
                    <CloseIcon className="h-5 w-5" />
                </ConfirmButton>
            )}
        </li>
    );
}
