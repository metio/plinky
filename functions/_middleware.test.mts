// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it } from "vitest";
import {
    type Known,
    describe as describePage,
    documentFor,
    forgetKnown,
    onRequest,
    parsePath,
    pickLocale,
} from "./_middleware.js";

// The catalogue as the build writes it beside the site, as the asset binding serves it.
const KNOWN: Known = {
    pieces: {
        "47xd2XDpYFCy": { title: "Ode to Joy", composer: "Ludwig van Beethoven", grade: 2 },
        aZSWdZeRKnuA: { title: "Für Elise", composer: "Ludwig van Beethoven", grade: 5 },
        ZgIdHVhH0mUb: { title: "Nocturne <Op. 9>", composer: "Frédéric Chopin", grade: 7 },
        nocomposer00: { title: "Greensleeves", composer: "" },
    },
    people: {
        "frederic-chopin": { name: "Frédéric Chopin", pieces: ["ZgIdHVhH0mUb"] },
        "ludwig-van-beethoven": {
            name: "Ludwig van Beethoven",
            pieces: ["aZSWdZeRKnuA", "47xd2XDpYFCy"],
        },
        "no-pieces": { name: "No Pieces", pieces: [] },
    },
    locales: ["en", "de", "zh", "pt"],
    base: "en",
    strings: {
        en: {
            playBy: 'Play "{title}" by {composer} in your browser.',
            play: 'Play "{title}" in your browser.',
            person: "{name}’s pieces on Plinky.",
            home: "Today",
            music: "Music",
            grade: "Grade {grade}",
            og: "en_US",
        },
        de: {
            playBy: "Spiele „{title}“ von {composer} im Browser.",
            play: "Spiele „{title}“ im Browser.",
            person: "Stücke von {name} auf Plinky.",
            home: "Heute",
            music: "Musik",
            grade: "Stufe {grade}",
            og: "de_DE",
        },
        zh: { playBy: "{title}", play: "{title}", person: "{name}", home: "今天", music: "音乐", grade: "{grade}", og: "zh_CN" },
        pt: { playBy: "{title}", play: "{title}", person: "{name}", home: "Hoje", music: "Música", grade: "{grade}", og: "pt_PT" },
    },
};

// The SPA shell as the root build writes it: the bare root's own head, which every
// document has to replace rather than add to.
const SHELL =
    '<!DOCTYPE html><html lang="en"><head><meta charSet="utf-8"/>' +
    '<link rel="canonical" href="https://plinky.fun/"/>' +
    '<link rel="alternate" hrefLang="en" href="https://plinky.fun/en/"/>' +
    '<link rel="alternate" hrefLang="de" href="https://plinky.fun/de/"/>' +
    '<meta property="og:type" content="website"/><meta property="og:site_name" content="Plinky"/>' +
    '<meta property="og:url" content="https://plinky.fun/"/><meta property="og:locale" content="en_US"/>' +
    '<meta property="og:locale:alternate" content="de_DE"/>' +
    '<meta property="og:image" content="https://plinky.fun/og.png"/>' +
    '<meta name="twitter:image:alt" content="Plinky — piano practice in your browser"/>' +
    '<link rel="icon" href="/favicon.ico" sizes="32x32"/></head><body><div id="root"></div></body></html>';

// The asset server's answer for the request, which is all the middleware ever sees, over
// an asset binding that holds the known list (or, when `listStatus` says so, does not).
function served(
    path: string,
    status: number,
    body: string | null,
    headers: Record<string, string> = {},
    listStatus = 200,
    requestHeaders: Record<string, string> = {},
) {
    return {
        request: new Request(`https://plinky.fun${path}`, { headers: requestHeaders }),
        next: async () => new Response(body, { status, headers }),
        env: {
            ASSETS: {
                fetch: async (request: Request | URL | string) => {
                    const url = new URL(typeof request === "string" ? request : request.toString());
                    if (url.pathname === "/known.json" && listStatus === 200) {
                        return new Response(JSON.stringify(KNOWN), { status: 200 });
                    }
                    return new Response("not found", { status: listStatus === 200 ? 404 : listStatus });
                },
            },
        },
    };
}

// 204 and 304 carry no body at all, which the Response constructor enforces.
const BODILESS = new Set([204, 304]);

const SHELL_HEADERS = { "content-type": "text/html", "content-length": String(SHELL.length) };

beforeEach(() => {
    forgetKnown();
});

