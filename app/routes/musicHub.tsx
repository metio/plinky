// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { useParams } from "react-router";
import { BakedIncipit } from "../components/ui/incipit";
import { GradeChip } from "../components/features/scoreGrade";
import { LocalizedLink as Link } from "../components/ui/localizedLink";
import { PageHeader } from "../components/ui/pageHeader";
import { sectionHeadingClasses } from "../components/ui/classes";
import {
    ERAS,
    type Era,
    HUB_GRADES,
    type HubGrade,
    erasOf,
    hubCollection,
    hubEra,
    hubGrade,
    piecesOfCollection,
    piecesOfEra,
    piecesOfGrade,
} from "../../core/musicHubs";
import { breadcrumbData, collectionData } from "../../core/site";
import { useAsyncEffect } from "../hooks/useAsyncEffect";
import { useDocumentHead } from "../hooks/useDocumentHead";
import { usePrefs } from "../hooks/usePrefs";
import { useStructuredData } from "../hooks/useStructuredData";
import { useExerciseSource, usePeopleSource, useSongSource } from "../contexts/services";
import { m } from "../paraglide/messages.js";
import { getLocale } from "../paraglide/runtime.js";

// A shelf of the catalogue: one grade, or one era.
//
// Two routes share this page because the two shelves differ only in which pieces they
// hold. Which one is being read is the parameter that is present — the route table names
// them, so nothing here has to guess.

type Shelf =
    | { facet: "grade"; grade: HubGrade }
    | { facet: "era"; era: Era }
    // A work carries its own name rather than a slug, because the name is a proper noun
    // the catalogue owns and the page has nothing of its own to call it by. Null until the
    // catalogue says what it is.
    | { facet: "collection"; collection: string; name: string | null };

// The shelf an address names, or nothing at all. An unknown grade or era is a real 404
// rather than an empty page: a shelf that never existed should not answer, or a search
// index learns that every address on the site returns something.
export function shelfFor(
    params: { grade?: string; era?: string; collection?: string },
    works: { id: string; name: string }[] = [],
): Shelf | null {
    if (params.grade !== undefined) {
        const grade = hubGrade(params.grade);
        return grade === null ? null : { facet: "grade", grade };
    }
    if (params.era !== undefined) {
        const era = hubEra(params.era);
        return era === null ? null : { facet: "era", era };
    }
    if (params.collection !== undefined) {
        // The set of works is catalogue data, so until it is fetched the page cannot say
        // whether an address names one. It shows the address's own slug meanwhile rather
        // than an error (see shelfHeading), and the name arrives with the list.
        const found = works.find((work) => work.id === params.collection);
        const id = hubCollection(
            params.collection,
            works.map((work) => work.id),
        );
        if (works.length > 0 && id === null) {
            return null;
        }
        return {
            facet: "collection",
            collection: params.collection,
            name: found?.name ?? null,
        };
    }
    return null;
}

// The shelf's own address, its title, its heading, and the line under it.
//
// The title and the line are null while a work's name is unknown, and a null leaves the
// head alone: the edge served this page's document already carrying the work's name, so
// writing anything before the name arrives — or when the fetch for it fails — would only
// replace the right title with a worse one.
export function shelfTitle(shelf: Shelf): string | null {
    if (shelf.facet === "collection") {
        return shelf.name;
    }
    if (shelf.facet === "grade") {
        return m.hub_grade_title({ grade: shelf.grade });
    }
    return {
        baroque: m.hub_era_title_baroque(),
        classical: m.hub_era_title_classical(),
        romantic: m.hub_era_title_romantic(),
        modern: m.hub_era_title_modern(),
    }[shelf.era];
}

// What the page is headed with, which is never blank: a work whose name has not arrived
// is headed with its address, the one thing the page knows it by.
export function shelfHeading(shelf: Shelf): string {
    return shelfTitle(shelf) ?? (shelf.facet === "collection" ? shelf.collection : "");
}

export function shelfIntro(shelf: Shelf): string | null {
    if (shelf.facet === "collection") {
        return shelf.name === null ? null : m.hub_collection_intro({ name: shelf.name });
    }
    return shelf.facet === "grade" ? m.hub_grade_intro({ grade: shelf.grade }) : m.hub_era_intro();
}

