// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { defineField, defineType } from "sanity";

// A home-page news item Plinky fetches live. The app validates and shows only the
// most recently updated item whose "Show this item" is on (and only when the
// master switch in Site settings is not off).
export default defineType({
    name: "news",
    title: "News",
    type: "document",
    fields: [
        defineField({
            name: "headline",
            title: "Headline",
            type: "string",
            description: "Optional caption shown under the picture.",
        }),
        defineField({
            name: "image",
            title: "Image",
            type: "image",
            options: { hotspot: true },
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: "alt",
            title: "Image alt text",
            type: "string",
            description: "Describes the picture for screen readers. Required.",
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: "link",
            title: "Link URL",
            type: "url",
            description: "Where the picture links. Must be https.",
            validation: (rule) => rule.required().uri({ scheme: ["https"] }),
        }),
        defineField({
            name: "show",
            title: "Show this item",
            type: "boolean",
            description: "Turn this item on or off without deleting it.",
            initialValue: true,
        }),
        defineField({
            name: "aspect",
            title: "Image aspect ratio (width ÷ height)",
            type: "number",
            description:
                "Optional. Reserves the picture's height so it does not shift the page. Defaults to 16/9.",
        }),
    ],
    preview: {
        select: { title: "headline", media: "image", show: "show" },
        prepare({ title, media, show }) {
            return { title: title || "News item", subtitle: show ? "Shown" : "Hidden", media };
        },
    },
});
