// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Answer a real page with a real document.
//
// Cloudflare Pages has one response for a path it holds no document for: it serves
// 404.html, and it serves it with a 404 status. The deploy makes 404.html the SPA shell,
// so a reader following a link to a piece gets the piece — the client router matches the
// route and renders it. A crawler gets "gone" and leaves, and a link shared anywhere
// unfurls as the site's generic card, because the shell knows nothing about the page.
//
// Almost the whole catalogue is in that position. Two pieces prerender to their own
// document (the bundled scores); the other 3,300 render on the client, in each of 26
// languages, and every one of those URLs is linked from the catalogue page. Prerendering
// them is closed off by the host: a deployment may hold twenty thousand files, and the
// catalogue in every language is eighty thousand documents.
//
// So the document is written here, at the edge, from build/client/known.json
// (dev/gen-known-ids.mts): the piece's title and composer in the page's own language,
// the canonical address and its hreflang cluster, the social card, the structured data a
// search engine reads the page as, and a summary a reader without JavaScript can read.
// A prerendered document is served exactly as it is; only a miss reaches the rewrite,
// and _routes.json narrows this to the routes that render from data, so a missing image
// stays missing — a 404 for something that really is absent is the correct answer.
//
// And only where the page really is there. An id from a scheme the catalogue left behind,
// a composer whose spelling was merged into another's, a piece that never existed: those
// are absent, and a 200 with a document for them is a soft 404 that teaches a search index
// to distrust every answer the site gives. A miss the list does not hold keeps its 404.

// A generated exercise — a scale, an arpeggio, a chord set — is built from its id and has
// no manifest row to look up; its shape is the whole test. It gets the shell with a 200
// and no document of its own: its title is the exercise's own business.
const GENERATED = /^(?:scale|arpeggio|chords)-/;
// One fetch of the list per isolate, shared by every request it serves after; and one per
// language of what the composer pages say about their composers.
let knownPromise = null;
const peoplePromises = new Map();

// The language a visitor asked for, from the Accept-Language header, among those the site
// speaks: the first listed preference whose language tag matches, region ignored, so
// de-AT is German and zh-TW is Chinese. English when nothing matches or nothing is sent,
// which is also what a crawler gets — and English is the site's own language, the one
// every page names as its default alternate.
export function pickLocale(acceptLanguage, locales) {
    const wanted = (acceptLanguage ?? "")
        .split(",")
        .map((part) => {
            const [tag, ...params] = part.trim().split(";");
            const q = params.map((param) => param.trim()).find((param) => param.startsWith("q="));
            return { tag: (tag ?? "").toLowerCase(), q: q ? Number(q.slice(2)) : 1 };
        })
        .filter((one) => one.tag !== "" && one.tag !== "*" && one.q > 0)
        .sort((a, b) => b.q - a.q);
    for (const { tag } of wanted) {
        const language = tag.split("-")[0];
        if (locales.includes(language)) {
            return language;
        }
    }
    return "en";
}

// The cookie the app's language switcher writes (paraglide's `cookie` strategy, set up in
// dev/compile-messages.mjs). The edge runs with no build step, so the name is repeated
// here; a test reads it off the compiled runtime.
export const LOCALE_COOKIE = "PARAGLIDE_LOCALE";

// The language the player last picked, from the Cookie header, when it is one the site
// speaks. Null for no cookie, or one naming a language the site no longer has.
export function chosenLocale(cookieHeader, locales) {
    for (const part of (cookieHeader ?? "").split(";")) {
        const [name, ...value] = part.trim().split("=");
        if (name === LOCALE_COOKIE) {
            const locale = value.join("=").trim();
            return locales.includes(locale) ? locale : null;
        }
    }
    return null;
}

async function known(context) {
    if (knownPromise === null) {
        knownPromise = context.env.ASSETS.fetch(new URL("/known.json", context.request.url))
            .then((response) => (response.ok ? response.json() : null))
            .then((list) =>
                list?.pieces && list.people
                    ? {
                          pieces: list.pieces,
                          people: list.people,
                          // Named works are newer than the two above, so they are read
                          // defensively: a deployment whose known.json predates them is
                          // a site without collection pages, not a site without a
                          // catalogue. Every field this rebuild forgets is a feature the
                          // edge silently loses, which is how the collections arrived
                          // working in describe() and 404ing in the browser.
                          collections: list.collections ?? {},
                          locales: Array.isArray(list.locales) ? list.locales : [],
                          base: list.base ?? "en",
                          strings: list.strings ?? {},
                      }
                    : null,
            )
            .catch(() => null);
    }
    return knownPromise;
}

