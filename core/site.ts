// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Site-wide metadata shared between the layout's social tags and the home route's
// structured data.
export const SITE_URL = "https://plinky.fun";

// A page title with the most specific part first, ending in the brand, so a
// bookmark list reads "C major scale · Practice · Plinky" — distinguishable at a
// glance and aligned with the URL's path segments.
export function pageTitle(...parts: string[]): string {
    return [...parts, "Plinky"].join(" · ");
}

// Per-page Open Graph + Twitter card tags. og:type/site_name/image and the
// twitter card type are site-wide and live in the layout; these vary per page.
export function socialMeta(title: string, description: string) {
    return [
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
    ];
}

// The full meta for a page: a branded <title>, a description, and matching social
// tags — `headline` is the specific part (no brand suffix), used verbatim as the
// og:title.
export function routeMeta(headline: string, description: string) {
    return [
        { title: pageTitle(headline) },
        { name: "description", content: description },
        ...socialMeta(headline, description),
    ];
}
// Keeps a page out of search results while still letting crawlers follow its
// links (noindex, follow) — for pages that must stay reachable but have no place
// in the index: the legal notices, and personal/utility surfaces. Append it to a
// route's meta; such pages are also left out of the sitemap.
export function noindexMeta() {
    return { name: "robots", content: "noindex, follow" };
}

export const SITE_DESCRIPTION =
    "Practice piano in your browser with a MIDI keyboard or your computer keyboard — sight-reading, rhythm, tempo, ear-training, and loop drills, with your scores kept on your device.";

// schema.org structured data so search engines and assistants understand Plinky.
// Built per render so inLanguage matches the page's locale.
export function structuredData(locale: string) {
    return {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        name: "Plinky",
        description: SITE_DESCRIPTION,
        url: SITE_URL,
        inLanguage: locale,
        applicationCategory: "EducationalApplication",
        operatingSystem: "Any (modern web browser)",
        browserRequirements: "Requires JavaScript and a modern web browser",
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        screenshot: `${SITE_URL}/og.png`,
        featureList: [
            "Sight-reading practice",
            "Rhythm and tempo training",
            "Ear training",
            "MIDI keyboard and computer-keyboard input",
            "Graded practice with progress tracking",
        ],
        publisher: { "@type": "Organization", name: "metio", url: "https://github.com/metio" },
    };
}

// Open Graph wants the locale as language_TERRITORY; map each app locale to a
// representative one so social platforms unfurl in the right language.
const OG_LOCALE: Record<string, string> = {
    en: "en_US",
    de: "de_DE",
    nl: "nl_NL",
    fr: "fr_FR",
    es: "es_ES",
    it: "it_IT",
    pt: "pt_PT",
    el: "el_GR",
    pl: "pl_PL",
    nb: "nb_NO",
    da: "da_DK",
    sv: "sv_SE",
    fi: "fi_FI",
    hr: "hr_HR",
    uk: "uk_UA",
    zh: "zh_CN",
    ja: "ja_JP",
    ko: "ko_KR",
    ro: "ro_RO",
    cs: "cs_CZ",
    sk: "sk_SK",
    hu: "hu_HU",
    ru: "ru_RU",
    tr: "tr_TR",
    sr: "sr_RS",
    sq: "sq_AL",
};

export function ogLocale(locale: string): string {
    return OG_LOCALE[locale] ?? "en_US";
}

// schema.org data for a single piece, so a play page is indexable as the work it
// teaches rather than a generic app screen.
export function musicCompositionData(title: string, composer: string, locale: string) {
    return {
        "@context": "https://schema.org",
        "@type": "MusicComposition",
        name: title,
        inLanguage: locale,
        isAccessibleForFree: true,
        ...(composer ? { composer: { "@type": "Person", name: composer } } : {}),
    };
}

// The locale-prefixed absolute URL of a page, matching the prerendered path
// (trailing slash included): `https://plinky.fun/de/person/chopin/`.
function localeUrl(locale: string, path: string): string {
    return `${SITE_URL}/${locale}${path}`;
}

// schema.org data for a composer's page: the person as an entity, with the pieces
// of theirs the catalogue holds as a work list, so the page is indexable as the
// composer it is rather than a generic app screen.
export function personData(
    person: { slug: string; name: string; pieces: { id: string; title: string }[] },
    locale: string,
) {
    return {
        "@context": "https://schema.org",
        "@type": "Person",
        name: person.name,
        url: localeUrl(locale, `/person/${person.slug}/`),
        subjectOf: {
            "@type": "ItemList",
            numberOfItems: person.pieces.length,
            itemListElement: person.pieces.map((piece, index) => ({
                "@type": "ListItem",
                position: index + 1,
                url: localeUrl(locale, `/play/${piece.id}/`),
                name: piece.title,
            })),
        },
    };
}

// A breadcrumb trail as schema.org data, so a search result shows the page's place
// in the hierarchy (Home › Library › Composer). Each crumb is a localized name and
// a locale-relative path; the origin and locale prefix are added here.
export function breadcrumbData(locale: string, trail: { name: string; path: string }[]) {
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: trail.map((crumb, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: crumb.name,
            item: localeUrl(locale, crumb.path),
        })),
    };
}
