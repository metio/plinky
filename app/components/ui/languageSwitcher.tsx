// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { localeNames } from "../../../core/locales";
import { compactFieldClasses } from "./classes";
import { m } from "../../paraglide/messages.js";
import { getLocale, locales, setLocale } from "../../paraglide/runtime.js";

// Switching the locale navigates to the same page under the new language's prefix
// and reloads, so every string re-renders. The choice is persisted by the
// localStorage strategy, which is what a later visit to the bare "/" reads to
// reopen in this language rather than the browser's.
export function LanguageSwitcher() {
    return (
        <select
            aria-label={m.settings_language()}
            value={getLocale()}
            onChange={(event) => setLocale(event.target.value as (typeof locales)[number])}
            className={compactFieldClasses}
        >
            {locales.map((locale) => (
                <option key={locale} value={locale}>
                    {localeNames[locale] ?? locale}
                </option>
            ))}
        </select>
    );
}
