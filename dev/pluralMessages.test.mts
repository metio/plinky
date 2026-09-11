// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { armsOf, isComplex, pluralProblems } from "./plural-messages.mjs";

const plural = (match: Record<string, string>) => [
    {
        declarations: ["input count", "local countPlural = count: plural"],
        selectors: ["countPlural"],
        match,
    },
];

describe("isComplex and armsOf", () => {
    it("tell a plural message from a plain string and read every arm's words", () => {
        const counted = plural({ "countPlural=one": "1 note", "countPlural=other": "notes" });
        expect(isComplex(counted)).toBe(true);
        expect(isComplex("{count} notes")).toBe(false);
        expect(armsOf(counted)).toEqual(["1 note", "notes"]);
        expect(armsOf("plain")).toEqual(["plain"]);
    });
});

describe("pluralProblems", () => {
    it("asks each language for its own categories", () => {
        const twoForms = plural({ "countPlural=one": "a", "countPlural=other": "b" });
        expect(pluralProblems("en", { x: twoForms })).toEqual([]);
        expect(pluralProblems("pl", { x: twoForms })[0]).toMatch(/^x: no arm for few, many/);
    });

    it("reads a misspelt category as a missing one", () => {
        const typo = plural({ "countPlural=one": "a", "countPlural=others": "b" });
        expect(pluralProblems("en", { x: typo })).toEqual([
            "x: no arm for other — that count prints the key",
        ]);
    });

    it("flags a message the contract counts but a translation writes as one plain form", () => {
        const contract = { x: plural({ "countPlural=one": "a", "countPlural=other": "b" }) };
        expect(pluralProblems("de", { x: "{count} Noten" }, contract)).toHaveLength(1);
        expect(pluralProblems("de", { y: "plain" }, { y: "plain" })).toEqual([]);
    });
});

// The gate itself, run over a two-language catalogue in a scratch directory the way CI runs
// it, so a check the script never calls for a locale cannot pass unnoticed.
describe("npm run messages:check", () => {
    const script = resolve("dev/check-messages.mjs");
    let dir = "";

    afterEach(() => {
        rmSync(dir, { recursive: true, force: true });
    });

    function check(en: Record<string, unknown>, de: Record<string, unknown>) {
        dir = mkdtempSync(join(tmpdir(), "check-messages-"));
        mkdirSync(join(dir, "project.inlang"));
        mkdirSync(join(dir, "messages"));
        mkdirSync(join(dir, "app"));
        writeFileSync(
            join(dir, "project.inlang/settings.json"),
            JSON.stringify({
                baseLocale: "en",
                locales: ["en", "de"],
                "plugin.inlang.messageFormat": { pathPattern: "./messages/{locale}.json" },
            }),
        );
        writeFileSync(join(dir, "messages/en.json"), JSON.stringify(en));
        writeFileSync(join(dir, "messages/de.json"), JSON.stringify(de));
        writeFileSync(join(dir, "app/uses.ts"), "m.notes({ count: 2 });\n");
        return spawnSync(process.execPath, [script], { cwd: dir, encoding: "utf8" });
    }

    const german = plural({
        "countPlural=one": "{count} Note",
        "countPlural=other": "{count} Noten",
    });

    it("passes a sound catalogue", () => {
        const english = plural({
            "countPlural=one": "{count} note",
            "countPlural=other": "{count} notes",
        });
        const run = check({ notes: english }, { notes: german });
        expect(run.stderr).toBe("");
        expect(run.status).toBe(0);
    });

    it("holds the contract's own plural message to every English category", () => {
        const run = check(
            { notes: plural({ "countPlural=one": "{count} note" }) },
            { notes: german },
        );
        expect(run.status).toBe(1);
        expect(run.stderr).toMatch(/en: .*\n\s+notes: no arm for other/);
    });
});