// What a composer page says about its composer, in one language: the line, the dates and
// the records that identify them (dev/gen-people.mts writes one file per language). Empty
// when the file cannot be read — a composer page without it is the page as it was, which
// is a name and a list.
async function described(context, locale) {
    if (!peoplePromises.has(locale)) {
        peoplePromises.set(
            locale,
            context.env.ASSETS.fetch(new URL(`/people/${locale}.json`, context.request.url))
                .then((response) => (response.ok ? response.json() : {}))
                .then((people) => (people && typeof people === "object" ? people : {}))
                .catch(() => ({})),
        );
    }
    return peoplePromises.get(locale);
}

// The shelves the catalogue can be browsed by, kept here rather than imported from
// core/musicHubs: the middleware is plain JavaScript the edge runs with no build step, so
// it carries its own copy of the two lists. They are short and they are pinned by a test
// that reads the core module, so a shelf added there without being added here fails
// rather than answering 404 at the edge while the app renders it.
const HUB_GRADES = ["1", "2", "3", "4", "5", "6", "7", "8"];
const HUB_ERAS = ["baroque", "classical", "romantic", "modern"];
// Born before, per era: the same bounds core/musicHubs sets, for the same reason.
const ERA_UNTIL = { baroque: 1710, classical: 1800, romantic: 1870, modern: Infinity };

// What the address names: the language, which kind of page, and which one of them.
// Null for any other address.
export function parsePath(path) {
    const shelf = path.match(/^\/([a-z]{2})\/music\/(grade|era|collection)\/([^/]+)\/?$/);
    if (shelf) {
        const [, locale, kind, raw] = shelf;
        return { locale, kind, id: decodeURIComponent(raw) };
    }
    const match = path.match(/^\/([a-z]{2})\/(play|person)\/([^/]+)\/?$/);
    if (!match) {
        return null;
    }
    const [, locale, kind, raw] = match;
    return { locale, kind, id: decodeURIComponent(raw) };
}

// Whether the address names a page the site has. Unknown when the list could not be
// read: then every page is presumed real, as it always was, rather than the whole
// catalogue going missing because one file did.
export async function exists(context) {
    const page = parsePath(new URL(context.request.url).pathname);
    if (!page) {
        return true;
    }
    if (page.kind === "play" && GENERATED.test(page.id)) {
        return true;
    }
    // A shelf's address needs no catalogue to be judged: the grades and the eras are
    // fixed, and one outside them is a page the site does not have whatever the
    // catalogue holds today. An empty shelf is still a real page.
    if (page.kind === "grade") {
        return HUB_GRADES.includes(page.id);
    }
    if (page.kind === "era") {
        return HUB_ERAS.includes(page.id);
    }
    if (page.kind === "collection") {
        const list = await known(context);
        return list === null || Object.hasOwn(list.collections ?? {}, page.id);
    }
    const list = await known(context);
    if (list === null) {
        return true;
    }
    return Object.hasOwn(page.kind === "play" ? list.pieces : list.people, page.id);
}

const escapeHtml = (value) =>
    String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

// A message with its `{name}` placeholders filled, the way paraglide fills them.
const fill = (message, values) =>
    message.replace(/\{(\w+)\}/g, (whole, key) => (key in values ? values[key] : whole));

const SITE_NAME = "Plinky";

