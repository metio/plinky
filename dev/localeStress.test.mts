// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { heaviestLocale, widestLocale } from "./locale-stress.mjs";

const withMessages = (locales: Record<string, Record<string, string>>): string => {
    const dir = mkdtempSync(join(tmpdir(), "plinky-widest-"));
    for (const [locale, messages] of Object.entries(locales)) {
        writeFileSync(join(dir, `${locale}.json`), JSON.stringify(messages));
    }
    return dir;
};

describe("widestLocale", () => {
    it("names the language holding the longest word a line cannot be broken inside", () => {
        const dir = withMessages({
            en: { a: "Settings" },
            de: { a: "Datenschutzaufsichtsbehörde" },
            fr: { a: "Paramètres de confidentialité" },
        });
        const widest = widestLocale(dir);
        expect(widest.locale).toBe("de");
        expect(widest.token).toBe("Datenschutzaufsichtsbehörde");
        expect(widest.key).toBe("a");
    });

    it("ignores scripts a browser breaks between characters, whose sentences have no spaces", () => {
        const dir = withMessages({
            en: { a: "Settings" },
            de: { a: "Datenschutzaufsichtsbehörde" },
            // One unbroken run far longer than any German compound, and harmless.
            ja: { a: "設定はここにありますのでいつでも変更できますし元に戻すこともできます" },
            zh: { a: "设置在这里随时可以更改也可以随时恢复原状不会影响你的练习记录" },
        });
        expect(widestLocale(dir).locale).toBe("de");
    });

    it("does not count an interpolation's braces as part of a word", () => {
        const dir = withMessages({
            en: { a: "x" },
            de: { a: "{aVeryLongPlaceholderNameThatIsNotAWord}" },
            da: { a: "databeskyttelsestilsynsmyndighed" },
        });
        expect(widestLocale(dir).locale).toBe("da");
    });

    it("skips the schema key, which is a URL and not a message", () => {
        const dir = withMessages({
            en: { $schema: "https://inlang.com/schema/inlang-message-format", a: "Settings" },
            de: { a: "Tonleiter" },
        });
        expect(widestLocale(dir).locale).toBe("de");
    });

    it("falls back to English when there is nothing to measure", () => {
        expect(widestLocale(withMessages({ en: {} })).locale).toBe("en");
    });
});

describe("heaviestLocale", () => {
    it("names the language whose messages weigh the most", () => {
        const dir = withMessages({
            en: { a: "Settings", b: "Play" },
            de: { a: "Einstellungen", b: "Spielen" },
        });
        expect(heaviestLocale(dir).locale).toBe("de");
    });

    it("weighs bytes rather than characters, since bytes are what crosses the network", () => {
        const dir = withMessages({
            // Nine Latin characters, nine bytes.
            en: { a: "aaaaaaaaa" },
            // Five Greek characters, ten bytes.
            el: { a: "ααααα" },
        });
        expect(heaviestLocale(dir).locale).toBe("el");
        expect(heaviestLocale(dir).bytes).toBe(10);
    });

    it("leaves the schema key out, which is a URL the app never renders", () => {
        const dir = withMessages({
            en: { a: "Settings" },
            de: {
                $schema: "https://inlang.com/schema/inlang-message-format-and-then-some",
                a: "x",
            },
        });
        expect(heaviestLocale(dir).locale).toBe("en");
    });
});
