// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { type BoardArtist, PLATFORM_NAMES, platformFor } from "../../../core/board";
import { paragraphs } from "../../../core/help";
import { m } from "../../paraglide/messages.js";
import { BrandIcon } from "../ui/brandIcons";

// One artist pinned to the board: a poster-style card, photo-forward with the name
// over a scrim, the blurb below, and one loud follow pill. Cards lean alternately
// like posters pinned by hand (the pin dot on top sells it) and straighten when
// pointed at; the reduced-motion variants keep them still.
export function BoardArtistCard({ artist, tilt }: { artist: BoardArtist; tilt: "left" | "right" }) {
    const platform = artist.linkUrl ? platformFor(artist.linkUrl) : null;
    return (
        <article
            className={`relative rounded-2xl border border-gray-200 bg-white p-3 shadow-md transition duration-300 motion-safe:hover:-translate-y-1 motion-safe:hover:rotate-0 hover:shadow-xl dark:border-gray-800 dark:bg-gray-900 ${
                tilt === "left" ? "motion-safe:-rotate-1" : "motion-safe:rotate-1"
            }`}
        >
            <span
                aria-hidden="true"
                className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md ring-2 ring-white dark:ring-gray-900"
            />
            <div className="relative overflow-hidden rounded-xl">
                {artist.imageUrl ? (
                    <img
                        src={artist.imageUrl}
                        alt={artist.imageAlt ?? ""}
                        loading="lazy"
                        className="aspect-[4/5] w-full object-cover"
                    />
                ) : (
                    <div
                        aria-hidden="true"
                        className="flex aspect-[4/5] w-full items-center justify-center bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500"
                    >
                        <span className="text-7xl font-bold text-white/80">
                            {artist.name.slice(0, 1)}
                        </span>
                    </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-4 pb-3 pt-10">
                    <h2 className="text-2xl font-bold tracking-tight text-white">{artist.name}</h2>
                </div>
            </div>
            <div className="space-y-3 px-1 pb-1 pt-3">
                <div className="space-y-2 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                    {paragraphs(artist.text).map((para, index) => (
                        // Paragraphs are plain text in fixed order; index keys are stable.
                        // biome-ignore lint/suspicious/noArrayIndexKey: static, ordered text
                        <p key={index} className="whitespace-pre-line">
                            {para}
                        </p>
                    ))}
                </div>
                {artist.linkUrl && (
                    <a
                        href={artist.linkUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:from-indigo-500 hover:to-violet-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                    >
                        {platform && <BrandIcon brand={platform} className="h-4 w-4" />}
                        {platform
                            ? m.board_follow({ platform: PLATFORM_NAMES[platform] })
                            : `${m.board_visit()} →`}
                    </a>
                )}
            </div>
        </article>
    );
}
