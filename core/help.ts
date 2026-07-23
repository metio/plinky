// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// A single help block: a short description, with a picture, belonging to one page of
// the app. The app owns the sections — a fixed set of page keys, each with a translated
// title — and the content, resolved to the reader's language, is bundled with the app
// (the local help adapter builds these from the message catalogue and the /public/help
// screenshots).
export type HelpItem = {
    // Stable identifier.
    id: string;
    // Which app section this belongs to; matched against the app's page-key registry.
    pageKey: string;
    // Sort order within its section; lower first.
    order: number;
    // The description, in the reader's language. Plain text — the page renders it as
    // text nodes, never as markup.
    text: string;
    // The section's illustration (a screenshot under /public/help).
    imageUrl?: string;
    // Alt text for the picture. Empty is allowed (a decorative image beside its text).
    imageAlt?: string;
};

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
// preserved by CSS — so the text gets paragraph breaks without any markup being
// interpreted (and therefore no injection surface).
export function paragraphs(text: string): string[] {
    return text
        .split(/\n\s*\n/)
        .map((block) => block.trim())
        .filter((block) => block !== "");
}
