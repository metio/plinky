// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Site-wide metadata shared between the layout's social tags and the home route's
// structured data.
export const SITE_URL = "https://plinky.fun";
export const SITE_TITLE = "Plinky — piano practice in your browser";

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
