// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { type BoardArtist, parseBoard } from "../../core/board";
import type { Fetcher } from "../ports/fetcher";
import type { BoardSource } from "../ports/board";
import {
    fetchSanityResult,
    type SanityConfig,
    sanityProjectFromEnv,
    sanityQueryUrl,
} from "./sanity";

// Reads the board's artists from the same Sanity project as the news banner and
// help page. Each `boardArtist` document carries internationalized `text` and
// `alt` arrays (one entry per locale, keyed `en`/`de`/…); the query projects the
// reader's language out of them and falls back to English, so a visitor downloads
// only their locale's words. The picture and name are shared across languages.
export type SanityBoardConfig = SanityConfig;

const DEFAULT_QUERY =
    '*[_type == "boardArtist" && show != false]{' +
    '"id": _id, name, "order": coalesce(order, 0), ' +
    '"imageUrl": image.asset->url, ' +
    '"imageAlt": coalesce(alt[_key == $lang][0].value, alt[_key == "en"][0].value, ""), ' +
    '"text": coalesce(text[_key == $lang][0].value, text[_key == "en"][0].value, ""), ' +
    '"linkUrl": link}';

// The Sanity config from build-time env, or null when the project isn't wired yet —
// in which case the source stays silent and never touches the network. Reuses the
// news banner's `VITE_SANITY_*` project/dataset; the query reads `$lang` (a GROQ
// parameter) to pick each field's locale.
export function sanityBoardConfigFromEnv(): SanityBoardConfig | null {
    const project = sanityProjectFromEnv();
    if (!project) {
        return null;
    }
    return {
        ...project,
        query: (import.meta.env?.VITE_SANITY_BOARD_QUERY as string | undefined) || DEFAULT_QUERY,
    };
}

export function createSanityBoard(
    fetchUrl: Fetcher,
    config: SanityBoardConfig | null = sanityBoardConfigFromEnv(),
): BoardSource {
    return {
        async fetchArtists(lang: string): Promise<BoardArtist[]> {
            if (!config) {
                return [];
            }
            // A failed read arrives as null, which parseBoard maps to no artists —
            // never a thrown error into the render.
            const result = await fetchSanityResult(fetchUrl, sanityQueryUrl(config, { lang }));
            return parseBoard(result);
        },
    };
}
