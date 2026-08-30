// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { heaviestLocale, localesByScript, scriptOf, widestLocale } from "./locale-stress.mjs";

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

describe("one locale per writing system", () => {
    it("names a locale for every script the app actually ships", () => {
        const found = localesByScript();
        const scripts = found.map((one) => one.script).sort();
        // Latin, Cyrillic, Greek and the three CJK systems are all in the catalogue of
        // twenty-six. A script that stopped appearing would mean a locale was dropped.
        expect(scripts).toEqual(["cyrillic", "greek", "han", "hangul", "kana", "latin"]);
        expect(new Set(found.map((one) => one.locale)).size).toBe(found.length);
    });

    it("agrees with the overall widest about which Latin locale is hardest", () => {
        // The cross-check that matters. Both answer the same question over the same text,
        // one per script and one across all of them, so for Latin — where the widest word
        // in the whole catalogue lives — they have to name the same locale. They did not
        // twice while this was being written: once because the message VALUES were joined
        // with nothing, fusing the end of one string to the start of the next, and once
        // because the keys were left in, making the longest "word" a message id that every
        // locale shares.
        const byScript = localesByScript().find((one) => one.script === "latin");
        expect(byScript?.locale).toBe(widestLocale().locale);
    });

    it("reads a locale's script off its own text, not off its name", () => {
        // Serbian ships in Cyrillic. A table mapping language to script would have to know
        // that, and would be wrong the day a locale switched.
        expect(scriptOf("Плинки клавир")).toBe("cyrillic");
        expect(scriptOf("Πλίνκι πιάνο")).toBe("greek");
        expect(scriptOf("プリンキー")).toBe("kana");
        expect(scriptOf("플링키 피아노")).toBe("hangul");
        expect(scriptOf("Plinky piano")).toBe("latin");
    });

    it("does not call a Latin string Greek because one term is", () => {
        // A stray glyph in an otherwise Latin string — a Greek letter in a music term, a
        // Cyrillic name in a credit — is not the language's own script.
        expect(scriptOf("The piece is in A major, marked ♪ and π-adjacent")).toBe("latin");
    });
});