describe("onRequest", () => {
    it("writes a piece the catalogue holds its own document, with a 200", async () => {
        const response = await onRequest(served("/en/play/47xd2XDpYFCy/", 404, SHELL, SHELL_HEADERS));

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
        // The shell's length no longer describes the body.
        expect(response.headers.get("content-length")).toBeNull();
        const html = await response.text();
        expect(html).toContain("<title>Ode to Joy · Plinky</title>");
        expect(html).toContain('<link rel="canonical" href="https://plinky.fun/en/play/47xd2XDpYFCy/"/>');
        expect(html).not.toContain('href="https://plinky.fun/"');
    });

    it("keeps the 404 for a piece the catalogue does not hold", async () => {
        // An id from a scheme the catalogue left behind: the address is gone, and a 200
        // with an empty shell would be a soft 404 in a search index.
        for (const path of [
            "/en/play/study-QmSXYCbTLLAFvAqMoKhiUbZgozYYXHoee6DcLXkLY8L8vd/",
            "/de/play/twinkle-twinkle",
            "/fi/person/lemoine-y-carulli",
        ]) {
            expect((await onRequest(served(path, 404, "shell"))).status).toBe(404);
        }
    });

    it("answers a composer the site has, in any language the site speaks", async () => {
        const response = await onRequest(served("/de/person/frederic-chopin/", 404, SHELL));
        expect(response.status).toBe(200);
        const html = await response.text();
        expect(html).toContain('<html lang="de"');
        expect(html).toContain("<title>Frédéric Chopin · Plinky</title>");
        expect(html).toContain("Stücke von Frédéric Chopin auf Plinky.");
    });

    it("addresses the shell to a generated exercise, which has no document of its own", async () => {
        // No manifest row names a scale, so there is no title to write — but the shell
        // still names the bare root as the page's canonical, and the app writes the
        // page's own beside it once it runs: two canonicals, one wrong.
        const response = await onRequest(served("/de/play/chords-c-major.1bi2/", 404, SHELL, SHELL_HEADERS));
        expect(response.status).toBe(200);
        expect(response.headers.get("content-length")).toBeNull();
        const html = await response.text();
        expect(html).toContain('<html lang="de"');
        expect(html).toContain('<link rel="canonical" href="https://plinky.fun/de/play/chords-c-major.1bi2/"/>');
        expect(html).toContain('<link rel="alternate" hrefLang="en" href="https://plinky.fun/en/play/chords-c-major.1bi2/"/>');
        expect(html).not.toContain('href="https://plinky.fun/"');
        expect(html).not.toContain("<title>");
    });

    it("addresses the shell to any other language page it is handed", async () => {
        const response = await onRequest(served("/en/music", 404, SHELL));
        const html = await response.text();
        expect(html).toContain('<link rel="canonical" href="https://plinky.fun/en/music/"/>');
        expect(html).toContain('<meta property="og:url" content="https://plinky.fun/en/music/"/>');
    });

    it("presumes every page real when the list cannot be read, and serves the shell", async () => {
        // Losing the whole catalogue because one file failed to load would be the worse
        // fault; the old behaviour is the fallback.
        const response = await onRequest(served("/en/play/twinkle-twinkle/", 404, "shell", {}, 500));
        expect(response.status).toBe(200);
        expect(await response.text()).toBe("shell");
    });

    it("leaves a language the site does not speak to the shell", async () => {
        const response = await onRequest(served("/xx/play/47xd2XDpYFCy/", 404, SHELL));
        expect(response.status).toBe(200);
        expect(await response.text()).toBe(SHELL);
    });

    it("passes a prerendered document straight through", async () => {
        // The pieces and composers that do prerender must keep their own document, with
        // their own title and structured data — rewriting those would trade one SEO bug
        // for a worse one.
        const response = await onRequest(
            served("/en/play/aZSWdZeRKnuA/", 200, "<!doctype html>Für Elise"),
        );

        expect(response.status).toBe(200);
        expect(await response.text()).toBe("<!doctype html>Für Elise");
    });

    it("leaves every other status alone", async () => {
        for (const status of [204, 301, 304, 308, 403, 500]) {
            const body = BODILESS.has(status) ? null : "";
            expect((await onRequest(served("/en/play/47xd2XDpYFCy/", status, body))).status).toBe(
                status,
            );
        }
    });

    it("corrects a miss outside the language pages with the shell as it is", async () => {
        const response = await onRequest(served("/help/", 404, "shell"));
        expect(response.status).toBe(200);
        expect(await response.text()).toBe("shell");
    });

    it("sends the bare root to the visitor's language, and to English otherwise", async () => {
        const german = await onRequest(
            served("/", 200, "root shell", {}, 200, { "accept-language": "de-AT,de;q=0.9,en;q=0.8" }),
        );
        expect(german.status).toBe(302);
        expect(german.headers.get("location")).toBe("https://plinky.fun/de/");
        expect(german.headers.get("vary")).toBe("Accept-Language");
        const crawler = await onRequest(served("/", 200, "root shell"));
        expect(crawler.headers.get("location")).toBe("https://plinky.fun/en/");
    });

    it("serves the root's own document when the list cannot be read", async () => {
        const response = await onRequest(served("/", 200, "root shell", {}, 500));
        expect(response.status).toBe(200);
        expect(await response.text()).toBe("root shell");
    });
});