// One shelf of the catalogue: a grade, or an era.
//
// A grade's pieces are read straight off the catalogue. An era's are read through its
// composers — the people file gives each of them a birth year, and the catalogue already
// maps a composer to their pieces, so a piece is on the shelf when anybody credited on it
// was born in the period. That is the same rule the page applies to the manifest's
// credits, read from the other end.
function shelf(list, page, strings, people) {
    const path = `/music/${page.kind}/${encodeURIComponent(page.id)}/`;
    const origin = "https://plinky.fun";
    const url = (to) => `${origin}/${page.locale}${to}`;
    let ids;
    let headline;
    let description;
    if (page.kind === "collection") {
        // Own-property only: every object answers for "constructor", and a bare lookup
        // there hands back a function whose `pieces` is undefined — which crashes the
        // shelf rather than answering the 404 the address deserves.
        const works = list.collections ?? {};
        const work = Object.hasOwn(works, page.id) ? works[page.id] : null;
        if (!work) {
            return null;
        }
        ids = work.pieces;
        // The work's own name, which is a composer and a title — the same words in every
        // language, so there is nothing here to translate and nothing to get wrong.
        headline = work.name;
        description = fill(strings.hubCollection ?? "", { name: work.name });
    } else if (page.kind === "grade") {
        if (!HUB_GRADES.includes(page.id)) {
            return null;
        }
        ids = Object.keys(list.pieces).filter(
            (id) => String(list.pieces[id].grade ?? "") === page.id,
        );
        headline = fill(strings.hubGrade ?? "", { grade: page.id });
        description = fill(strings.hubGradeAbout ?? "", { grade: page.id });
    } else {
        if (!HUB_ERAS.includes(page.id)) {
            return null;
        }
        const born = people ?? {};
        const here = new Set();
        for (const [slug, about] of Object.entries(born)) {
            const year = about?.born;
            if (typeof year !== "number") {
                continue;
            }
            const era = HUB_ERAS.find((one) => year < ERA_UNTIL[one]);
            if (era === page.id) {
                here.add(slug);
            }
        }
        const found = new Set();
        for (const slug of here) {
            for (const id of list.people[slug]?.pieces ?? []) {
                found.add(id);
            }
        }
        ids = [...found];
        headline = strings[`hubEra_${page.id}`] ?? "";
        description = strings.hubEraAbout ?? "";
    }
    const found = ids.map((id) => ({ id, ...list.pieces[id] })).filter((piece) => piece.title);
    // A grade or an era is a pile to choose from, so the easiest comes first. A named work
    // is a sequence, and the bake already put it in the order somebody works through it —
    // sorting Bach's inventions by difficulty would be rewriting the book.
    const pieces =
        page.kind === "collection"
            ? found
            : [...found].sort(
                  (a, b) => (a.grade ?? 0) - (b.grade ?? 0) || a.title.localeCompare(b.title),
              );
    return {
        path,
        headline,
        description,
        lines: [],
        trail: [
            { name: strings.home ?? "", path: "/" },
            { name: strings.music ?? "", path: "/music/" },
            { name: headline, path },
        ],
        links: pieces.map((piece) => ({ name: piece.title, path: `/play/${piece.id}/` })),
        data: {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: headline,
            description,
            url: url(path),
            inLanguage: page.locale,
            mainEntity: {
                "@type": "ItemList",
                numberOfItems: pieces.length,
                // The same cap core/site.ts applies, and for the same reason: the page's
                // own links are what a crawler follows, and a block naming six hundred
                // pieces is larger than the page it describes.
                itemListElement: pieces.slice(0, 50).map((piece, index) => ({
                    "@type": "ListItem",
                    position: index + 1,
                    url: url(`/play/${piece.id}/`),
                    name: piece.title,
                })),
            },
        },
    };
}

