// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect } from "react";

// A page's structured data, written once what it describes is known.
//
// A route's meta() is static, and some of what a page is about arrives after the page
// does — a composer's dates and the records that identify them are fetched, not bundled.
// The block is written here instead, and only here: two writers of one `<script>` means
// React reconciling its own version over the fuller one on hydration, which would leave a
// crawler that runs the app reading less than the document it was served.
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
