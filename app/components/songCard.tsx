// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { Link } from "react-router";
import type { Exercise } from "../lib/exercises";
import { submissionUrl, toAbcDocument } from "../lib/songs";
import { m } from "../paraglide/messages.js";

// The practice modes a song can open into; message functions resolve at render
// so the labels follow the locale.
const MODES = [
    { slug: "practice", label: m.mode_practice },
    { slug: "time-trial", label: m.mode_time_trial },
    { slug: "rhythm", label: m.mode_rhythm },
    { slug: "tempo", label: m.mode_tempo },
    { slug: "loop", label: m.mode_loop },
];

const MODE_LINK =
    "rounded-md bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300 dark:hover:bg-indigo-900";
const PLAIN =
    "rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 underline dark:text-gray-300 dark:hover:text-gray-100";

function downloadAbc(song: Exercise): void {
    const blob = new Blob([toAbcDocument(song)], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${song.id}.abc`;
    anchor.click();
    URL.revokeObjectURL(url);
}

type Props = {
    song: Exercise;
    favorite: boolean;
    onToggleFavorite: (id: string) => void;
    onRemove: (id: string) => void;
    playing: boolean;
    onPlay: (song: Exercise) => void;
    onStop: () => void;
};

// One catalog row, shared by the home favorites and the /songs browser: star to
// pin, Listen to hear it played, the practice modes, and manage actions.
export function SongCard({
    song,
    favorite,
    onToggleFavorite,
    onRemove,
    playing,
    onPlay,
    onStop,
}: Props) {
    return (
        <li className="rounded-md border border-gray-200 p-4 dark:border-gray-800">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => onToggleFavorite(song.id)}
                        aria-pressed={favorite}
                        aria-label={favorite ? m.songs_unfavorite() : m.songs_favorite()}
                        className={`text-lg leading-none ${favorite ? "text-amber-600 dark:text-amber-400" : "text-gray-500 hover:text-amber-600 dark:hover:text-amber-400"}`}
                    >
                        {favorite ? "★" : "☆"}
                    </button>
                    <span className="text-lg font-medium">{song.title}</span>
                </span>
                <span className="flex items-center gap-2">
                    {song.license && (
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                            {song.license}
                        </span>
                    )}
                    <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                        {m.home_bpm({ tempo: song.tempo })}
                    </span>
                </span>
            </div>
            {song.description && (
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{song.description}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onClick={() => (playing ? onStop() : onPlay(song))}
                    className={MODE_LINK}
                >
                    {playing ? m.action_listen_stop() : m.action_listen()}
                </button>
                {MODES.map((mode) => (
                    <Link key={mode.slug} to={`/${mode.slug}/${song.id}`} className={MODE_LINK}>
                        {mode.label()}
                    </Link>
                ))}
                <button type="button" onClick={() => downloadAbc(song)} className={PLAIN}>
                    {m.action_export()}
                </button>
                <a href={submissionUrl(song)} target="_blank" rel="noreferrer" className={PLAIN}>
                    {m.action_submit()}
                </a>
                <button
                    type="button"
                    onClick={() => onRemove(song.id)}
                    className="rounded-md px-3 py-1.5 text-sm font-medium text-red-600 underline dark:text-red-400"
                >
                    {m.action_remove()}
                </button>
            </div>
        </li>
    );
}
