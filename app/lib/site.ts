// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Site-wide metadata shared between the layout's social tags and the home route's
// structured data.
export const SITE_URL = "https://plinky.projects.metio.wtf";
export const SITE_TITLE = "Plinky — piano practice in your browser";
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
