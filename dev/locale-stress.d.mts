// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Types for dev/locale-stress.mjs. The module stays plain JavaScript because the build
// scripts and the ci-widths wrapper run it through bare `node` to pick the locale they
// build, before anything that could load TypeScript exists.

export type WidestLocale = {
    // The locale whose messages hold the longest unbreakable word.
    locale: string;
    // That word, and where it was found — printed so the choice explains itself.
    token: string;
    length: number;
    key: string;
};

export function widestLocale(dir?: string): WidestLocale;

export type HeaviestLocale = {
    // The locale whose messages weigh the most in UTF-8 bytes — the most any visitor
    // downloads, and so what a per-visitor budget should be measuring.
    locale: string;
    bytes: number;
};

export function heaviestLocale(dir?: string): HeaviestLocale;
