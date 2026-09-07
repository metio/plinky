// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect } from "react";
import { pageTitle } from "../../core/site";

// The title and description of a page whose subject arrives after the page does.
//
// A route's meta() is static: it runs before anything has loaded, and for a catalogue
// piece — three thousand of the pieces, everything that is not bundled into the app —
// it knows only that a piece is being opened. So the document said "Play · Plinky" for
// every one of them, and kept saying it after the piece was on screen. A crawler that
// runs the app reads the document as it stands once the app has run, which is what a
// search result shows: three thousand pieces, one title between them.
//
// Written into the head directly once the subject is known, in the same shape meta()
// writes for a page that knows its subject up front. Nothing to render: React owns the
// tags meta() produced, and a second <title> beside the first is two titles, not one.
// A tag the head lacks — a page reached by navigating, where no document was served
// for it — is written fresh; one the document brought is filled in.
export function useDocumentHead(
    headline: string | null,
    description: string | null,
    image: string | null = null,
) {
    useEffect(() => {
        if (headline === null) {
            return;
        }
        document.title = pageTitle(headline);
        for (const [attribute, name, content] of [
            ["name", "description", description],
            ["property", "og:title", headline],
            ["property", "og:description", description],
            ["name", "twitter:title", headline],
            ["name", "twitter:description", description],
            ["property", "og:image", image],
            ["property", "og:image:alt", image === null ? null : headline],
            ["name", "twitter:image", image],
            ["name", "twitter:image:alt", image === null ? null : headline],
        ] as const) {
            if (content === null) {
                continue;
            }
            const found = document.head.querySelectorAll(`meta[${attribute}="${name}"]`);
            if (found.length === 0) {
                const tag = document.createElement("meta");
                tag.setAttribute(attribute, name);
                tag.setAttribute("content", content);
                document.head.append(tag);
                continue;
            }
            for (const tag of found) {
                tag.setAttribute("content", content);
            }
        }
    }, [headline, description, image]);
}
