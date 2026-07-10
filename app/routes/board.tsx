// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { BoardArtistCard } from "../components/features/boardArtistCard";
import { useBoard } from "../hooks/useBoard";
import { routeMeta } from "../../core/site";
import { m } from "../paraglide/messages.js";
import { getLocale } from "../paraglide/runtime.js";
import type { Route } from "./+types/board";

export function meta(_args: Route.MetaArgs) {
    return routeMeta(m.board_title(), m.meta_board_description());
}

// The board: the pin-board by the practice-room door. The content team pins the
// artists in Sanity (picture, blurb, follow link) and they appear here live, no
// redeploy — the app only owns the frame around them.
export default function Board() {
    const { loading, artists } = useBoard(getLocale());

    return (
        <main className="mx-auto max-w-4xl space-y-10 p-6 font-sans">
            <header className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700 dark:text-indigo-300">
                    {m.board_eyebrow()}
                </p>
                <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
                    {m.board_title()}
                </h1>
                <p className="max-w-2xl text-pretty leading-relaxed text-gray-600 dark:text-gray-300">
                    {m.board_intro()}
                </p>
            </header>

            {artists.length > 0 ? (
                <div className="grid gap-x-8 gap-y-10 pt-2 sm:grid-cols-2">
                    {artists.map((artist, index) => (
                        <BoardArtistCard
                            key={artist.id}
                            artist={artist}
                            tilt={index % 2 === 0 ? "left" : "right"}
                        />
                    ))}
                </div>
            ) : (
                <p className="text-sm text-gray-400 dark:text-gray-500">
                    {loading ? m.board_loading() : m.board_empty()}
                </p>
            )}
        </main>
    );
}
