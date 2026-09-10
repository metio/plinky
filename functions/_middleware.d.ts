// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Types for functions/_middleware.js, which stays plain JavaScript because Cloudflare runs
// the file as it is shipped — nothing compiles it on the way to the edge.

// The slice of Cloudflare's EventContext this middleware touches. Narrow on purpose: what
// it needs is the asset server's answer, the request it answered, and the asset binding
// the known-address list is read through. Typing exactly that keeps the test's fake
// honest — a fake built to a wider type could satisfy the compiler while standing in for
// something the real runtime never passes.
export type AssetContext = {
    request: Request;
    next: () => Promise<Response>;
    env: { ASSETS: { fetch: (request: Request | URL | string) => Promise<Response> } };
};

// build/client/known.json as the middleware holds it (dev/gen-known-ids.mts writes it).
export type Known = {
    pieces: Record<
        string,
        {
            title: string;
            composer: string;
            grade?: number;
            license?: string;
            bars?: number;
            tempo?: number;
        }
    >;
    people: Record<string, { name: string; pieces: string[] }>;
    collections: Record<string, { name: string; pieces: string[] }>;
    locales: string[];
    base: string;
    strings: Record<
        string,
        {
            playBy: string;
            play: string;
            playFacts: string;
            person: string;
            home: string;
            music: string;
            grade: string;
            hubGrade: string;
            hubGradeAbout: string;
            hubEra_baroque: string;
            hubEra_classical: string;
            hubEra_romantic: string;
            hubEra_modern: string;
            hubEraAbout: string;
            hubCollection: string;
            og: string;
        }
    >;
};

export type PagePath = {
    locale: string;
    kind: "play" | "person" | "grade" | "era" | "collection";
    id: string;
};

// One composer's details, as build/client/people/<locale>.json holds them
// (dev/gen-people.mts writes it; core/personAbout is the same shape).
export type PersonAbout = {
    about?: string;
    born?: number;
    died?: number;
    wikipedia?: string;
    id?: string;
};

// What a page is written from beyond the catalogue: one composer's details for a composer
// page, everybody's for an era shelf (the shelf is defined by their dates), nothing else.
export type PageAbout = PersonAbout | Record<string, PersonAbout> | null;

export type Described = {
    path: string;
    headline: string;
    description: string;
    lines: string[];
    trail: { name: string; path: string }[];
    links: { name: string; path: string }[];
    data: Record<string, unknown>;
};

export function onRequest(context: AssetContext): Promise<Response>;
export function exists(context: AssetContext): Promise<boolean>;
export function parsePath(path: string): PagePath | null;
export function describe(list: Known, page: PagePath, about?: PageAbout): Described | null;
export function documentFor(
    shell: string,
    list: Known,
    page: PagePath,
    about?: PageAbout,
): string | null;
export function shellFor(shell: string, list: Known, locale: string, path: string): string;
export function localePath(pathname: string): { locale: string; path: string } | null;
export function pickLocale(acceptLanguage: string | null | undefined, locales: string[]): string;
// `declare`, because Cloudflare's Pages build bundles this file as TypeScript source too, and
// esbuild refuses a bare `export const` without an initializer.
export declare const LOCALE_COOKIE: string;
export function chosenLocale(cookieHeader: string | null | undefined, locales: string[]): string | null;
export function forgetKnown(): void;
