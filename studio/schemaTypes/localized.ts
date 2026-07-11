// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { defineArrayMember, defineField } from "sanity";

// The locales the app ships (messages/*.json), offered as the language dropdown
// on every translated entry.
const LOCALES = [
    { title: "English", value: "en" },
    { title: "Čeština", value: "cs" },
    { title: "Dansk", value: "da" },
    { title: "Deutsch", value: "de" },
    { title: "Ελληνικά", value: "el" },
    { title: "Español", value: "es" },
    { title: "Suomi", value: "fi" },
    { title: "Français", value: "fr" },
    { title: "Hrvatski", value: "hr" },
    { title: "Magyar", value: "hu" },
    { title: "Italiano", value: "it" },
    { title: "日本語", value: "ja" },
    { title: "한국어", value: "ko" },
    { title: "Norsk bokmål", value: "nb" },
    { title: "Nederlands", value: "nl" },
    { title: "Polski", value: "pl" },
    { title: "Português", value: "pt" },
    { title: "Română", value: "ro" },
    { title: "Русский", value: "ru" },
    { title: "Slovenčina", value: "sk" },
    { title: "Shqip", value: "sq" },
    { title: "Српски", value: "sr" },
    { title: "Svenska", value: "sv" },
    { title: "Türkçe", value: "tr" },
    { title: "Українська", value: "uk" },
    { title: "中文", value: "zh" },
];

// A field translated per locale, stored as an internationalized array: one entry
// per language, each carrying an explicit `lang` picked from a dropdown. (The
// app's queries also accept a locale-valued `_key`, which is how seed imports
// mark their entries — the Studio UI can't set `_key`, hence the field.) English
// is the fallback the app reads when a locale has no entry. Pass `rows` for a
// multi-line text.
export const localizedString = (name: string, title: string, rows?: number) =>
    defineField({
        name,
        title,
        type: "array",
        of: [
            defineArrayMember({
                type: "object",
                name: "localizedValue",
                fields: [
                    defineField({
                        name: "lang",
                        title: "Language",
                        type: "string",
                        options: { list: LOCALES },
                        validation: (rule) => rule.required(),
                    }),
                    defineField({
                        name: "value",
                        title: "Value",
                        type: rows ? "text" : "string",
                        ...(rows ? { rows } : {}),
                    }),
                ],
                preview: { select: { title: "value", subtitle: "lang" } },
            }),
        ],
        description: "One entry per language; English is the fallback.",
    });
