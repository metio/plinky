// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { defineField, defineType } from "sanity";

// A single settings document. Its "News board enabled" toggle is the master
// switch for the whole banner: turn it off to hide news everywhere, without
// touching any individual item.
export default defineType({
    name: "siteSettings",
    title: "Site settings",
    type: "document",
    fields: [
        defineField({
            name: "newsEnabled",
            title: "News board enabled",
            type: "boolean",
            description: "Master switch for the whole news banner.",
            initialValue: true,
        }),
    ],
    preview: {
        prepare() {
            return { title: "Site settings" };
        },
    },
});