describe("parsePath", () => {
    it("reads the language, the kind and the id, with or without the slash", () => {
        expect(parsePath("/de/play/47xd2XDpYFCy/")).toEqual({ locale: "de", kind: "play", id: "47xd2XDpYFCy" });
        expect(parsePath("/en/person/frederic-chopin")).toEqual({ locale: "en", kind: "person", id: "frederic-chopin" });
        expect(parsePath("/en/music/")).toBeNull();
        expect(parsePath("/play/47xd2XDpYFCy/")).toBeNull();
    });
});

describe("documentFor", () => {
    const page = { locale: "de", kind: "play" as const, id: "47xd2XDpYFCy" };
    const html = documentFor(SHELL, KNOWN, page) ?? "";

    it("writes the head the layout would have written for the page", () => {
        expect(html).toContain('<html lang="de"');
        expect(html).toContain("<title>Ode to Joy · Plinky</title>");
        expect(html).toContain(
            '<meta name="description" content="Spiele „Ode to Joy“ von Ludwig van Beethoven im Browser."/>',
        );
        expect(html).toContain('<link rel="canonical" href="https://plinky.fun/de/play/47xd2XDpYFCy/"/>');
        expect(html).toContain('<meta property="og:url" content="https://plinky.fun/de/play/47xd2XDpYFCy/"/>');
        expect(html).toContain('<meta property="og:locale" content="de_DE"/>');
        expect(html).toContain('<meta property="og:title" content="Ode to Joy"/>');
        expect(html).toContain('<meta name="twitter:title" content="Ode to Joy"/>');
    });

    it("names every language the page exists in, and the default among them", () => {
        for (const locale of KNOWN.locales) {
            expect(html).toContain(
                `<link rel="alternate" hrefLang="${locale}" href="https://plinky.fun/${locale}/play/47xd2XDpYFCy/"/>`,
            );
        }
        expect(html).toContain(
            '<link rel="alternate" hrefLang="x-default" href="https://plinky.fun/en/play/47xd2XDpYFCy/"/>',
        );
        // The other languages as card alternates, this one not among them.
        expect(html).toContain('<meta property="og:locale:alternate" content="en_US"/>');
        expect(html).not.toContain('<meta property="og:locale:alternate" content="de_DE"/>');
    });

    it("writes the route's tags where the app writes them, in the app's order", () => {
        // Adopted by hydration only where the app would have written them itself: right
        // after the site-wide card fields, title first, the structured data last.
        const after = html.slice(html.indexOf('<meta name="twitter:image:alt"'));
        const order = [
            "<title>",
            '<meta name="description"',
            '<meta property="og:title"',
            '<meta property="og:description"',
            '<meta name="twitter:title"',
            '<meta name="twitter:description"',
            '<script type="application/ld+json">',
            '<link rel="icon"',
        ].map((tag) => after.indexOf(tag));
        expect(order.every((index) => index > 0)).toBe(true);
        expect([...order].sort((a, b) => a - b)).toEqual(order);
    });

    it("keeps the canonical and the cluster where the shell held them", () => {
        // The cluster replaces the root's, in place, rather than joining the head's end.
        expect(html.indexOf('<link rel="canonical"')).toBeLessThan(html.indexOf('<meta property="og:type"'));
        expect(html.indexOf('hrefLang="x-default"')).toBeLessThan(html.indexOf('<meta property="og:type"'));
    });

    it("leaves a shell it does not recognise addressed but untitled", () => {
        // Better a page with the right canonical and no title than one with two titles.
        const strange = '<html lang="en"><head><link rel="canonical" href="https://plinky.fun/"/></head><body></body></html>';
        const html = documentFor(strange, KNOWN, page) ?? "";
        expect(html).toContain('<link rel="canonical" href="https://plinky.fun/de/play/47xd2XDpYFCy/"/>');
        expect(html).not.toContain("<title>");
    });

    it("says one thing about itself: the root's own head is gone", () => {
        expect(html).not.toContain('href="https://plinky.fun/"');
        expect(html).not.toContain('href="https://plinky.fun/en/"');
        expect(html.match(/<link rel="canonical"/g)).toHaveLength(1);
        expect(html.match(/<meta property="og:url"/g)).toHaveLength(1);
        expect(html.match(/<meta property="og:locale"/g)).toHaveLength(1);
        // What the shell carries for every page stays.
        expect(html).toContain('<meta property="og:site_name" content="Plinky"/>');
        expect(html).toContain('<link rel="icon" href="/favicon.ico"');
    });

    it("describes the work and its place in the site as structured data", () => {
        const data = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map(
            (match) => JSON.parse(match[1] ?? ""),
        );
        expect(data).toHaveLength(2);
        expect(data[0]).toMatchObject({
            "@type": "MusicComposition",
            name: "Ode to Joy",
            inLanguage: "de",
            composer: { "@type": "Person", name: "Ludwig van Beethoven" },
        });
        expect(data[1]).toMatchObject({ "@type": "BreadcrumbList" });
        expect(data[1].itemListElement.map((item: { name: string }) => item.name)).toEqual([
            "Heute",
            "Musik",
            "Ludwig van Beethoven",
            "Ode to Joy",
        ]);
        expect(data[1].itemListElement[2].item).toBe("https://plinky.fun/de/person/ludwig-van-beethoven/");
    });

    it("leaves the body to the app", () => {
        // The app hydrates the whole document, and anything in the body it did not render
        // makes it throw the shell away and start over.
        expect(html).toContain('<body><div id="root"></div></body>');
    });

    it("escapes what a title or a name brings with it", () => {
        const nocturne = documentFor(SHELL, KNOWN, { locale: "en", kind: "play", id: "ZgIdHVhH0mUb" }) ?? "";
        expect(nocturne).toContain("<title>Nocturne &lt;Op. 9&gt; · Plinky</title>");
        expect(nocturne).toContain('content="Nocturne &lt;Op. 9&gt;"');
        // The structured data holds the raw title, with nothing in it that could close
        // the script element.
        expect(nocturne).toContain('"name":"Nocturne \\u003cOp. 9>"');
    });

    it("describes a piece nobody is credited for without a composer", () => {
        const plain = documentFor(SHELL, KNOWN, { locale: "en", kind: "play", id: "nocomposer00" }) ?? "";
        expect(plain).toContain('<meta name="description" content="Play &quot;Greensleeves&quot; in your browser."/>');
        expect(plain).not.toContain('"composer"');
    });

    it("lists a composer's pieces easiest first, as an ItemList", () => {
        const person = documentFor(SHELL, KNOWN, { locale: "en", kind: "person", id: "ludwig-van-beethoven" }) ?? "";
        expect(person).toContain("<title>Ludwig van Beethoven · Plinky</title>");
        expect(person.indexOf("Ode to Joy")).toBeLessThan(person.indexOf("Für Elise"));
        const list = describePage(KNOWN, { locale: "en", kind: "person", id: "ludwig-van-beethoven" });
        expect(list?.links.map((link) => link.path)).toEqual(["/play/47xd2XDpYFCy/", "/play/aZSWdZeRKnuA/"]);
        expect(list?.data).toMatchObject({
            "@type": "Person",
            url: "https://plinky.fun/en/person/ludwig-van-beethoven/",
            subjectOf: { "@type": "ItemList", numberOfItems: 2 },
        });
    });

    it("omits the list rather than publishing it empty", () => {
        const none = describePage(KNOWN, { locale: "en", kind: "person", id: "no-pieces" });
        expect(none?.data).not.toHaveProperty("subjectOf");
    });

    it("writes nothing for what the list does not hold", () => {
        expect(documentFor(SHELL, KNOWN, { locale: "en", kind: "play", id: "gone" })).toBeNull();
        expect(documentFor(SHELL, KNOWN, { locale: "en", kind: "person", id: "nobody" })).toBeNull();
    });

    it("falls back to the site's own language for strings a language lacks", () => {
        const stripped = { ...KNOWN, strings: { en: KNOWN.strings.en } } as Known;
        const html = documentFor(SHELL, stripped, page) ?? "";
        expect(html).toContain('<html lang="de"');
        expect(html).toContain("Play &quot;Ode to Joy&quot; by Ludwig van Beethoven in your browser.");
    });
});

describe("pickLocale", () => {
    const LOCALES = ["en", "de", "zh", "pt"];
    it("takes the first preference the site speaks, region ignored", () => {
        expect(pickLocale("fr-CH,fr;q=0.9,de;q=0.8", LOCALES)).toBe("de");
        expect(pickLocale("zh-TW", LOCALES)).toBe("zh");
        expect(pickLocale("pt-BR,en;q=0.5", LOCALES)).toBe("pt");
    });
    it("orders by weight rather than by position", () => {
        expect(pickLocale("en;q=0.3,de;q=0.9", LOCALES)).toBe("de");
    });
    it("falls back to English", () => {
        expect(pickLocale("fr,it", LOCALES)).toBe("en");
        expect(pickLocale("*", LOCALES)).toBe("en");
        expect(pickLocale(null, LOCALES)).toBe("en");
        expect(pickLocale("", LOCALES)).toBe("en");
    });
});
