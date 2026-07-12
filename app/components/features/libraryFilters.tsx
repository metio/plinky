// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { ReactNode } from "react";
import type { LibraryKind } from "../../../core/library";
import { MAX_GRADE } from "../../../core/scoreDifficulty";
import { m } from "../../paraglide/messages.js";
import { Chip } from "../ui/chip";
import { Show } from "./conditional";

// A labelled row of filter chips, so the three filter axes (Kind / Grade / Show) read
// as distinct groups rather than one flat wall of pills.
function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            {/* A minimum, not a fixed, width: the label column aligns across the
                groups for short labels but grows for a longer translation (e.g.
                German "Anzeigen") instead of overflowing into the first chip. */}
            <span className="min-w-12 shrink-0 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {label}
            </span>
            {children}
        </div>
    );
}

type LibraryFiltersProps = {
    kind: LibraryKind | "";
    onKind: (kind: LibraryKind | "") => void;
    grades: ReadonlySet<number>;
    onToggleGrade: (grade: number) => void;
    onClearGrades: () => void;
    favoritesOnly: boolean;
    onToggleFavoritesOnly: () => void;
    dueOnly: boolean;
    onToggleDueOnly: () => void;
    // The Due chip only appears while something is actually due.
    showDue: boolean;
};

// The library's filter bar: three labelled groups so the chips read as
// Kind / Grade / Show rather than one undifferentiated wall, and the toggles
// (Show) sit apart from the single-select Kind and multi-select Grade.
export function LibraryFilters({
    kind,
    onKind,
    grades,
    onToggleGrade,
    onClearGrades,
    favoritesOnly,
    onToggleFavoritesOnly,
    dueOnly,
    onToggleDueOnly,
    showDue,
}: LibraryFiltersProps) {
    return (
        <>
            <FilterGroup label={m.library_group_kind()}>
                <Chip selected={kind === ""} onClick={() => onKind("")}>
                    {m.scores_filter_all()}
                </Chip>
                {(
                    [
                        ["song", m.library_kind_songs()],
                        ["scale-arpeggio", m.library_kind_scales()],
                        ["study", m.library_kind_studies()],
                    ] as [LibraryKind, string][]
                ).map(([value, label]) => (
                    <Chip key={value} selected={kind === value} onClick={() => onKind(value)}>
                        {label}
                    </Chip>
                ))}
            </FilterGroup>

            <FilterGroup label={m.library_group_grade()}>
                <Chip selected={grades.size === 0} onClick={onClearGrades}>
                    {m.scores_filter_all()}
                </Chip>
                {Array.from({ length: MAX_GRADE }, (_, i) => i + 1).map((grade) => (
                    <Chip
                        key={grade}
                        selected={grades.has(grade)}
                        aria-pressed={grades.has(grade)}
                        onClick={() => onToggleGrade(grade)}
                        aria-label={m.score_grade({ grade })}
                        className="tabular-nums"
                    >
                        {grade}
                    </Chip>
                ))}
            </FilterGroup>

            <FilterGroup label={m.library_group_show()}>
                <Chip
                    selected={favoritesOnly}
                    aria-pressed={favoritesOnly}
                    onClick={onToggleFavoritesOnly}
                >
                    {m.scores_filter_favorites()}
                </Chip>
                <Show when={showDue}>
                    <Chip selected={dueOnly} aria-pressed={dueOnly} onClick={onToggleDueOnly}>
                        {m.library_filter_due()}
                    </Chip>
                </Show>
            </FilterGroup>
        </>
    );
}
