// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { getLocale, locales, setLocale } from "../paraglide/runtime.js";

// Each locale labelled in its own language, so a reader recognizes their own.
const LANGUAGE_NAMES: Record<string, string> = {
    en: "English",
    de: "Deutsch",
    nl: "Nederlands",
    fr: "Français",
    es: "Español",
    it: "Italiano",
    pt: "Português",
    el: "Ελληνικά",
    pl: "Polski",
    nb: "Norsk",
    da: "Dansk",
    sv: "Svenska",
    fi: "Suomi",
    hr: "Hrvatski",
    uk: "Українська",
    zh: "中文",
    ja: "日本語",
    ko: "한국어",
};

// Switching the locale persists it (localStorage strategy) and reloads so every
// string re-renders in the new language.
export function LanguageSwitcher() {
    return (
        <select
            aria-label="Language"
            value={getLocale()}
            onChange={(event) => setLocale(event.target.value as (typeof locales)[number])}
            className="rounded-md border border-gray-300 bg-transparent px-2 py-1 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-300"
        >
            {locales.map((locale) => (
                <option key={locale} value={locale}>
                    {LANGUAGE_NAMES[locale] ?? locale}
                </option>
            ))}
        </select>
    );
}
