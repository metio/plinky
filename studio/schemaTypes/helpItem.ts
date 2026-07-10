// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { defineField, defineType } from "sanity";
import { localizedString } from "./localized";

// One block on Plinky's help page. The app owns the sections (one per part of
// the app, titled by its own translated strings); each block is tagged with the
// section it belongs to via `pageKey` and ordered within it. The picture is
// shared across languages; the body and alt text are translated.
const PAGE_KEYS = [
    { title: "Getting started", value: "gettingStarted" },
    { title: "Home", value: "home" },
    { title: "Playing a piece", value: "play" },
    { title: "Library", value: "library" },
    { title: "Daily", value: "daily" },
    { title: "Compose", value: "compose" },
    { title: "Assignments", value: "assignments" },
    { title: "You", value: "you" },
    { title: "Review", value: "review" },
    { title: "Settings", value: "settings" },
];

export default defineType({
    name: "helpItem",
    title: "Help block",
    type: "document",
    fields: [
        defineField({
            name: "pageKey",
            title: "Section",
            type: "string",
            options: { list: PAGE_KEYS },
            description: "Which part of the app this block explains.",
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: "order",
            title: "Order",
            type: "number",
            description: "Position within the section; lower first.",
            initialValue: 0,
        }),
        defineField({
            name: "image",
            title: "Picture",
            type: "image",
            options: { hotspot: true },
            description: "Optional screenshot or illustration, shared across languages.",
        }),
        localizedString("alt", "Picture alt text"),
        localizedString("text", "Body", 6),
        defineField({
            name: "link",
            title: "Learn-more link",
            type: "url",
            description: "Optional. Must be https.",
            validation: (rule) => rule.uri({ scheme: ["https"] }),
        }),
    ],
    preview: {
        select: { pageKey: "pageKey", text: "text.0.value", media: "image" },
        prepare({ pageKey, text, media }) {
            const section = PAGE_KEYS.find((key) => key.value === pageKey)?.title ?? pageKey;
            return { title: text || "Help block", subtitle: section, media };
        },
    },
});