// The page a piece or composer address names, in one language: everything the head and
// the summary are written from. Null when the list does not hold it.
export function describe(list, page, about = null) {
    const strings = list.strings[page.locale] ?? list.strings[list.base] ?? {};
    if (page.kind === "grade" || page.kind === "era" || page.kind === "collection") {
        return shelf(list, page, strings, about);
    }
    const path = `/${page.kind}/${encodeURIComponent(page.id)}/`;
    if (page.kind === "play") {
        const piece = list.pieces[page.id];
        if (!piece) {
            return null;
        }
        const said = piece.composer
            ? fill(strings.playBy ?? "", { title: piece.title, composer: piece.composer })
            : fill(strings.play ?? "", { title: piece.title });
        // What the piece is, in numbers. Without them three thousand piece pages carry the
        // same sentence with two words swapped, which matches a search for the title and
        // nothing else. The page reads the same three off the score it holds, so the
        // document a crawler is served and the one the running app writes agree.
        const facts =
            piece.grade !== undefined && piece.bars !== undefined && piece.tempo !== undefined
                ? fill(strings.playFacts ?? "", {
                      grade: piece.grade,
                      bars: piece.bars,
                      tempo: piece.tempo,
                  })
                : "";
        const description = facts ? `${said} ${facts}` : said;
        const people = Object.entries(list.people).filter(([, person]) =>
            person.pieces.includes(page.id),
        );
        const [firstSlug, first] = people[0] ?? [];
        return {
            path,
            headline: piece.title,
            description,
            lines: [
                piece.composer,
                piece.grade === undefined ? "" : fill(strings.grade ?? "", { grade: piece.grade }),
            ].filter(Boolean),
            trail: [
                { name: strings.home ?? "", path: "/" },
                { name: strings.music ?? "", path: "/music/" },
                ...(first ? [{ name: first.name, path: `/person/${firstSlug}/` }] : []),
                { name: piece.title, path },
            ],
            links: people.map(([slug, person]) => ({
                name: person.name,
                path: `/person/${slug}/`,
            })),
            data: {
                "@context": "https://schema.org",
                "@type": "MusicComposition",
                name: piece.title,
                inLanguage: page.locale,
                isAccessibleForFree: true,
                ...(piece.composer
                    ? { composer: { "@type": "Person", name: piece.composer } }
                    : {}),
            },
        };
    }
    const person = list.people[page.id];
    if (!person) {
        return null;
    }
    const sameAs = about
        ? [
              ...(about.id ? [`https://www.wikidata.org/wiki/${about.id}`] : []),
              ...(about.wikipedia ? [about.wikipedia] : []),
          ]
        : [];
    const pieces = person.pieces
        .map((id) => ({ id, ...list.pieces[id] }))
        .filter((piece) => piece.title)
        .sort((a, b) => (a.grade ?? 99) - (b.grade ?? 99) || a.title.localeCompare(b.title));
    const url = (locale, to) => `https://plinky.fun/${locale}${to}`;
    return {
        path,
        headline: person.name,
        description: fill(strings.person ?? "", { name: person.name }),
        lines: [],
        trail: [
            { name: strings.home ?? "", path: "/" },
            { name: strings.music ?? "", path: "/music/" },
            { name: person.name, path },
        ],
        links: pieces.map((piece) => ({ name: piece.title, path: `/play/${piece.id}/` })),
        data: {
            "@context": "https://schema.org",
            "@type": "Person",
            name: person.name,
            url: url(page.locale, path),
            ...(about?.about ? { description: about.about } : {}),
            ...(about?.born === undefined ? {} : { birthDate: String(about.born) }),
            ...(about?.died === undefined ? {} : { deathDate: String(about.died) }),
            ...(sameAs.length > 0 ? { sameAs } : {}),
            ...(pieces.length > 0
                ? {
                      subjectOf: {
                          "@type": "ItemList",
                          numberOfItems: pieces.length,
                          itemListElement: pieces.map((piece, index) => ({
                              "@type": "ListItem",
                              position: index + 1,
                              url: url(page.locale, `/play/${piece.id}/`),
                              name: piece.title,
                          })),
                      },
                  }
                : {}),
        },
    };
}

// The shell addressed to the page it is served for: the root's own canonical, cluster,
// card URL and language replaced by this page's, each in the place the shell holds it.
// Every client-rendered page needs this, document or none — the shell names the bare
// root as its canonical, and once the app has run and written the page's own beside it
// there are two, one of which points at the wrong page.
//
// In place, and in the app's own order, because the app hydrates the document it is
// given: a head tag it finds where it would have written it is adopted, and one it does
// not is written again beside the first — two titles, two descriptions, the structured
// data twice. So this writes what app/root.tsx writes, where it writes it, and nothing
// the app would not.
export function shellFor(shell, list, locale, path) {
    const origin = "https://plinky.fun";
    const pageUrl = `${origin}/${locale}${path}`;
    const strings = list.strings[locale] ?? list.strings[list.base] ?? {};
    const cluster = [
        ...list.locales.map(
            (one) =>
                `<link rel="alternate" hrefLang="${one}" href="${escapeHtml(`${origin}/${one}${path}`)}"/>`,
        ),
        `<link rel="alternate" hrefLang="x-default" href="${escapeHtml(`${origin}/${list.base}${path}`)}"/>`,
    ].join("");
    const alternates = list.locales
        .filter((one) => one !== locale)
        .map(
            (one) =>
                `<meta property="og:locale:alternate" content="${list.strings[one]?.og ?? "en_US"}"/>`,
        )
        .join("");
    return shell
        .replace(/<html lang="[^"]*"/, `<html lang="${escapeHtml(locale)}"`)
        .replace(
            /<link rel="canonical" href="[^"]*"\/?>/,
            `<link rel="canonical" href="${escapeHtml(pageUrl)}"/>`,
        )
        .replace(/(<link rel="alternate" hrefLang="[^"]*" href="[^"]*"\/?>)+/, cluster)
        .replace(
            /<meta property="og:url" content="[^"]*"\/?>/,
            `<meta property="og:url" content="${escapeHtml(pageUrl)}"/>`,
        )
        .replace(
            /<meta property="og:locale" content="[^"]*"\/?>/,
            `<meta property="og:locale" content="${strings.og ?? "en_US"}"/>`,
        )
        .replace(/(<meta property="og:locale:alternate" content="[^"]*"\/?>)+/, alternates);
}

