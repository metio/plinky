// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Types for dev/widest-locale.mjs. The module stays plain JavaScript because the
// ci-widths wrapper runs it through bare `node` to pick the locale it builds, before
// anything that could load TypeScript exists.

export type WidestLocale = {
    // The locale whose messages hold the longest unbreakable word.
    locale: string;
    // That word, and where it was found — printed so the choice explains itself.
    token: string;
    length: number;
    key: string;
};

export function widestLocale(dir?: string): WidestLocale;
