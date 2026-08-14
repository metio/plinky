// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { nameFromSlug, type Person, type PersonPiece, personFor } from "../../core/person";
import { BakedIncipit } from "../components/ui/incipit";
import { indexedPerson } from "../../core/peopleIndex";
import { breadcrumbData, personData, routeMeta } from "../../core/site";
import { loadBundledScores } from "../lib/catalog";
import { LocalizedLink as Link } from "../components/ui/localizedLink";
import { useSongSource } from "../contexts/services";
import { m } from "../paraglide/messages.js";
import { getLocale } from "../paraglide/runtime.js";
import type { Route } from "./+types/person";
import { PageHeader } from "../components/ui/pageHeader";
import { GradeChip } from "../components/features/scoreGrade";

// The bundled catalogue as person pieces — available synchronously (no storage,
// no network), so both meta() and the first render resolve the composer at
// prerender time. The user's own imports layer on top once the manifest loads.
function bundledPieces(): PersonPiece[] {
    return loadBundledScores().map((score) => ({
        id: score.id,
        title: score.title,
        composer: score.composer,
        ...(score.license ? { license: score.license } : {}),
    }));
}

// The composer a slug names, with no network and no manifest: the bundled pieces
// first (they carry their own titles, so the page has real content immediately), then
// the baked catalogue index, which knows every credited composer's canonical spelling
// but not their pieces. A prerendered page for a catalogue composer therefore ships
// with the right name and structured data in its static HTML, and fills its piece list
// in from the manifest on the client.
function knownPerson(slug: string): Person | null {
    const bundled = personFor(bundledPieces(), slug);
    if (bundled) {
        return bundled;
    }
    const indexed = indexedPerson(slug);
    return indexed ? { slug, name: indexed.name, pieces: [] } : null;
}

export function meta({ params }: Route.MetaArgs) {
    const slug = params.slug ?? "";
    // The bundled composer resolves at prerender, so a bundled composer's page
    // carries its real name, piece list, and structured data in the static HTML.
    const person = knownPerson(slug);
    const name = person?.name ?? nameFromSlug(slug);
    const tags: Record<string, unknown>[] = [
        ...routeMeta(name || m.person_eyebrow(), m.meta_person_description({ name })),
    ];
    if (person) {
        const locale = getLocale();
        tags.push({ "script:ld+json": personData(person, locale) });
        tags.push({
            "script:ld+json": breadcrumbData(locale, [
                { name: m.nav_today(), path: "/" },
                { name: m.nav_music(), path: "/library/" },
                { name: person.name, path: `/person/${person.slug}/` },
            ]),
        });
    }
    return tags;
}

// A composer's page: everything of theirs in the catalogue, easiest first, each
// piece one tap from being practised. Auto-generated for every composer the
// catalogue credits — living artists' curated profiles layer on top later.
export default function PersonPage() {
    const { slug } = useParams();
    const songs = useSongSource();
    // Seed with the bundled catalogue so the composer's pieces are in the first
    // render (prerendered HTML, then instant on load); the manifest merges the
    // user's imports in a beat later.
    const [person, setPerson] = useState<Person | null>(() => knownPerson(slug ?? ""));
    const [loading, setLoading] = useState(true);
    // How many pieces the shipped catalogue credits this composer with, known without
    // the network. The prerendered document is what a crawler that runs no JavaScript
    // reads, and a composer page stating "0 pieces" there would be worse than one
    // stating nothing — the count is right in the static HTML, and the list itself
    // arrives a beat later.
    const known = indexedPerson(slug ?? "");

    useEffect(() => {
        let cancelled = false;
        // Re-seed from what is known without the network on a slug change — the name at
        // minimum — then merge the catalogue and the user's imports.
        setPerson(knownPerson(slug ?? ""));
        setLoading(true);
        (async () => {
            const manifest = (await songs.manifest()) ?? [];
            if (cancelled) {
                return;
            }
            const pieces: PersonPiece[] = [...manifest, ...bundledPieces()];
            const resolved = personFor(pieces, slug ?? "");
            // Only ever an improvement on what the page opened with. A manifest that
            // could not be fetched answers null — unreachable, not empty — and taking
            // that as "this composer has nothing" would replace a name and a piece
            // count the baked index already gave us with a slug and an empty state.
            if (resolved) {
                setPerson(resolved);
            }
            setLoading(false);
        })();
        return () => {
            cancelled = true;
        };
    }, [songs.manifest, slug]);

    return (
        <main className="mx-auto max-w-3xl space-y-8 p-6 font-sans">
            <PageHeader
                eyebrow={m.person_eyebrow()}
                title={person?.name ?? nameFromSlug(slug ?? "")}
                hint={
                    person && (person.pieces.length > 0 || known)
                        ? m.person_pieces({ count: person.pieces.length || (known?.pieces ?? 0) })
                        : undefined
                }
            />

            {person ? (
                <ul className="space-y-1.5">
                    {person.pieces.map((piece) => (
                        <li key={piece.id}>
                            <Link
                                to={`/play/${piece.id}`}
                                className="flex items-center justify-between gap-3 rounded-md border border-line px-3 py-2 text-sm hover:border-accent-line-strong hover:bg-accent-surface/50 dark:hover:bg-accent-surface/30"
                            >
                                {/* A catalogue of one composer's works is exactly where
                                    an opening bar earns its place: the titles rhyme with
                                    each other, and the music does not. */}
                                <BakedIncipit
                                    mark={piece.incipit}
                                    label={piece.title}
                                    className="shrink-0 text-faint"
                                />
                                {/* flex-1, so the titles start in one column right after
                                    the marks: justify-between alone floats each one
                                    somewhere different, and a list is read down its left
                                    edge. */}
                                <span className="min-w-0 flex-1 truncate font-medium">
                                    {piece.title}
                                </span>
                                {/* The grade as the app draws it everywhere else, and the
                                    licence only where there is room: on a phone the title
                                    is what a reader is scanning for, and a licence code on
                                    every row of sixty takes the width the titles need. It
                                    is on the piece's own page in full. */}
                                <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
                                    {piece.grade !== undefined && <GradeChip grade={piece.grade} />}
                                    {piece.license && (
                                        <span className="hidden sm:inline">{piece.license}</span>
                                    )}
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            ) : (
                !loading && (
                    <p className="text-sm text-muted">
                        {m.person_empty()}{" "}
                        <Link to="/library" className="font-medium text-accent hover:underline">
                            {m.nav_music()}
                        </Link>
                    </p>
                )
            )}
        </main>
    );
}
