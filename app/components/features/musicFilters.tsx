// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ReactNode } from "react";
import type { MusicKind } from "../../../core/music";
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
            <span className="min-w-12 shrink-0 text-xs font-medium uppercase tracking-wide text-muted">
                {label}
            </span>
            {children}
        </div>
    );
}

type LibraryFiltersProps = {
    kind: MusicKind | "";
    onKind: (kind: MusicKind | "") => void;
    grades: ReadonlySet<number>;
    onToggleGrade: (grade: number) => void;
    onClearGrades: () => void;
    favoritesOnly: boolean;
    onToggleFavoritesOnly: () => void;
    dueOnly: boolean;
    freshOnly: boolean;
    onToggleFreshOnly: () => void;
    onToggleDueOnly: () => void;
    // The Due chip only appears while something is actually due.
    showDue: boolean;
};

// The library's filter bar: three labelled groups so the chips read as
// Kind / Grade / Show rather than one undifferentiated wall, and the toggles
// (Show) sit apart from the single-select Kind and multi-select Grade.
export function MusicFilters({
    kind,
    onKind,
    grades,
    onToggleGrade,
    onClearGrades,
    favoritesOnly,
    onToggleFavoritesOnly,
    dueOnly,
    freshOnly,
    onToggleFreshOnly,
    onToggleDueOnly,
    showDue,
}: LibraryFiltersProps) {
    return (
        <>
            <FilterGroup label={m.music_group_kind()}>
                <Chip selected={kind === ""} onClick={() => onKind("")}>
                    {m.scores_filter_all()}
                </Chip>
                {(
                    [
                        ["song", m.music_kind_songs()],
                        ["scale-arpeggio", m.music_kind_scales()],
                        ["study", m.music_kind_studies()],
                    ] as [MusicKind, string][]
                ).map(([value, label]) => (
                    <Chip key={value} selected={kind === value} onClick={() => onKind(value)}>
                        {label}
                    </Chip>
                ))}
            </FilterGroup>

            <FilterGroup label={m.music_group_grade()}>
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

            <FilterGroup label={m.music_group_show()}>
                <Chip
                    selected={favoritesOnly}
                    aria-pressed={favoritesOnly}
                    onClick={onToggleFavoritesOnly}
                >
                    {m.scores_filter_favorites()}
                </Chip>
                {/* What is left to discover — the mastery record already knows which
                    pieces have no history at all. Unlike "due", it is worth offering from
                    the first visit: on a fresh device it simply matches everything. */}
                <Chip selected={freshOnly} aria-pressed={freshOnly} onClick={onToggleFreshOnly}>
                    {m.music_filter_fresh()}
                </Chip>
                <Show when={showDue}>
                    <Chip selected={dueOnly} aria-pressed={dueOnly} onClick={onToggleDueOnly}>
                        {m.music_filter_due()}
                    </Chip>
                </Show>
            </FilterGroup>
        </>
    );
}
