// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { defineArrayMember, defineField } from "sanity";

// A field translated per locale, stored as an internationalized array: one entry
// per language, keyed by the locale code (`en`, `de`, `fr`, …). The app's queries
// project the reader's language out of the array and fall back to `en`, so a
// visitor downloads only their own words. Pass `rows` for a multi-line text.
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
                        name: "value",
                        title: "Value",
                        type: rows ? "text" : "string",
                        ...(rows ? { rows } : {}),
                    }),
                ],
                preview: { select: { title: "value", subtitle: "_key" } },
            }),
        ],
        description:
            "One entry per language; set each entry's key to the locale code (en, de, fr, …). English is the fallback.",
    });
