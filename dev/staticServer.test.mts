// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MIME_TYPES, neverBuilt, requestPath, resolveFile, serveStatic } from "./staticServer.mjs";

let root = "";
beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "plinky-static-"));
    writeFileSync(join(root, "index.html"), "<p>shell</p>");
    mkdirSync(join(root, "en"));
    writeFileSync(join(root, "en", "index.html"), "<p>en</p>");
    writeFileSync(join(root, "site.webmanifest"), "{}");
});
afterEach(() => {
    rmSync(root, { recursive: true, force: true });
});

describe("resolveFile", () => {
    it("takes a path to its file and a directory to its index", () => {
        expect(resolveFile(root, "/site.webmanifest")).toBe(join(root, "site.webmanifest"));
        expect(resolveFile(root, "/en/")).toBe(join(root, "en", "index.html"));
        expect(resolveFile(root, "/en/?x=1")).toBe(join(root, "en", "index.html"));
    });

    it("finds nothing outside the root, or for a path with no file", () => {
        expect(resolveFile(root, "/../../etc/passwd")).toBeNull();
        expect(resolveFile(root, "/nowhere/")).toBeNull();
    });
});

describe("serveStatic", () => {
    it("serves files with the type their name says, and 404s the rest by default", async () => {
        const served = await serveStatic(root);
        try {
            const manifest = await fetch(`http://localhost:${served.port}/site.webmanifest`);
            expect(manifest.headers.get("content-type")).toBe(MIME_TYPES[".webmanifest"]);
            const missing = await fetch(`http://localhost:${served.port}/nowhere/`);
            expect(missing.status).toBe(404);
        } finally {
            await served.close();
        }
    });

    it("falls back to the shell when asked, and says so", async () => {
        const fell: string[] = [];
        const served = await serveStatic(root, {
            fallback: "spa",
            onFallback: (p) => fell.push(p),
        });
        try {
            const page = await fetch(`http://localhost:${served.port}/nowhere/`);
            expect(page.status).toBe(200);
            expect(await page.text()).toBe("<p>shell</p>");
            expect(fell).toEqual(["/nowhere/"]);
        } finally {
            await served.close();
        }
    });
});

describe("requestPath", () => {
    it("drops the query, decodes escapes and normalises", () => {
        expect(requestPath("/en/?x=1")).toBe("/en/");
        expect(requestPath("/en/caf%C3%A9/")).toBe("/en/café/");
        expect(requestPath("/en//music/../stats/")).toBe("/en/stats/");
    });
});

describe("neverBuilt", () => {
    it("names the pages the shell was served for, by the path they were requested at", () => {
        const pages = ["/en/", "/en/music/", "/en/stats/"];
        expect(neverBuilt(pages, new Set(["/en/music/"]))).toEqual(["/en/music/"]);
    });

    it("names none when every page was its own document", () => {
        expect(neverBuilt(["/en/", "/en/music/"], new Set(["/assets/missing.js"]))).toEqual([]);
    });

    it("matches a page whose path carries an escape", () => {
        expect(neverBuilt(["/en/caf%C3%A9/"], new Set([requestPath("/en/caf%C3%A9/")]))).toEqual([
            "/en/caf%C3%A9/",
        ]);
    });

    it("reports the audited page a served tree is missing", async () => {
        const fellBack = new Set<string>();
        const served = await serveStatic(root, {
            fallback: "spa",
            onFallback: (p) => fellBack.add(p),
        });
        const pages = ["/en/", "/en/music/"];
        try {
            for (const page of pages) {
                expect((await fetch(`http://localhost:${served.port}${page}`)).status).toBe(200);
            }
        } finally {
            await served.close();
        }
        expect(neverBuilt(pages, fellBack)).toEqual(["/en/music/"]);
    });
});
