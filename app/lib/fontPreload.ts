// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Which slice of the typeface a page has to have before it paints.
//
// Inter is self-hosted and split by script: each subset is its own @font-face with a
// unicode-range, so a reader downloads only the glyphs their page uses. That is the whole
// point of the split, and it is also the trap — the subset a page needs has to be asked
// for in the document, or it is discovered from the stylesheet instead, half a second
// later. The page then paints in a fallback and re-lays itself out when the real font
// lands, which is layout shift measured in whole viewports on a page of prose.
//
// So the preload names the subset the page's own text is drawn from. Naming the wrong one
// is worse than naming none: the connection is spent on glyphs nothing renders.

import interCyrillic from "@fontsource-variable/inter/files/inter-cyrillic-wght-normal.woff2?url";
import interGreek from "@fontsource-variable/inter/files/inter-greek-wght-normal.woff2?url";
import interLatin from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url";

// The Latin subset, named because pages carrying English text in a non-English interface
// need it whatever their language is — see app/routes/news.tsx.
export const INTER_LATIN = interLatin;

const BY_LOCALE: Record<string, string> = {
    el: interGreek,
    ru: interCyrillic,
    uk: interCyrillic,
    sr: interCyrillic,
};

// Languages whose text the reader's own system fonts draw. Asking for Inter there is a
// download nothing renders from.
const SYSTEM_FONT_LOCALES = new Set(["ja", "ko", "zh"]);

// The subset a locale's interface text is drawn from, or nothing where system fonts draw
// it. Note this is about the INTERFACE: a page rendering content in another script needs
// that script's subset as well, and says so itself.
export function interSubsetFor(locale: string): string | null {
    if (SYSTEM_FONT_LOCALES.has(locale)) {
        return null;
    }
    return BY_LOCALE[locale] ?? interLatin;
}

// One preload link, in the shape a route's links() returns.
export function fontPreload(href: string) {
    return {
        rel: "preload",
        as: "font",
        type: "font/woff2",
        href,
        crossOrigin: "anonymous",
    } as const;
}
