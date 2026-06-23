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
export const STRUCTURED_DATA = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Plinky",
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    applicationCategory: "EducationalApplication",
    operatingSystem: "Any (modern web browser)",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};
