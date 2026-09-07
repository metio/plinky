// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
    OFFLINE_MESSAGES,
    offlineCopy,
    shellAssets,
    stampOfflinePage,
    stampServiceWorker,
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
        expect(sw).toContain(`plinky-${hash}`);
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
