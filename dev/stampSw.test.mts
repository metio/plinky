// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
    OFFLINE_MESSAGES,
    offlineCopy,
    offlineList,
    shellAssets,
    stampOfflinePage,
    stampServiceWorker,
    writeOfflineLists,
} from "./stamp-sw.mjs";

const LOCALES: string[] = JSON.parse(readFileSync("project.inlang/settings.json", "utf8")).locales;

// A build output with just what the stamp reads: two hashed assets, a root document
// naming one of them, the unstamped worker and the unstamped offline page.
function fakeBuild(): string {
    const out = mkdtempSync(join(tmpdir(), "plinky-stamp-"));
    mkdirSync(`${out}/assets`);
    writeFileSync(`${out}/assets/entry.client-abc123.js`, "");
    writeFileSync(`${out}/assets/root-def456.css`, "");
    writeFileSync(
        `${out}/index.html`,
        `<link rel="modulepreload" href="/assets/entry.client-abc123.js"><link rel="stylesheet" href="/assets/root-def456.css">`,
    );
    writeFileSync(`${out}/sw.js`, readFileSync("public/sw.js", "utf8"));
    writeFileSync(`${out}/offline.html`, readFileSync("public/offline.html", "utf8"));
    return out;
}

describe("the offline page's copy", () => {
    it("is read for every language the app ships", () => {
        const copy = offlineCopy(LOCALES);
        expect(Object.keys(copy).sort()).toEqual([...LOCALES].sort());
        for (const strings of Object.values(copy)) {
            for (const field of Object.keys(OFFLINE_MESSAGES)) {
                expect(strings[field as keyof typeof strings].length).toBeGreaterThan(0);
            }
        }
    });

    it("refuses a language missing one of its strings", () => {
        const dir = mkdtempSync(join(tmpdir(), "plinky-messages-"));
        writeFileSync(`${dir}/xx.json`, JSON.stringify({ offline_title: "Title" }));
        expect(() => offlineCopy(["xx"], dir)).toThrow(/offline_body/);
    });
});

describe("stamping a build", () => {
    it("names the cache after the assets and precaches what the root document loads", () => {
        const out = fakeBuild();
        const { hash, precache } = stampServiceWorker(out);
        expect(hash).toMatch(/^[0-9a-f]{12}$/);
        expect(precache).toEqual(["/assets/entry.client-abc123.js", "/assets/root-def456.css"]);
        const sw = readFileSync(`${out}/sw.js`, "utf8");
        expect(sw).toContain(`"plinky-build-${hash}"`);
        expect(sw).not.toContain("__BUILD_HASH__");
        expect(sw).not.toContain("__PRECACHE__");
    });

    it("leaves the offline page holding every language's copy and no placeholder", () => {
        expect(shellAssets(fakeBuild())).toHaveLength(2);
        const out = fakeBuild();
        stampOfflinePage(LOCALES, out);
        const page = readFileSync(`${out}/offline.html`, "utf8");
        expect(page).not.toContain("__OFFLINE_COPY__");
        for (const locale of LOCALES) {
            expect(page).toContain(`"${locale}":{"title":`);
        }
        // Nothing in the stamped literal can close the script element early.
        const script = page.slice(page.indexOf("const COPY = "), page.indexOf("const first"));
        expect(script).not.toContain("<");
    });
});

describe("the keep-offline list of a language", () => {
    // A merged deploy: two languages' home documents, each naming its own route manifest,
    // and every chunk of both in one assets folder.
    function mergedBuild(): string {
        const out = fakeBuild();
        for (const [locale, hash, route] of [
            ["de", "aaa111", "settings-de1.js"],
            ["fr", "bbb222", "settings-fr1.js"],
        ]) {
            mkdirSync(`${out}/${locale}`, { recursive: true });
            writeFileSync(
                `${out}/${locale}/index.html`,
                `<link rel="modulepreload" href="/assets/manifest-${hash}.js">`,
            );
            writeFileSync(
                `${out}/assets/manifest-${hash}.js`,
                `window.__reactRouterManifest={"routes":{"settings":{"module":"/assets/${route}","imports":["/assets/lib-shared.js"]}}};`,
            );
            writeFileSync(`${out}/assets/${route}`, "");
        }
        // The root build's shell, which every page with no document of its own renders
        // into, names a manifest of its own with differently hashed chunks.
        writeFileSync(
            `${out}/__spa-fallback.html`,
            `<link rel="modulepreload" href="/assets/manifest-root99.js">`,
        );
        writeFileSync(
            `${out}/assets/manifest-root99.js`,
            `window.__reactRouterManifest={"routes":{"settings":{"module":"/assets/settings-root1.js","imports":[]}}};`,
        );
        mkdirSync(`${out}/songs/index`, { recursive: true });
        writeFileSync(`${out}/songs/index/00.json`, "[]");
        writeFileSync(`${out}/songs/index/01.json`, "[]");
        mkdirSync(`${out}/help/de`, { recursive: true });
        writeFileSync(`${out}/help/de/play.webp`, "");
        return out;
    }

    it("names the language's own route chunks, the shell, the catalogue index and its pictures", () => {
        const out = mergedBuild();
        const list = offlineList("de", out);
        expect(list).toContain("/assets/manifest-aaa111.js");
        expect(list).toContain("/assets/settings-de1.js");
        expect(list).toContain("/assets/lib-shared.js");
        expect(list).not.toContain("/assets/settings-fr1.js");
        expect(list).toContain("/assets/manifest-root99.js");
        expect(list).toContain("/assets/settings-root1.js");
        expect(list).toContain("/assets/entry.client-abc123.js");
        expect(list).toContain("/de/");
        expect(list).toContain("/offline.html");
        expect(list).toContain("/songs/manifest.json");
        expect(list).toContain("/songs/index/01.json");
        expect(list).toContain("/exercises/manifest.json");
        expect(list).toContain("/help/de/play.webp");
        // No pictures for a language that has none yet, and no piece files at all.
        expect(offlineList("fr", out).some((url) => url.startsWith("/help/"))).toBe(false);
        expect(list.some((url) => url.endsWith(".mxl"))).toBe(false);
    });

    it("writes one list per language beside the site", () => {
        const out = mergedBuild();
        // A language the build did not emit gets no list, and stops nothing.
        const counts = writeOfflineLists(["de", "fr", "xx"], out);
        expect(Object.keys(counts)).toEqual(["de", "fr"]);
        const written = JSON.parse(readFileSync(`${out}/offline/de.json`, "utf8"));
        expect(written).toEqual(offlineList("de", out));
    });
});
