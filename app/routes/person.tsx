// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { type Person, type PersonPiece, personFor } from "../../core/person";
import { breadcrumbData, personData, routeMeta } from "../../core/site";
import { loadBundledScores } from "../lib/catalog";
import { LocalizedLink as Link } from "../components/ui/localizedLink";
import { useSongSource } from "../contexts/services";
import { m } from "../paraglide/messages.js";
import { getLocale } from "../paraglide/runtime.js";
import type { Route } from "./+types/person";

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

// meta() runs statically, before the catalogue is loaded — the slug prettifies to
// a tab title when the composer isn't among the bundled pieces, and the component
// swaps in the canonical spelling once the manifest arrives.
function nameFromSlug(slug: string): string {
    return slug
        .split("-")
        .filter(Boolean)
        .map((word) => word[0]?.toUpperCase() + word.slice(1))
        .join(" ");
}

export function meta({ params }: Route.MetaArgs) {
    const slug = params.slug ?? "";
    // The bundled composer resolves at prerender, so a bundled composer's page
    // carries its real name, piece list, and structured data in the static HTML.
    const person = personFor(bundledPieces(), slug);
    const name = person?.name ?? nameFromSlug(slug);
    const tags: Record<string, unknown>[] = [
        ...routeMeta(name || m.person_eyebrow(), m.meta_person_description({ name })),
    ];
    if (person) {
        const locale = getLocale();
        tags.push({ "script:ld+json": personData(person, locale) });
        tags.push({
            "script:ld+json": breadcrumbData(locale, [
                { name: m.nav_home(), path: "/" },
                { name: m.nav_library(), path: "/library/" },
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
    const [person, setPerson] = useState<Person | null>(() =>
        personFor(bundledPieces(), slug ?? ""),
    );
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        // Re-seed from the bundled catalogue on a slug change, then merge imports.
        setPerson(personFor(bundledPieces(), slug ?? ""));
        (async () => {
            const manifest = (await songs.manifest()) ?? [];
            if (cancelled) {
                return;
            }
            const pieces: PersonPiece[] = [...manifest, ...bundledPieces()];
            setPerson(personFor(pieces, slug ?? ""));
            setLoading(false);
        })();
        return () => {
            cancelled = true;
        };
    }, [songs.manifest, slug]);

    return (
        <main className="mx-auto max-w-3xl space-y-6 p-6 font-sans">
            <header className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700 dark:text-indigo-300">
                    {m.person_eyebrow()}
                </p>
                <h1 className="text-3xl font-bold tracking-tight">
                    {person?.name ?? nameFromSlug(slug ?? "")}
                </h1>
                {person && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        {m.person_pieces({ count: person.pieces.length })}
                    </p>
                )}
            </header>

            {person ? (
                <ul className="space-y-1.5">
                    {person.pieces.map((piece) => (
                        <li key={piece.id}>
                            <Link
                                to={`/play/${piece.id}`}
                                className="flex items-center justify-between gap-3 rounded-md border border-gray-200 px-3 py-2 text-sm hover:border-indigo-300 hover:bg-indigo-50/50 dark:border-gray-800 dark:hover:border-indigo-800 dark:hover:bg-indigo-950/30"
                            >
                                <span className="min-w-0 truncate font-medium">{piece.title}</span>
                                <span className="flex shrink-0 items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                    {piece.grade !== undefined && (
                                        <span className="rounded bg-gray-100 px-1.5 py-0.5 font-medium tabular-nums dark:bg-gray-800">
                                            G{piece.grade}
                                        </span>
                                    )}
                                    {piece.license && <span>{piece.license}</span>}
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            ) : (
                !loading && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {m.person_empty()}{" "}
                        <Link
                            to="/library"
                            className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                        >
                            {m.nav_library()}
                        </Link>
                    </p>
                )
            )}
        </main>
    );
}