// The path of the page an address names, with the trailing slash the documents are
// served at, and the language in front of it — or null outside the language pages.
export function localePath(pathname) {
    const match = pathname.match(/^\/([a-z]{2})(\/.*)?$/);
    if (!match) {
        return null;
    }
    const rest = match[2] ?? "/";
    return { locale: match[1], path: rest.endsWith("/") ? rest : `${rest}/` };
}

// Where the app writes a route's own tags: after the site-wide card fields, before the
// icons. The shell's root page wrote nothing there, so this is an insertion, made where
// the app will look for what it wrote.
const ROUTE_TAGS_AFTER = /<meta name="twitter:image:alt" content="[^"]*"\/?>/;

// Where the app writes a route's structured data: after the two theme bootstrap scripts,
// immediately before the analytics beacon. React reconciles the head's children by
// position within a tag name, so a script element in the wrong place is not merely
// misplaced — the app's first ld+json block is matched against the document's first
// script, whatever that script is, and its type attribute lands on the theme bootstrap
// while the block the edge wrote disappears. The blocks therefore go exactly where a
// prerendered page carries them.
const LD_BEFORE = /<script type="module" src="https:\/\/static\.cloudflareinsights\.com/;

// The shell rewritten into the page's own document, in the shape the app's own meta()
// would have given a page that knew its subject at build time: the same title shape,
// the same description, the same card fields, the same structured data.
export function documentFor(shell, list, page, about = null) {
    const described = describe(list, page, about);
    if (!described) {
        return null;
    }
    const origin = "https://plinky.fun";
    const { locale } = page;
    const title = `${described.headline} · ${SITE_NAME}`;
    const crumbs = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: described.trail.map((crumb, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: crumb.name,
            item: `${origin}/${locale}${crumb.path}`,
        })),
    };
    // JSON inside a script element: a "</" in a title would close the script early.
    const json = (data) => JSON.stringify(data).replace(/</g, "\\u003c");
    const routeTags = [
        `<title>${escapeHtml(title)}</title>`,
        `<meta name="description" content="${escapeHtml(described.description)}"/>`,
        `<meta property="og:title" content="${escapeHtml(described.headline)}"/>`,
        `<meta property="og:description" content="${escapeHtml(described.description)}"/>`,
        `<meta name="twitter:title" content="${escapeHtml(described.headline)}"/>`,
        `<meta name="twitter:description" content="${escapeHtml(described.description)}"/>`,
    ].join("");
    const structuredData = [
        `<script type="application/ld+json">${json(described.data)}</script>`,
        `<script type="application/ld+json">${json(crumbs)}</script>`,
    ].join("");
    // The page's own card, painted per piece and per composer at build (dev/gen-og.mts):
    // the shell carries the site's, and a link to a piece should show the piece.
    const cardUrl =
        page.kind === "play"
            ? `${origin}/og/${encodeURIComponent(page.id)}.png`
            : page.kind === "person"
              ? `${origin}/og/person/${encodeURIComponent(page.id)}.png`
              : null;
    const withCard =
        cardUrl !== null
            ? shell
                  .replace(
                      /<meta property="og:image" content="[^"]*"\/?>/,
                      `<meta property="og:image" content="${escapeHtml(cardUrl)}"/>`,
                  )
                  .replace(
                      /<meta property="og:image:alt" content="[^"]*"\/?>/,
                      `<meta property="og:image:alt" content="${escapeHtml(described.headline)}"/>`,
                  )
                  .replace(
                      /<meta name="twitter:image" content="[^"]*"\/?>/,
                      `<meta name="twitter:image" content="${escapeHtml(cardUrl)}"/>`,
                  )
                  .replace(
                      /<meta name="twitter:image:alt" content="[^"]*"\/?>/,
                      `<meta name="twitter:image:alt" content="${escapeHtml(described.headline)}"/>`,
                  )
            : shell;
    const addressed = shellFor(withCard, list, locale, described.path);
    if (!ROUTE_TAGS_AFTER.test(addressed)) {
        // A shell shaped differently from the one this was written against: the tags
        // would land somewhere the app does not look, and be written twice. Better a
        // page addressed correctly and untitled than one that says everything twice.
        return addressed;
    }
    // No summary in the body. A <noscript> block holding the page's facts was tried, and
    // the app hydrates the whole document: anything in the body it did not render is a
    // mismatch, and React throws the shell away and renders from nothing. The head is
    // where the page speaks for itself; the body is the app's.
    const titled = addressed.replace(ROUTE_TAGS_AFTER, (found) => `${found}${routeTags}`);
    // The beacon is the app's own last head script, so it is the anchor. A shell without
    // it keeps its title and its card and goes without structured data, rather than
    // carrying blocks somewhere React will reconcile the wrong element against them.
    return LD_BEFORE.test(titled)
        ? titled.replace(LD_BEFORE, (found) => `${structuredData}${found}`)
        : titled;
}

