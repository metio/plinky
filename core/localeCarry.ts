// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A cookie's value by name, read from a Cookie header or document.cookie ("a=1; b=2").
// Null when no cookie has that name. The first cookie of the name wins, as in a browser.
export function cookieValue(cookies: string, name: string): string | null {
    for (const part of cookies.split(";")) {
        const at = part.indexOf("=");
        if (at === -1) {
            continue;
        }
        if (part.slice(0, at).trim() === name) {
            return part.slice(at + 1).trim();
        }
    }
    return null;
}

// The language to write into the locale cookie so the edge can see a choice the player made
// while it was recorded only in localStorage. The edge sends the bare "/" to the language the
// cookie names, and it cannot read localStorage, so a choice kept there alone is overruled by
// the browser's own language on every visit. Null when there is nothing to carry: no stored
// choice, a stored value that is no language the site speaks, or a cookie that already names
// one.
//
// A cookie naming a language is never overwritten, because the carry copies a choice and
// never makes one. The runtime reads the cookie before localStorage, so the language the app
// shows is the cookie's whenever it names one, and the carry leaves that language as it was.
// setLocale writes both records with the same value, so they disagree only when one write
// went missing: a localStorage write that failed after the cookie's, where the cookie is the
// newer record, or a pick made in a tab still running a build from before the cookie
// existed, which wrote localStorage alone. Nothing records which of the two happened, and
// carrying localStorage over the cookie would turn the first into the player's earlier
// language coming back. The second lasts only while a tab from before the cookie is open,
// and the player's next pick writes both records again.
export function localeToCarry(
    cookies: string,
    stored: string | null,
    locales: readonly string[],
    cookieName: string,
): string | null {
    const current = cookieValue(cookies, cookieName);
    if (current !== null && locales.includes(current)) {
        return null;
    }
    return stored !== null && locales.includes(stored) ? stored : null;
}