export function shelfPath(shelf: Shelf): string {
    if (shelf.facet === "collection") {
        return `/music/collection/${shelf.collection}/`;
    }
    return shelf.facet === "grade" ? `/music/grade/${shelf.grade}/` : `/music/era/${shelf.era}/`;
}

// No meta() and no structured data from it. The edge writes this page's document
// (functions/_middleware.js), and a title React renders over one already there is written
// twice unless it matches exactly; the page writes its own head below, once it knows
// which shelf it is.

type Piece = { id: string; title: string; composer: string; grade?: number; incipit?: string };

// The named works, fetched once and shared by everything that lists them.
function useNamedWorks(): { id: string; name: string }[] {
    const songs = useSongSource();
    const [works, setWorks] = useState<{ id: string; name: string }[]>([]);
    useAsyncEffect(
        (alive) => {
            songs.builtins().then((found) => {
                if (alive() && found) {
                    setWorks(found.map((work) => ({ id: work.id, name: work.name })));
                }
            });
        },
        [songs.builtins],
    );
    return works;
}

export default function MusicHubRoute() {
    const params = useParams();
    // The two parameters as plain strings, because the shelf they describe is rebuilt on
    // every render and an effect keyed on the object would run on every render with it.
    const gradeParam = params.grade;
    const eraParam = params.era;
    const collectionParam = params.collection;
    const songs = useSongSource();
    const exercises = useExerciseSource();
    const people = usePeopleSource();
    const { prefs } = usePrefs();
    const locale = getLocale();
    const [pieces, setPieces] = useState<Piece[] | null>(null);
    // The shelf's own title, when the address names a work: its name is catalogue data.
    const works = useNamedWorks();
    const shelf = shelfFor(params, works);

    useAsyncEffect(
        (alive) => {
            setPieces(null);
            const facet =
                gradeParam !== undefined ? "grade" : eraParam !== undefined ? "era" : "collection";
            (async () => {
                // Each shelf costs only the data it needs: a composer's dates for an era,
                // the set's own piece list for a work, neither for a grade.
                const [manifest, studies, described, builtins] = await Promise.all([
                    songs.manifest(),
                    exercises.manifest(),
                    facet === "era" ? people.about(locale) : Promise.resolve(null),
                    facet === "collection" ? songs.builtins() : Promise.resolve(null),
                ]);
                if (!alive()) {
                    return;
                }
                const all: Piece[] = [
                    ...(manifest ?? []),
                    ...(studies ?? []).map((study) => ({
                        ...study,
                        composer: study.composer ?? "",
                    })),
                ];
                if (facet === "grade") {
                    const grade = hubGrade(gradeParam ?? "");
                    setPieces(grade === null ? [] : piecesOfGrade(all, grade));
                    return;
                }
                if (facet === "era") {
                    const era = hubEra(eraParam ?? "");
                    setPieces(era === null ? [] : piecesOfEra(all, era, erasOf(described ?? {})));
                    return;
                }
                const work = (builtins ?? []).find((one) => one.id === collectionParam);
                setPieces(work ? piecesOfCollection(all, work.items) : []);
            })();
        },
        [
            songs.manifest,
            songs.builtins,
            exercises.manifest,
            people.about,
            locale,
            gradeParam,
            eraParam,
            collectionParam,
        ],
    );

    const title = shelf ? shelfTitle(shelf) : null;
    const intro = shelf ? shelfIntro(shelf) : null;
    useDocumentHead(title, intro);
    useStructuredData(
        "CollectionPage",
        shelf && title && pieces
            ? collectionData(locale, shelfPath(shelf), title, intro ?? "", pieces)
            : null,
    );
    useStructuredData(
        "BreadcrumbList",
        shelf && title
            ? breadcrumbData(locale, [
                  { name: m.nav_today(), path: "/" },
                  { name: m.music_title(), path: "/music/" },
                  { name: title, path: shelfPath(shelf) },
              ])
            : null,
    );

    if (!shelf) {
        return (
            <main className="mx-auto max-w-3xl space-y-8 p-6 font-sans">
                <PageHeader title={m.music_title()} hint={m.hub_empty()} />
                <Link to="/music" className="font-medium text-accent-strong hover:underline">
                    {m.hub_all_music()}
                </Link>
            </main>
        );
    }

    return (
        <main className="mx-auto max-w-3xl space-y-8 p-6 font-sans">
            <PageHeader
                eyebrow={m.hub_eyebrow()}
                title={shelfHeading(shelf)}
                hint={intro ?? undefined}
            />

            {pieces && pieces.length > 0 ? (
                <>
                    <p className="text-sm text-muted">
                        {m.person_pieces({ count: pieces.length })}
                    </p>
                    <ul className="space-y-1.5">
                        {pieces.map((piece) => (
                            <li key={piece.id}>
                                <Link
                                    to={`/play/${piece.id}`}
                                    className="flex items-center justify-between gap-3 rounded-md border border-line px-3 py-2 text-sm hover:border-accent-line-strong hover:bg-accent-surface/50 dark:hover:bg-accent-surface/30"
                                >
                                    <BakedIncipit
                                        mark={piece.incipit}
                                        label={piece.title}
                                        colored={prefs.colorNotes}
                                        className="shrink-0 text-faint"
                                    />
                                    <span className="min-w-0 flex-1 truncate font-medium">
                                        {piece.title}
                                    </span>
                                    {/* The composer, because a shelf gathers many of them
                                        — which is the difference between this list and a
                                        composer's own. */}
                                    <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
                                        <span className="hidden max-w-40 truncate sm:inline">
                                            {piece.composer}
                                        </span>
                                        {piece.grade !== undefined && (
                                            <GradeChip grade={piece.grade} />
                                        )}
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </>
            ) : (
                pieces !== null && <p className="text-sm text-muted">{m.hub_empty()}</p>
            )}

            <HubLinks here={shelf} />
        </main>
    );
}

// Every other shelf, from every shelf. A hub whose only way out is back to the catalogue
// is a dead end for a reader and a leaf for a crawler; linked to each other they are one
// browsable surface, and the grade somebody landed on is one tap from the grade below it.
export function HubLinks({ here }: { here?: Shelf }) {
    // The named works are catalogue data, so this reads them itself rather than being
    // handed them: the same list belongs at the foot of every shelf and of the Music page,
    // and the song source answers the second caller from the first one's fetch.
    const works = useNamedWorks();
    const chip =
        "rounded-full border border-line px-3 py-1 text-sm hover:border-accent-line-strong hover:bg-accent-surface/50 dark:hover:bg-accent-surface/30";
    const current = "border-accent-line-strong bg-accent-surface/50 font-medium";
    const isHere = (shelf: Shelf) =>
        here !== undefined && here.facet === shelf.facet && shelfPath(here) === shelfPath(shelf);
    return (
        <nav className="space-y-4">
            <div className="space-y-2">
                <h2 className={sectionHeadingClasses}>{m.hub_by_grade()}</h2>
                <ul className="flex flex-wrap gap-2">
                    {HUB_GRADES.map((grade) => {
                        const shelf: Shelf = { facet: "grade", grade };
                        return (
                            <li key={grade}>
                                {/* The address written out rather than built by
                                    shelfPath, which is the same string: the navigation
                                    gate reads these links out of the source, and a page
                                    it cannot see a link to counts as unreachable. */}
                                <Link
                                    to={`/music/grade/${grade}/`}
                                    className={`${chip} ${isHere(shelf) ? current : ""}`}
                                >
                                    {m.score_grade({ grade })}
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </div>
            <div className="space-y-2">
                <h2 className={sectionHeadingClasses}>{m.hub_by_era()}</h2>
                <ul className="flex flex-wrap gap-2">
                    {ERAS.map((era) => {
                        const shelf: Shelf = { facet: "era", era };
                        return (
                            <li key={era}>
                                <Link
                                    to={`/music/era/${era}/`}
                                    className={`${chip} ${isHere(shelf) ? current : ""}`}
                                >
                                    {shelfTitle(shelf)}
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </div>
            {works.length > 0 && (
                <div className="space-y-2">
                    <h2 className={sectionHeadingClasses}>{m.hub_by_collection()}</h2>
                    <ul className="flex flex-wrap gap-2">
                        {works.map((work) => (
                            <li key={work.id}>
                                <Link
                                    to={`/music/collection/${work.id}/`}
                                    className={`${chip} ${
                                        here?.facet === "collection" && here.collection === work.id
                                            ? current
                                            : ""
                                    }`}
                                >
                                    {work.name}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </nav>
    );
}
