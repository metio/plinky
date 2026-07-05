// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The home-page news item: a picture that links somewhere, published from an
// external content service so a non-technical editor can change it without a
// redeploy. Pure domain — parsing and validation only; fetching lives behind the
// NewsSource port. The editor controls this content, so nothing here is trusted:
// a malformed or unsafe payload becomes `null` (no banner), never a render of
// attacker-chosen markup or a non-https URL.

export type NewsItem = {
    // Stable identifier, so a dismissal sticks to this item and a newly published
    // item shows again.
    id: string;
    // The picture. https only — an http or data/javascript URL is rejected.
    imageUrl: string;
    // Required alt text: the banner is an image link, so it must be describable.
    imageAlt: string;
    // Where the picture links. https only.
    linkUrl: string;
    // Optional caption under the picture.
    headline?: string;
    // Optional width/height ratio, used to reserve the image box so a late-loading
    // picture shifts nothing. Defaults to 16/9 when absent or invalid.
    aspect?: number;
};

// True only for a well-formed https URL. Rejects http, data:, javascript:, and
// anything unparsable — the one gate that keeps editor-supplied URLs safe to put
// in an <img src> / <a href>.
export function isHttpsUrl(value: unknown): value is string {
    if (typeof value !== "string") {
        return false;
    }
    try {
        return new URL(value).protocol === "https:";
    } catch {
        return false;
    }
}

// Validate a raw payload (from any content service, already mapped to loose
// fields) into a NewsItem, or null when it is missing anything required or fails
// the safety checks. Extra fields are ignored; only the known shape survives.
export function parseNews(raw: unknown): NewsItem | null {
    if (typeof raw !== "object" || raw === null) {
        return null;
    }
    const record = raw as Record<string, unknown>;
    const { id, imageAlt } = record;
    if (typeof id !== "string" || id === "") {
        return null;
    }
    if (!isHttpsUrl(record.imageUrl) || !isHttpsUrl(record.linkUrl)) {
        return null;
    }
    if (typeof imageAlt !== "string" || imageAlt.trim() === "") {
        return null;
    }
    const item: NewsItem = {
        id,
        imageUrl: record.imageUrl,
        imageAlt,
        linkUrl: record.linkUrl,
    };
    if (typeof record.headline === "string" && record.headline.trim() !== "") {
        item.headline = record.headline;
    }
    if (typeof record.aspect === "number" && Number.isFinite(record.aspect) && record.aspect > 0) {
        item.aspect = record.aspect;
    }
    return item;
}
