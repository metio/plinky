// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The home-page news item: a picture that links somewhere, published from an
// external content service so a non-technical editor can change it without a
// redeploy. Pure domain — parsing and validation only; fetching lives behind the
// NewsSource port. The editor controls this content, so nothing here is trusted:
// a malformed or unsafe payload becomes `null` (no banner), never a render of
// attacker-chosen markup or a non-https URL.

import { isHttpsUrl } from "./url";

// Re-exported so callers that reach for the news module's URL guard keep working;
// the definition lives in core/url so the help page can share the same gate.
export { isHttpsUrl } from "./url";

// The banner's shape when an item carries no usable image dimensions — the same
// 16:9 the reserved box has always defaulted to.
export const DEFAULT_NEWS_ASPECT = 16 / 9;

function readDimensions(dimensions: unknown): { width: number; height: number } | null {
    if (typeof dimensions !== "object" || dimensions === null) {
        return null;
    }
    const { width, height } = dimensions as Record<string, unknown>;
    if (typeof width !== "number" || typeof height !== "number" || width <= 0 || height <= 0) {
        return null;
    }
    return { width, height };
}

// The visible rectangle a Studio crop leaves, in asset pixels — or null when there
// is no usable crop to apply. Sanity's crop tool records how much of each edge to
// trim as a fraction (0..1) of the original; an all-zero crop (the Studio default),
// a negative fraction, or an over-trim that leaves nothing yields null so callers
// fall back to the whole image.
function cropRect(
    crop: unknown,
    dimensions: unknown,
): { x: number; y: number; w: number; h: number } | null {
    const dim = readDimensions(dimensions);
    if (!dim || typeof crop !== "object" || crop === null) {
        return null;
    }
    const { top, bottom, left, right } = crop as Record<string, unknown>;
    if (
        typeof top !== "number" ||
        typeof bottom !== "number" ||
        typeof left !== "number" ||
        typeof right !== "number"
    ) {
        return null;
    }
    if (top < 0 || bottom < 0 || left < 0 || right < 0) {
        return null;
    }
    if (top === 0 && bottom === 0 && left === 0 && right === 0) {
        return null;
    }
    const w = Math.round(dim.width * (1 - left - right));
    const h = Math.round(dim.height * (1 - top - bottom));
    if (w <= 0 || h <= 0) {
        return null;
    }
    return { x: Math.round(left * dim.width), y: Math.round(top * dim.height), w, h };
}

// Bake a Studio crop into the served URL. The asset URL serves the UNcropped
// original, so the crop only reaches the image through a `?rect=` param (the CDN's
// server-side crop) — otherwise an editor who trims the padding in Studio sees no
// change on the banner. Returns the URL unchanged when there is no crop to apply.
export function croppedImageUrl(url: string, crop: unknown, dimensions: unknown): string {
    const rect = cropRect(crop, dimensions);
    if (!rect) {
        return url;
    }
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}rect=${rect.x},${rect.y},${rect.w},${rect.h}`;
}

// The aspect ratio the banner box should take for an image — its CROPPED shape when
// a Studio crop applies (so the trimmed padding never counts), otherwise the whole
// asset's shape. Null when the dimensions are missing, so the caller keeps the 16:9
// default. This is what lets the box hug each flyer instead of letterboxing it.
export function imageAspect(crop: unknown, dimensions: unknown): number | null {
    const rect = cropRect(crop, dimensions);
    if (rect) {
        return rect.w / rect.h;
    }
    const dim = readDimensions(dimensions);
    return dim ? dim.width / dim.height : null;
}

export type NewsItem = {
    // Stable identifier, so a dismissal sticks to this item and a newly published
    // item shows again.
    id: string;
    // The picture, with any Studio crop already baked into the URL. https only — an
    // http or data/javascript URL is rejected.
    imageUrl: string;
    // Required alt text: the banner is an image link, so it must be describable.
    imageAlt: string;
    // Where the picture links. https only.
    linkUrl: string;
    // The shape the banner box takes for this item — its cropped image ratio, so the
    // picture fills the box with no letterbox padding. Defaults to 16:9.
    aspect: number;
    // Optional caption under the picture.
    headline?: string;
};

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
        imageUrl: croppedImageUrl(record.imageUrl, record.crop, record.dimensions),
        imageAlt,
        linkUrl: record.linkUrl,
        aspect: imageAspect(record.crop, record.dimensions) ?? DEFAULT_NEWS_ASPECT,
    };
    if (typeof record.headline === "string" && record.headline.trim() !== "") {
        item.headline = record.headline;
    }
    return item;
}

// Validate a list payload (an array of raw items, already in the caller's display
// order) into NewsItems: unsafe or malformed entries are dropped, and the result
// is capped to `max` so the banner rotates through a small, bounded set. A
// non-array payload — including the single-item shape an older query returned —
// yields an empty list.
export function parseNewsList(raw: unknown, max = 3): NewsItem[] {
    if (!Array.isArray(raw)) {
        return [];
    }
    const items: NewsItem[] = [];
    for (const entry of raw) {
        const item = parseNews(entry);
        if (item) {
            items.push(item);
            if (items.length >= max) {
                break;
            }
        }
    }
    return items;
}
