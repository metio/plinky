// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Types for dev/check-links.mjs, which stays plain JavaScript so the deploy job can run it
// with Node alone.

export function internalLinks(html: string): string[];
export function complaint(href: string, locales: string[]): string | null;
export function findRedirectingLinks(
    out?: string,
    locales?: string[],
): { file: string; href: string; why: string }[];
export function checkLinks(out?: string, settings?: string): { documents: number };
