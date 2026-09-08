// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { PeopleAbout } from "../../core/personAbout";
import type { Fetcher } from "../ports/fetcher";

// What the composer pages say about their composers, in the reader's language.
//
// One file per language beside the site (dev/gen-people.mts writes them from the Wikidata
// pass), fetched the first time a composer page is opened and kept for the session — a
// visitor who reads three composers fetches it once, and one who never opens a composer
// page never fetches it at all. The same files the edge reads when it writes a composer's
// document, so the page a crawler is served and the page a reader navigates to say the
// same thing.
export type PeopleSource = {
    // The descriptions for a language, or null when they could not be fetched — which is
    // "unknown", not "nobody has a description": a page treats null as nothing to add and
    // shows the composer's pieces exactly as it did before any of this existed.
    about(locale: string): Promise<PeopleAbout | null>;
};

export function createPeopleSource(fetchUrl: Fetcher): PeopleSource {
    // One in-flight request per language, and one cached answer: concurrent first-render
    // callers share a fetch rather than each firing their own.
    const cache = new Map<string, PeopleAbout>();
    const inFlight = new Map<string, Promise<PeopleAbout | null>>();
    return {
        about(locale) {
            const held = cache.get(locale);
            if (held) {
                return Promise.resolve(held);
            }
            const running = inFlight.get(locale);
            if (running) {
                return running;
            }
            const request = (async (): Promise<PeopleAbout | null> => {
                try {
                    const response = await fetchUrl(`/people/${locale}.json`);
                    if (!response.ok) {
                        return null;
                    }
                    const parsed: unknown = await response.json();
                    // An object of slugs, and nothing else: a captive portal's HTML page
                    // parses as neither, and a list would be a file of another shape.
                    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
                        return null;
                    }
                    const people = parsed as PeopleAbout;
                    cache.set(locale, people);
                    return people;
                } catch {
                    return null;
                } finally {
                    inFlight.delete(locale);
                }
            })();
            inFlight.set(locale, request);
            return request;
        },
    };
}
