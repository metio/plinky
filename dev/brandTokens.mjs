// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The colour a design token resolves to, read off app.css (and a built stylesheet, for
// the tokens the theme block computes) so no generated asset can be in last month's
// palette. The brand kit and the icons both paint from here.
export function tokenValue(css, built, name) {
    const from = (text) => text.match(new RegExp(`${name}:\\s*([^;]+)`));
    const match = from(css) ?? from(built);
    if (!match) {
        throw new Error(`${name} is defined in neither app.css nor the build`);
    }
    const raw = match[1].trim();
    return raw.startsWith("var(") ? tokenValue(css, built, raw.slice(4, -1).trim()) : raw;
}
