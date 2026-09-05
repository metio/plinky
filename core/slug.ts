// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Turns a human title or name into a lowercase, hyphen-separated token safe for a URL, a
// download filename stem, a folder or an id. Letters lose their accents rather than
// their place — "Für Elise" is "fur-elise", not "f-r-elise" — runs of anything else
// collapse to one hyphen, the ends are trimmed, and nothing surviving reads as the
// fallback. The one cut, so a piece lands on the same token whatever asks for it.
export function slugify(text: string, fallback = ""): string {
    return (
        text
            .normalize("NFKD")
            .replace(/\p{M}/gu, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "") || fallback
    );
}
