// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ScoreViewer } from "../components/scoreViewer";
import { resolveSong, type Song } from "../lib/catalog";
import { routeMeta } from "../lib/site";
import { m } from "../paraglide/messages.js";
import type { Route } from "./+types/play";

export function meta(_args: Route.MetaArgs) {
    return routeMeta("Play", "Practice a piece with your MIDI piano or computer keyboard");
}

export default function PlayRoute({ params }: Route.ComponentProps) {
    // The catalogue is read from local storage and bundled MusicXML on the client,
    // so the piece resolves a tick after paint: undefined while loading, null when
    // there is no such song.
    const [song, setSong] = useState<Song | null | undefined>(undefined);
    useEffect(() => {
        setSong(resolveSong(params.songId) ?? null);
    }, [params.songId]);

    return (
        <main className="mx-auto max-w-3xl space-y-5 p-6 font-sans">
            {song && (
                <>
                    <header className="space-y-1">
                        <h1 className="text-2xl font-semibold">{song.title}</h1>
                        {song.composer && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                {song.composer}
                            </p>
                        )}
                    </header>
                    <ScoreViewer key={song.id} id={song.id} xml={song.xml} title={song.title} />
                </>
            )}
            {song === null && (
                <p className="text-sm text-gray-600 dark:text-gray-400">{m.play_not_found()}</p>
            )}
            <Link to="/songs" className="text-sm text-indigo-700 underline dark:text-indigo-300">
                {m.songs_heading()}
            </Link>
        </main>
    );
}
