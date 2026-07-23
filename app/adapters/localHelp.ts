// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { HelpItem } from "../../core/help";
import { m } from "../paraglide/messages.js";
import type { HelpSource } from "../ports/help";

// The help sections in display order, each paired with the paraglide message that carries
// its body text. The text is a UI string like any other, so it is translated with the rest
// of the app and tree-shaken per locale — a visitor downloads only their own language. The
// picture is the section's screenshot under /public/help, shared across languages, and sits
// above its describing text, so it carries an empty (decorative) alt.
const SECTIONS: { pageKey: string; body: () => string }[] = [
    { pageKey: "gettingStarted", body: m.help_body_getting_started },
    { pageKey: "home", body: m.help_body_home },
    { pageKey: "play", body: m.help_body_play },
    { pageKey: "library", body: m.help_body_library },
    { pageKey: "daily", body: m.help_body_daily },
    { pageKey: "ear", body: m.help_body_ear },
    { pageKey: "compose", body: m.help_body_compose },
    { pageKey: "assignments", body: m.help_body_assignments },
    { pageKey: "you", body: m.help_body_you },
    { pageKey: "review", body: m.help_body_review },
    { pageKey: "settings", body: m.help_body_settings },
];

// The offline help source: builds the help items from the app's own bundled content — the
// paraglide body text and the /public/help screenshots — so /help works with no connection.
// The items are trusted in-repo content, so they are constructed directly rather than run
// through the untrusted-content parser.
export function createLocalHelp(): HelpSource {
    return {
        fetchItems: () =>
            Promise.resolve(
                SECTIONS.map(
                    (section, index): HelpItem => ({
                        id: `help-${section.pageKey}`,
                        pageKey: section.pageKey,
                        order: index,
                        text: section.body(),
                        imageUrl: `/help/${section.pageKey}.png`,
                        imageAlt: "",
                    }),
                ),
            ),
    };
}
