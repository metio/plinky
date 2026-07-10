// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { isHttpsUrl } from "./url";

// One artist pinned to the board: a name, a short blurb, a picture, and a link to
// where the artist lives online (usually a social profile). Editor-controlled, so
// nothing is trusted: an unsafe image or link URL is dropped, and an entry with no
// usable name or text is discarded rather than rendered empty.
export type BoardArtist = {
    // Stable identifier from the content source.
    id: string;
    // The artist's display name.
    name: string;
    // Sort order on the board; lower first.
    order: number;
    // The blurb, already in the reader's language (or the English fallback).
    // Plain text — the page renders it as text nodes, never as markup.
    text: string;
    // The artist's picture, shared across languages. https only; a rejected URL
    // leaves the card text-only.
    imageUrl?: string;
    // Alt text for the picture, translated. Empty is allowed (the name labels it).
    imageAlt?: string;
    // Where to follow the artist. https only.
    linkUrl?: string;
};

// Validate one raw entry into a BoardArtist, or null when it lacks an id, a name,
// or usable text. An unsafe image/link URL is dropped without discarding the whole
// entry, so a bad link never costs the reader the artist.
export function parseBoardArtist(raw: unknown): BoardArtist | null {
    if (typeof raw !== "object" || raw === null) {
        return null;
    }
    const record = raw as Record<string, unknown>;
    const { id, name, text } = record;
    if (typeof id !== "string" || id === "") {
        return null;
    }
    if (typeof name !== "string" || name.trim() === "") {
        return null;
    }
    if (typeof text !== "string" || text.trim() === "") {
        return null;
    }
    const artist: BoardArtist = {
        id,
        name: name.trim(),
        order:
            typeof record.order === "number" && Number.isFinite(record.order) ? record.order : 0,
        text,
    };
    if (isHttpsUrl(record.imageUrl)) {
        artist.imageUrl = record.imageUrl;
        artist.imageAlt = typeof record.imageAlt === "string" ? record.imageAlt : "";
    }
    if (isHttpsUrl(record.linkUrl)) {
        artist.linkUrl = record.linkUrl;
    }
    return artist;
}

// Parse a raw list (the query result) into clean artists in display order;
// malformed entries are skipped. A stable sort on `order` keeps the board
// deterministic even if the source returns them in another order; ties hold
// their arrival order.
export function parseBoard(raw: unknown): BoardArtist[] {
    if (!Array.isArray(raw)) {
        return [];
    }
    const artists: BoardArtist[] = [];
    for (const entry of raw) {
        const artist = parseBoardArtist(entry);
        if (artist) {
            artists.push(artist);
        }
    }
    return artists
        .map((artist, index) => ({ artist, index }))
        .sort((a, b) => a.artist.order - b.artist.order || a.index - b.index)
        .map(({ artist }) => artist);
}

// The platforms the board recognizes in a follow link, matched by hostname so the
// card can show the right brand glyph and name. Anything else falls back to a
// plain "visit" link — an unknown host never hides the link.
export type BoardPlatform = "instagram" | "tiktok" | "youtube" | "x" | "bluesky" | "threads";

const PLATFORM_HOSTS: Record<string, BoardPlatform> = {
    "instagram.com": "instagram",
    "tiktok.com": "tiktok",
    "youtube.com": "youtube",
    "youtu.be": "youtube",
    "x.com": "x",
    "twitter.com": "x",
    "bsky.app": "bluesky",
    "threads.com": "threads",
    "threads.net": "threads",
};

// The platform's user-facing name; brand names are not translated.
export const PLATFORM_NAMES: Record<BoardPlatform, string> = {
    instagram: "Instagram",
    tiktok: "TikTok",
    youtube: "YouTube",
    x: "X",
    bluesky: "Bluesky",
    threads: "Threads",
};

// Which platform a follow link points at, or null for a host the board doesn't
// recognize. Subdomains count (www.instagram.com, m.youtube.com).
export function platformFor(linkUrl: string): BoardPlatform | null {
    let host: string;
    try {
        host = new URL(linkUrl).hostname.toLowerCase();
    } catch {
        return null;
    }
    for (const [domain, platform] of Object.entries(PLATFORM_HOSTS)) {
        if (host === domain || host.endsWith(`.${domain}`)) {
            return platform;
        }
    }
    return null;
}