export async function onRequest(context) {
    const url = new URL(context.request.url);
    // The bare root has no page of its own: it names the language pages, and a visitor
    // belongs on theirs. Sent there at the edge, so a crawler follows a redirect to a real
    // page instead of reading a shell whose only content is the script that would have
    // sent a browser on. A language the player picked in the app comes first, and the
    // browser's languages only when they have picked none. The answer depends on both
    // headers, so it is a 302 and says so.
    if (url.pathname === "/") {
        const list = await known(context);
        if (list !== null && list.locales.length > 0) {
            const { headers } = context.request;
            const locale =
                chosenLocale(headers.get("cookie"), list.locales) ??
                pickLocale(headers.get("accept-language"), list.locales);
            return new Response(null, {
                status: 302,
                headers: { location: `${url.origin}/${locale}/`, vary: "Cookie, Accept-Language" },
            });
        }
    }
    const response = await context.next();
    if (response.status !== 404) {
        return response;
    }
    if (!(await exists(context))) {
        return response;
    }
    const where = localePath(url.pathname);
    const list = where ? await known(context) : null;
    // Addressed to the page for every language page: a piece or a composer gets its own
    // document; anything else — a generated exercise — gets the shell that at least knows
    // which page it is. The body is read only once something is certain to be written,
    // since reading it and writing nothing would leave no body at all.
    let document = null;
    if (list?.locales.includes(where.locale)) {
        const page = parsePath(url.pathname);
        // The composers' details, read only where a page is written from them — a piece's
        // document needs nothing from the file, and every fetch here is a fetch on the way
        // to a reader. A composer page takes its own entry; an era shelf takes the whole
        // file, since the shelf is defined by everybody's dates.
        let about = null;
        if (page?.kind === "person") {
            about = (await described(context, where.locale))[page.id] ?? null;
        } else if (page?.kind === "era") {
            about = await described(context, where.locale);
        }
        const shell = await response.text();
        document =
            page && describe(list, page, about) !== null
                ? documentFor(shell, list, page, about)
                : shellFor(shell, list, where.locale, where.path);
    }
    // The body is the shell either way; a Response's headers are immutable once it
    // exists, so this rebuilds rather than edits. With a document, the body is the page's
    // own and the length the shell's headers declared no longer holds.
    const headers = new Headers(response.headers);
    if (document !== null) {
        headers.delete("content-length");
        headers.set("content-type", "text/html; charset=utf-8");
    }
    return new Response(document ?? response.body, {
        status: 200,
        statusText: "OK",
        headers,
    });
}

// For the test alone: both files are read once per isolate, and a test needs a fresh read.
export function forgetKnown() {
    knownPromise = null;
    peoplePromises.clear();
}
