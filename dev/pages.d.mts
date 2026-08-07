// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Types for dev/pages.mjs. The module itself stays plain JavaScript because the
// Lighthouse config and the a11y sweep are plain Node and cannot import TypeScript,
// while react-router.config.ts (which the build loads through Vite) can — so the one
// source of page truth has to be readable from both worlds.

export type Page = {
    // The canonical, unprefixed path: "/" for the locale index, "/help" for a page.
    path: string;
    // The route module, relative to app/ — "" when the table names none.
    module: string;
    // True when the path holds a parameter (":scoreId"), so it is prerendered from real
    // data rather than from this list.
    dynamic?: boolean;
};

export function readPages(): Page[];
export function staticPaths(): string[];
export function noindexPaths(): string[];
export function assertPages(): Page[];
