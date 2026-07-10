// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { type HelpItem, parseHelp } from "../../core/help";
import type { Fetcher } from "../ports/fetcher";
import type { HelpSource } from "../ports/help";
import {
    fetchSanityResult,
    type SanityConfig,
    sanityProjectFromEnv,
    sanityQueryUrl,
} from "./sanity";

// Reads the help content from the same Sanity project as the news banner. Each
// `helpItem` document carries internationalized `text` and `alt` arrays (one entry
// per locale, keyed `en`/`de`/…); the query projects the reader's language out of
// them and falls back to English, so a visitor downloads only their locale's words,
// not all 26. The picture is shared across languages — only the text is translated.
export type SanityHelpConfig = SanityConfig;

const DEFAULT_QUERY =
    '*[_type == "helpItem"]{' +
    '"id": _id, pageKey, "order": coalesce(order, 0), ' +
    '"imageUrl": image.asset->url, ' +
    '"imageAlt": coalesce(alt[_key == $lang][0].value, alt[_key == "en"][0].value, ""), ' +
    '"text": coalesce(text[_key == $lang][0].value, text[_key == "en"][0].value, ""), ' +
    '"linkUrl": link}';

// The Sanity config from build-time env, or null when the project isn't wired yet —
// in which case the source stays silent and never touches the network. Reuses the
// news banner's `VITE_SANITY_*` project/dataset; the query reads `$lang` (a GROQ
// parameter) to pick each field's locale.
export function sanityHelpConfigFromEnv(): SanityHelpConfig | null {
    const project = sanityProjectFromEnv();
    if (!project) {
        return null;
    }
    return {
        ...project,
        query: (import.meta.env?.VITE_SANITY_HELP_QUERY as string | undefined) || DEFAULT_QUERY,
    };
}

export function createSanityHelp(
    fetchUrl: Fetcher,
    config: SanityHelpConfig | null = sanityHelpConfigFromEnv(),
): HelpSource {
    return {
        async fetchItems(lang: string): Promise<HelpItem[]> {
            if (!config) {
                return [];
            }
            // A failed read arrives as null, which parseHelp maps to no items —
            // never a thrown error into the render.
            const result = await fetchSanityResult(fetchUrl, sanityQueryUrl(config, { lang }));
            return parseHelp(result);
        },
    };
}
