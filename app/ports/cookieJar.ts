// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The page's cookies: what it holds, as one "a=1; b=2" string, and a write of one cookie
// for the whole site. A write returns whether it could be attempted; a context that denies
// cookies answers false, never throws.
export type CookieJar = {
    read(): string;
    write(name: string, value: string, maxAgeSeconds: number): boolean;
};
