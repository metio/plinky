// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Types for dev/stamp-sw.mjs, which stays plain JavaScript because the deploy runs it
// through plain Node with nothing installed.

export type OfflineStrings = { title: string; body: string; retry: string; home: string };

export const OFFLINE_MESSAGES: Record<keyof OfflineStrings, string>;

export function buildHash(out?: string): string;
export function shellAssets(out?: string): string[];
export function offlineCopy(
    locales: string[],
    messagesDir?: string,
): Record<string, OfflineStrings>;
export function stampServiceWorker(out?: string): { hash: string; precache: string[] };
export function stampOfflinePage(
    locales: string[],
    out?: string,
    messagesDir?: string,
): Record<string, OfflineStrings>;
export function offlineList(locale: string, out?: string): string[];
export function writeOfflineLists(locales: string[], out?: string): Record<string, number>;
