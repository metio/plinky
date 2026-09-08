// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Types for dev/indexnow.mjs, which stays plain JavaScript so the deploy job can run it
// with Node alone — nothing installs a compiler on the way to a submission.

export const MAX_URLS: number;
export const INDEXNOW_KEY: string;
export const INDEXNOW_ENDPOINT: string;

export type StaticPage = { path: string; module: string };

export function changedUrls(options: {
    changed: string[];
    pages: StaticPage[];
    pieces?: string[];
    locales: string[];
    siteUrl: string;
}): string[];

export function changedPieces(
    before: { id: string }[] | null,
    after: { id: string }[] | null,
): string[];

export function submissions(
    urls: string[],
    options: { host: string; key?: string },
): { host: string; key: string; keyLocation: string; urlList: string[] }[];
