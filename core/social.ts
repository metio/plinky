// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Where Plinky can be followed, written down once.
//
// These are read by the site footer, by every promo video's description and by every
// composer playlist. They had drifted: the Facebook Page was linked by
// `profile.php?id=…` in the footer and the README while the clips used the clean numeric
// path, which is the same page by a URL that reads as a profile. YouTube rendered the
// other two channels with their icons and Facebook as bare text, because a link-enricher
// that recognises instagram.com/name and reddit.com/r/name has no reason to recognise a
// .php script with a query string.
//
// Pure data in core so the app and the promo tooling cannot hold different answers, and a
// test asserts the README holds the same ones — prose cannot import, so it is checked.

export type Channel = {
    // Matches a key of the footer's BrandIcon set.
    brand: "instagram" | "facebook" | "youtube" | "reddit" | "github";
    label: string;
    href: string;
};

export const CHANNELS: readonly Channel[] = [
    { brand: "instagram", label: "Instagram", href: "https://www.instagram.com/plinky.piano" },
    // The clean numeric path, not profile.php?id=…. A username on the Page would be better
    // still — facebook.com/plinkypiano — and only its owner can claim one.
    { brand: "facebook", label: "Facebook", href: "https://www.facebook.com/61591963944991" },
    // The handle rather than the channel id: it is the same channel, and this form stays
    // readable in a status bar and survives being renamed.
    { brand: "youtube", label: "YouTube", href: "https://www.youtube.com/@PlinkyPiano" },
    { brand: "reddit", label: "Reddit", href: "https://www.reddit.com/r/plinky_piano/" },
    { brand: "github", label: "GitHub", href: "https://github.com/metio/plinky" },
];

// The three a post points somebody at. GitHub is where the code is and YouTube is where
// the clip already is, so neither belongs in a video's own description.
export const FOLLOW_US: readonly Channel[] = CHANNELS.filter((channel) =>
    ["instagram", "facebook", "reddit"].includes(channel.brand),
);
