// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Types for dev/gen-redirects.mjs, which stays plain JavaScript because the deploy runs it
// through plain Node with nothing installed.

export type RetiredRoute = { from: string; to: string };

export const STATIC_RULE_LIMIT: number;
export const DYNAMIC_RULE_LIMIT: number;

export function readRetired(path?: string): RetiredRoute[];
export function redirectRules(
    retired: RetiredRoute[],
    pages: string[],
    dynamic: string[],
    defaultLocale?: string,
): string[];
export function countRules(rules: string[]): { dynamic: number; fixed: number };
export function writeRedirects(
    out?: string,
    retiredPath?: string,
): { dynamic: number; fixed: number };
