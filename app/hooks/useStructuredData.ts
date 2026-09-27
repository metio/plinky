// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect } from "react";

// A page's structured data, written once what it describes is known.
//
// A route's meta() is static, and some of what a page is about arrives after the page
// does — a composer's dates and the records that identify them are fetched, not bundled.
// The block is written here instead, and only here. A page whose document the edge writes
// must render no block of its own: React matches a head `<script>` by position rather than
// by what it holds, so a block rendered over a document that carries its own somewhere
// else is claimed as the wrong element, and React answers by throwing the document away.
//
// Matched by its `@type`, so a page carrying several blocks — a work and a trail — writes
// each without disturbing the others.
export function useStructuredData(type: string, data: Record<string, unknown> | null) {
    // The value rather than the object: a caller building the data inline hands over a new
    // object every render, and comparing those by identity would rewrite the tag forever.
    const json = data === null ? null : JSON.stringify(data);
    useEffect(() => {
        if (json === null) {
            return;
        }
        const found = [
            ...document.head.querySelectorAll('script[type="application/ld+json"]'),
        ].find((tag) => {
            try {
                return (
                    (JSON.parse(tag.textContent ?? "{}") as { "@type"?: string })["@type"] === type
                );
            } catch {
                return false;
            }
        });
        const tag = found ?? document.createElement("script");
        tag.textContent = json;
        if (!found) {
            tag.setAttribute("type", "application/ld+json");
            document.head.append(tag);
        }
    }, [type, json]);
}
