// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useState } from "react";
import type { BoardArtist } from "../../core/board";
import { useBoardSource } from "../contexts/services";

export type BoardState = { loading: boolean; artists: BoardArtist[] };

// Fetch every board artist for the given language, re-fetching when the language
// changes. Starts loading; resolves to the artists, or to an empty list on any
// failure so the page falls back to its empty note instead of breaking.
// Client-only, like the news source — the source is untouched during prerender,
// keeping the static shell stable.
export function useBoard(lang: string): BoardState {
    const source = useBoardSource();
    const [state, setState] = useState<BoardState>({ loading: true, artists: [] });
    useEffect(() => {
        let live = true;
        setState({ loading: true, artists: [] });
        source.fetchArtists(lang).then(
            (artists) => {
                if (live) {
                    setState({ loading: false, artists });
                }
            },
            () => {
                if (live) {
                    setState({ loading: false, artists: [] });
                }
            },
        );
        return () => {
            live = false;
        };
    }, [source, lang]);
    return state;
}
