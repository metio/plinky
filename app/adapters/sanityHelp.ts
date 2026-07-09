// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { type HelpItem, parseHelp } from "../../core/help";
import type { Fetcher } from "../ports/fetcher";
import type { HelpSource } from "../ports/help";

// Reads the help content from the same Sanity project as the news banner. Each
// `helpItem` document carries internationalized `text` and `alt` arrays (one entry
// per locale, keyed `en`/`de`/…); the query projects the reader's language out of
// them and falls back to English, so a visitor downloads only their locale's words,
// not all 26. The picture is shared across languages — only the text is translated.
export type SanityHelpConfig = {
    projectId: string;
    dataset: string;
    // Sanity API version, `YYYY-MM-DD` (without the leading `v`).
    apiVersion: string;
    // The GROQ query. Reads `$lang` (a query parameter) to pick each field's locale.
    query: string;
};

const DEFAULT_QUERY =
    '*[_type == "helpItem"]{' +
    '"id": _id, pageKey, "order": coalesce(order, 0), ' +
    '"imageUrl": image.asset->url, ' +
    '"imageAlt": coalesce(alt[_key == $lang][0].value, alt[_key == "en"][0].value, ""), ' +
    '"text": coalesce(text[_key == $lang][0].value, text[_key == "en"][0].value, ""), ' +
    '"linkUrl": link}';

// The Sanity config from build-time env, or null when the project isn't wired yet —
// in which case the source stays silent and never touches the network. Reuses the
// news banner's `VITE_SANITY_*` project/dataset; Vite inlines them at build.
export function sanityHelpConfigFromEnv(): SanityHelpConfig | null {
    const projectId = import.meta.env?.VITE_SANITY_PROJECT_ID as string | undefined;
    const dataset = import.meta.env?.VITE_SANITY_DATASET as string | undefined;
    if (!projectId || !dataset) {
        return null;
    }
    return {
        projectId,
        dataset,
        apiVersion:
            (import.meta.env?.VITE_SANITY_API_VERSION as string | undefined) || "2024-01-01",
        query: (import.meta.env?.VITE_SANITY_HELP_QUERY as string | undefined) || DEFAULT_QUERY,
    };
}

function queryUrl(config: SanityHelpConfig, lang: string): string {
    // GROQ parameters ride the query string as `$name=<json>`; the language is a
    // JSON string. The `apicdn` host is the cached read endpoint with open CORS for
    // a public dataset.
    const params =
        `?query=${encodeURIComponent(config.query)}` +
        `&$lang=${encodeURIComponent(JSON.stringify(lang))}`;
    return (
        `https://${config.projectId}.apicdn.sanity.io/v${config.apiVersion}` +
        `/data/query/${config.dataset}${params}`
    );
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
            try {
                // Bypass the browser HTTP cache: help content changes in Studio
                // without a redeploy, so a cached copy must never outlive a publish.
                // Sanity's apicdn is purged on publish, so the read is fresh.
                const response = await fetchUrl(queryUrl(config, lang), { cache: "no-store" });
                if (!response.ok) {
                    return [];
                }
                const body: unknown = await response.json();
                const result = (body as { result?: unknown } | null)?.result;
                return parseHelp(result);
            } catch {
                // A network failure, a non-JSON body, or a malformed result all mean
                // no help content — never a thrown error into the render.
                return [];
            }
        },
    };
}
