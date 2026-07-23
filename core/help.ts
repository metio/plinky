// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { isHttpsUrl } from "./url";

// A single help block: a short description, optionally with a picture, belonging
// to one page of the app. The app owns the sections — a fixed set of page keys,
// each with a translated title — and the item text, resolved to the reader's
// language, comes bundled with the app. The parser stays strict for any
// externally-sourced item: an unsafe image or link URL is dropped, and an item
// with no usable text is discarded rather than rendered empty.
export type HelpItem = {
    // Stable identifier from the content source.
    id: string;
    // Which app section this belongs to; matched against the app's page-key
    // registry. An item whose key the app doesn't know simply never renders.
    pageKey: string;
    // Sort order within its section; lower first.
    order: number;
    // The description, already in the reader's language (or the English fallback).
    // Plain text — the page renders it as text nodes, never as markup.
    text: string;
    // Optional picture, shared across languages. https only; a rejected URL leaves
    // the item text-only.
    imageUrl?: string;
    // Alt text for the picture, translated. Empty is allowed (a decorative image).
    imageAlt?: string;
    // Optional "learn more" link. https only.
    linkUrl?: string;
};

// Validate one raw entry into a HelpItem, or null when it lacks an id, a page key,
// or usable text. An unsafe image/link URL is dropped without discarding the whole
// item, so a bad link never costs the reader the description.
export function parseHelpItem(raw: unknown): HelpItem | null {
    if (typeof raw !== "object" || raw === null) {
        return null;
    }
    const record = raw as Record<string, unknown>;
    const { id, pageKey, text } = record;
    if (typeof id !== "string" || id === "") {
        return null;
    }
    if (typeof pageKey !== "string" || pageKey.trim() === "") {
        return null;
    }
    if (typeof text !== "string" || text.trim() === "") {
        return null;
    }
    const item: HelpItem = {
        id,
        pageKey,
        order:
            typeof record.order === "number" && Number.isFinite(record.order) ? record.order : 0,
        text,
    };
    if (isHttpsUrl(record.imageUrl)) {
        item.imageUrl = record.imageUrl;
        item.imageAlt = typeof record.imageAlt === "string" ? record.imageAlt : "";
    }
    if (isHttpsUrl(record.linkUrl)) {
        item.linkUrl = record.linkUrl;
    }
    return item;
}

// Parse a raw list (the query result) into clean help items; malformed entries are
// skipped. Order is applied per section by itemsForPage, so a non-array input just
// yields nothing.
export function parseHelp(raw: unknown): HelpItem[] {
    if (!Array.isArray(raw)) {
        return [];
    }
    const items: HelpItem[] = [];
    for (const entry of raw) {
        const item = parseHelpItem(entry);
        if (item) {
            items.push(item);
        }
    }
    return items;
}

// The items for one section, in display order. A stable sort on `order` keeps the
// page deterministic even if the source returns them in another order; ties hold
// their arrival order.
export function itemsForPage(items: HelpItem[], pageKey: string): HelpItem[] {
    return items
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => item.pageKey === pageKey)
        .sort((a, b) => a.item.order - b.item.order || a.index - b.index)
        .map(({ item }) => item);
}

// Split a plain-text description into paragraphs on blank lines, trimming each and
// dropping empties. The page renders each as its own <p>, with single newlines
// preserved by CSS — so an editor gets paragraph breaks without any markup being
// interpreted (and therefore no injection surface).
export function paragraphs(text: string): string[] {
    return text
        .split(/\n\s*\n/)
        .map((block) => block.trim())
        .filter((block) => block !== "");
}
