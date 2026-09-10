// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { CookieJar } from "../ports/cookieJar";

// The one place the app touches document.cookie (enforced by dev/check-globals.mjs).
// Reading or writing it throws a SecurityError in a sandboxed iframe or with site data
// blocked, so every access is guarded: a read answers "", a write answers false.
export const browserCookies: CookieJar = {
    read: () => {
        try {
            return typeof document === "undefined" ? "" : document.cookie;
        } catch {
            return "";
        }
    },
    write: (name, value, maxAgeSeconds) => {
        try {
            if (typeof document === "undefined") {
                return false;
            }
            // biome-ignore lint/suspicious/noDocumentCookie: this adapter is the confined owner of document.cookie, and the asynchronous Cookie Store API is not in every browser the app supports
            document.cookie = `${name}=${value}; path=/; max-age=${maxAgeSeconds}`;
            return true;
        } catch {
            return false;
        }
    },
};
