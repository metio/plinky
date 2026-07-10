// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { defineField, defineType } from "sanity";
import { localizedString } from "./localized";

// One artist pinned to Plinky's board page. The picture and name are shared
// across languages; the blurb and alt text are translated.

export default defineType({
    name: "boardArtist",
    title: "Board artist",
    type: "document",
    fields: [
        defineField({
            name: "name",
            title: "Name",
            type: "string",
            description: "The artist's display name, shared across languages.",
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: "image",
            title: "Picture",
            type: "image",
            options: { hotspot: true },
            description: "The artist's portrait or poster, shared across languages.",
            validation: (rule) => rule.required(),
        }),
        localizedString("alt", "Picture alt text"),
        localizedString("text", "Blurb", 4),
        defineField({
            name: "link",
            title: "Follow link",
            type: "url",
            description:
                "Where to follow the artist — an Instagram, TikTok, YouTube, X, Bluesky, or Threads profile gets that platform's icon; any other https link works too.",
            validation: (rule) => rule.required().uri({ scheme: ["https"] }),
        }),
        defineField({
            name: "order",
            title: "Order",
            type: "number",
            description: "Position on the board; lower first.",
            initialValue: 0,
        }),
        defineField({
            name: "show",
            title: "Show this artist",
            type: "boolean",
            description: "Turn this artist on or off without deleting them.",
            initialValue: true,
        }),
    ],
    preview: {
        select: { title: "name", media: "image", show: "show" },
        prepare({ title, media, show }) {
            return { title: title || "Artist", subtitle: show ? "Shown" : "Hidden", media };
        },
    },
});
