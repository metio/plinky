// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { type ReactNode, useId, useState } from "react";
import type { MusicKind } from "../../../core/music";
import {
    activeFilterCount,
    filterSummaryParts,
    type MusicFilterState,
} from "../../../core/musicFilterSummary";
import { MAX_GRADE } from "../../../core/scoreDifficulty";
import { m } from "../../paraglide/messages.js";
import { Chip } from "../ui/chip";
import { Show } from "./conditional";

// One filter axis: its name above its chips, which wrap freely.
//
// They wrap rather than scroll sideways because on a phone this whole block is behind the
// summary line below, and the room a phone does not have while browsing is room it does
// have once you have asked to filter. A sideways track saved the height but hid grades 5
// to 8 off the right edge with nothing saying they were there, which is a worse bargain
// than the one it replaced.
function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
    return (
        // Named for assistive technology as well as drawn: the visual grouping the name
        // provides is otherwise available only to people who can see the columns.
        // A fieldset because that is what a set of related controls is. min-w-0 because a
        // fieldset defaults to min-width:min-content, which would refuse to shrink and
        // push the page wider than the screen — the one thing the scroll container exists
        // to prevent.
        <fieldset aria-label={label} className="min-w-0">
            <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted">
                {label}
            </span>
            {/* The padding is for the focus ring: the chips carry no ring of their own, so
                focus is the browser's own outline, drawn OUTSIDE the button box. The
                negative margin gives the room back so the first chip still lines up with
                the heading above it. */}
            <div className="-mx-1 flex flex-wrap gap-2 px-1 py-1">{children}</div>
        </fieldset>
    );
}

// One place a kind is named, read by the chips and by the summary line — two lists would
// drift, and the summary is the copy nobody looks at until it is wrong.
const KIND_LABELS: Record<MusicKind, () => string> = {
    song: m.music_kind_songs,
    "scale-arpeggio": m.music_kind_scales,
    study: m.music_kind_studies,
};

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

// The library's filter bar: three labelled groups so the chips read as Kind / Grade / Show
// rather than one undifferentiated wall, and the toggles (Show) sit apart from the
// single-select Kind and multi-select Grade.
//
// The three groups fold behind one line that reads back what is currently filtering the
// list — "Songs · Grades 3, 4 · ★ Favourites". The question somebody has in front of a
// short list is "why am I only seeing these?", and a row of controls answers it only if you
// already know how to read it; a sentence answers it to anyone. Folded is the default at
// every width, not only where the room runs out: on a wide screen the three open groups
// pushed the first piece most of a fold down to show controls almost nobody was about to
// touch, and a library page is for looking at music.
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
    const [open, setOpen] = useState(false);
    const panelId = useId();
    const state: MusicFilterState = { kind, grades, favoritesOnly, freshOnly, dueOnly };
    const count = activeFilterCount(state);
    const parts = filterSummaryParts(state, {
        kind: (value) => KIND_LABELS[value](),
        // One grade reads as "Grade 4"; several need their own phrasing, which is why the
        // list arrives whole rather than pre-joined.
        grades: (list) => {
            const [only] = list;
            return list.length === 1 && only !== undefined
                ? m.score_grade({ grade: only })
                : m.music_filters_grades({ list: list.join(", ") });
        },
        favorites: m.scores_filter_favorites(),
        fresh: m.music_filter_fresh(),
        due: m.music_filter_due(),
    });

    return (
        // A single element, not a fragment. As three loose children they inherited the
        // page's own eight-unit rhythm — the gap that separates a page's sections — so the
        // three axes of one control sat as far apart as the header sits from the tabs.
        <div className="space-y-2">
            {/* The summary IS the button, so its accessible name is the sentence it shows
                and a screen reader hears the current state on reaching the control rather
                than the word "Filters". */}
            <button
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpen((was) => !was)}
                className="flex w-full items-center gap-2 rounded-xl border border-line-strong bg-raised px-3 py-2.5 text-left text-sm text-ink"
            >
                <span className="min-w-0 flex-1 truncate">
                    {parts.length === 0 ? m.music_filters_none() : parts.join(" · ")}
                </span>
                <Show when={count > 0}>
                    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-accent-solid px-1.5 text-xs font-bold tabular-nums text-white">
                        {count}
                    </span>
                </Show>
                <span aria-hidden="true" className={`text-muted ${open ? "rotate-180" : ""}`}>
                    ⌄
                </span>
            </button>
            {/* Boxed, so the opened groups read as the inside of the line that opened
                them rather than as loose controls that happen to sit below it. */}
            <div
                id={panelId}
                className={`space-y-3 rounded-xl border border-line bg-raised p-3 ${
                    open ? "" : "hidden"
                }`}
            >
                <FilterGroup label={m.music_group_kind()}>
                    <Chip selected={kind === ""} onClick={() => onKind("")}>
                        {m.scores_filter_all()}
                    </Chip>
                    {(Object.keys(KIND_LABELS) as MusicKind[]).map((value) => (
                        <Chip key={value} selected={kind === value} onClick={() => onKind(value)}>
                            {KIND_LABELS[value]()}
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
            </div>
        </div>
    );
}
