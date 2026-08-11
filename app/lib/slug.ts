// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Turns a human title into a lowercase, hyphen-separated token safe for both a URL
// slug and a download filename stem. Runs of non-alphanumerics collapse to a single
// hyphen and the ends are trimmed; an empty result falls back to "score".
export function slugify(title: string): string {
    return (
        title
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "") || "score"
    );
}
