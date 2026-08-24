// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Making a piece of text safe to drop between XML tags.
//
// There are two of these, and the difference is deliberate rather than an oversight left
// over from writing them separately. The SVG builders put text into attributes as well as
// into elements — an `aria-label="…"` on the root, a title on a share card — so a quote has
// to become an entity or it closes the attribute early. The MusicXML builders only ever
// write text between tags, where a quote is an ordinary character, and their output is
// compared byte for byte by the round-trip tests.
//
// Escaping the quote in both would be safe and would still be wrong: it would change what
// the MusicXML builders emit for every title containing one, for no reason a reader of the
// diff could see.

// For text going into an SVG, in an element or an attribute.
export function escapeXml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

// For text going between MusicXML tags, where a quote needs no escaping.
export function escapeXmlText(text: string): string {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
