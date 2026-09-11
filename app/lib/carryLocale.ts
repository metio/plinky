// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { localeToCarry } from "../../core/localeCarry";
import { cookieMaxAge, cookieName, locales, localStorageKey } from "../paraglide/runtime.js";
import type { CookieJar } from "../ports/cookieJar";
import type { KeyValueStore } from "../ports/keyValueStore";

// A language picked while the choice was kept only in localStorage, copied into the locale
// cookie once, since the cookie is what the edge reads to open the bare "/". Written under
// the runtime's own cookie name and lifetime, so it is the cookie setLocale would have
// written.
export function carryLocaleChoice(jar: CookieJar, store: KeyValueStore): void {
    const locale = localeToCarry(jar.read(), store.get(localStorageKey), locales, cookieName);
    if (locale !== null) {
        jar.write(cookieName, locale, cookieMaxAge);
    }
}
