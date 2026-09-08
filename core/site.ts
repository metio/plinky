import { type PersonAbout, sameAsFor } from "./personAbout";
import { CHANNELS } from "./social";
// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Site-wide metadata shared between the layout's social tags and the home route's
// structured data.
export const SITE_URL = "https://plinky.fun";

// Every page prerenders to `<path>/index.html`, so the trailing-slash form is what
// the static host serves and what the canonical link, the sitemap and the structured
// data all name. A link to the bare path only reaches it through a redirect, which
// costs a round trip and splits the URL a crawler records from the one we declare
// canonical — so the slash goes on the href itself. Takes an absolute app path,
// optionally carrying a query or fragment, and keeps those after the slash:
// `/de/library?tab=manage` → `/de/library/?tab=manage`.
export function withTrailingSlash(href: string): string {
    const mark = href.search(/[?#]/);
    const path = mark === -1 ? href : href.slice(0, mark);
    return path.endsWith("/") ? href : `${path}/${href.slice(path.length)}`;
}

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
// The card a piece's link unfurls as, painted per piece at build (dev/gen-og.mts).
export function pieceImage(id: string): string {
    return `${SITE_URL}/og/${encodeURIComponent(id)}.png`;
}

// The card tags for a page with a picture of its own. The layout writes the site's card
// for every page and stands down where a route writes these — two og:image tags is a
// coin toss over which one a link shows.
export function imageMeta(url: string, alt: string) {
    return [
        { property: "og:image", content: url },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { property: "og:image:alt", content: alt },
        { name: "twitter:image", content: url },
        { name: "twitter:image:alt", content: alt },
    ];
}

// Keeps a page out of search results while still letting crawlers follow its
// links (noindex, follow) — for pages that must stay reachable but have no place
// in the index: the legal notices, and personal/utility surfaces. Append it to a
// route's meta; such pages are also left out of the sitemap.
export function noindexMeta() {
    return { name: "robots", content: "noindex, follow" };
}

export const SITE_TAGLINE = "Piano practice in your browser";

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
        // The one line the name travels with, everywhere it is written.
        slogan: SITE_TAGLINE,
        publisher: { "@type": "Organization", name: "metio", url: "https://github.com/metio" },
        // The profiles that are Plinky's own, so a search engine ties them to the site
        // rather than to whichever page mentions the name first.
        sameAs: CHANNELS.map((channel) => channel.href),
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

// schema.org data for a content page that isn't a specific work or person — the
// about, help, and practice-surface pages. It names the page as part of the Plinky
// site (so search engines tie it to the site entity) rather than leaving it a bare,
// context-free screen. `type` narrows it where a page has a standard specialization
// (an AboutPage), defaulting to a plain WebPage.
export function webPageData(
    name: string,
    description: string,
    locale: string,
    path: string,
    type: "WebPage" | "AboutPage" | "CollectionPage" = "WebPage",
) {
    return {
        "@context": "https://schema.org",
        "@type": type,
        name,
        description,
        url: localeUrl(locale, path),
        inLanguage: locale,
        isPartOf: { "@type": "WebSite", name: "Plinky", url: SITE_URL },
        primaryImageOfPage: `${SITE_URL}/og.png`,
    };
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
    // What is known about the person beyond their pieces, where the catalogue could place
    // them (core/personAbout). `sameAs` is the half that matters most: it says this page
    // and that record are one person, which is what makes four hundred generated pages
    // four hundred known people rather than four hundred strings that look like names.
    about: PersonAbout | null = null,
) {
    return {
        "@context": "https://schema.org",
        "@type": "Person",
        name: person.name,
        url: localeUrl(locale, `/person/${person.slug}/`),
        ...(about?.about ? { description: about.about } : {}),
        ...(about?.born === undefined ? {} : { birthDate: String(about.born) }),
        ...(about?.died === undefined ? {} : { deathDate: String(about.died) }),
        ...(about && sameAsFor(about).length > 0 ? { sameAs: sameAsFor(about) } : {}),
        // The list is omitted rather than published empty: at prerender a catalogue
        // composer is known by name before their pieces are, and an ItemList declaring
        // zero items describes the page wrongly instead of describing it partially.
        ...(person.pieces.length > 0
            ? {
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
              }
            : {}),
    };
}

// One mark in the glossary as schema.org data: a term, and the set it belongs to.
//
// DefinedTerm is what a dictionary entry is, and naming the set is what says this is one
// entry of nineteen rather than a page that happens to explain a word — which is the
// difference between a search result that answers "what does a fermata mean" and one that
// lands somebody in the middle of a list.
export function definedTermData(
    locale: string,
    path: string,
    name: string,
    description: string,
    setName: string,
) {
    return {
        "@context": "https://schema.org",
        "@type": "DefinedTerm",
        name,
        description,
        url: localeUrl(locale, path),
        inLanguage: locale,
        inDefinedTermSet: {
            "@type": "DefinedTermSet",
            name: setName,
            url: localeUrl(locale, "/glossary/"),
        },
    };
}

// A shelf of the catalogue as schema.org data: a page that is a list, and the list.
//
// The pieces are capped. A grade holds several hundred, and a structured-data block
// naming every one of them is far larger than the page it describes and tells a search
// engine nothing the first fifty did not — the page's own links are what the crawler
// follows. `numberOfItems` still states the true size, so the sample is not read as the
// whole shelf.
const SHELF_SAMPLE = 50;

export function collectionData(
    locale: string,
    path: string,
    name: string,
    description: string,
    pieces: { id: string; title: string }[],
) {
    return {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name,
        description,
        url: localeUrl(locale, path),
        inLanguage: locale,
        mainEntity: {
            "@type": "ItemList",
            numberOfItems: pieces.length,
            itemListElement: pieces.slice(0, SHELF_SAMPLE).map((piece, index) => ({
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
