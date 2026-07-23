// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { HELP_CONTENT } from "../../core/helpContent";
import type { HelpItem } from "../../core/help";
import type { HelpSource } from "../ports/help";

// The offline help source: builds the help items from the content bundled with the app
// (core/helpContent) plus the screenshots under /public/help — no network, so /help works
// with no connection. Text resolves to the reader's language, falling back to English; the
// picture is the same across languages and sits above its describing text, so it carries
// an empty (decorative) alt. The items are trusted in-repo data, so they are constructed
// directly rather than run through the untrusted-content parser.
export function createLocalHelp(): HelpSource {
    return {
        fetchItems: (lang: string) =>
            Promise.resolve(
                HELP_CONTENT.map(
                    (section): HelpItem => ({
                        id: `help-${section.pageKey}`,
                        pageKey: section.pageKey,
                        order: section.order,
                        text: section.text[lang] ?? section.text.en ?? "",
                        imageUrl: `/help/${section.pageKey}.png`,
                        imageAlt: "",
                    }),
                ),
            ),
    };
}
