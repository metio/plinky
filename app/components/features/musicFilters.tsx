// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ReactNode } from "react";
import type { MusicKind } from "../../../core/music";
import { MAX_GRADE } from "../../../core/scoreDifficulty";
import { m } from "../../paraglide/messages.js";
import { Chip } from "../ui/chip";
import { Show } from "./conditional";

// One filter axis: its name, then its chips on a single line that scrolls sideways when
// there are more of them than fit.
//
// The name is a real grid column rather than the first item of a wrapping row. Wrapped
// rows used to start back at the page margin, underneath the name, so the name stopped
// reading as a heading for anything but the first row — the group came apart exactly when
// it got big enough to need holding together.
//
// One line per axis is what keeps the music in view: three wrapping groups cost about 350
// pixels on a phone, which is most of a screen spent on chrome before the first piece.
// Scrolling the chips instead of wrapping them costs a fixed 44 per axis.
//
// The chips scroll, never the page — the container is what overflows, so nothing here can
// make the document itself scroll sideways. A chip cut off at the edge is the affordance
// that says there are more; that is why nothing masks or fades it away.
function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
    return (
        // Named for assistive technology as well as drawn: the visual grouping the name
        // provides is otherwise available only to people who can see the columns.
        // A fieldset because that is what a set of related controls is. min-w-0 because a
        // fieldset defaults to min-width:min-content, which would refuse to shrink and
        // push the page wider than the screen — the one thing the scroll container exists
        // to prevent.
        <fieldset
            aria-label={label}
            className="grid min-w-0 grid-cols-[auto_1fr] items-center gap-x-3"
        >
            <span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
            {/* min-w-0 or the track refuses to shrink below its content and pushes the
                page wide. The padding is for the focus ring: the chips carry no ring of
                their own, so focus is the browser's own outline, drawn OUTSIDE the button
                box — without room inside the scroll container it is clipped, and a
                keyboard user loses their place. The negative margin gives that room back
                so the first chip still lines up with the ones above it. */}
            {/* whitespace-nowrap and shrink-0 together are what make the row a row: without
                them flex squeezes the chips and their labels wrap onto a second line, so a
                long one like "Scales & arpeggios" silently costs the height the single line
                was there to save. */}
            <div className="-mx-1 flex min-w-0 gap-2 overflow-x-auto whitespace-nowrap px-1 py-1 [&>*]:shrink-0">
                {children}
            </div>
        </fieldset>
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
        // A single element, not a fragment. As three loose children they inherited the
        // page's own eight-unit rhythm — the gap that separates a page's sections — so the
        // three axes of one control sat as far apart as the header sits from the tabs.
        <div className="space-y-2">
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
        </div>
    );
}
