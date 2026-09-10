// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { cookieValue, localeToCarry } from "./localeCarry";

const LOCALES = ["en", "de", "pt"];
const NAME = "PARAGLIDE_LOCALE";

describe("cookieValue", () => {
    it("finds a cookie among others, spaced or not", () => {
        expect(cookieValue(`${NAME}=de`, NAME)).toBe("de");
        expect(cookieValue(`a=1;${NAME}=pt;b=2`, NAME)).toBe("pt");
        expect(cookieValue(`a=1;  ${NAME}=en `, NAME)).toBe("en");
    });

    it("keeps an equals sign inside the value", () => {
        expect(cookieValue("token=a=b", "token")).toBe("a=b");
    });

    it("finds nothing for a missing or merely similar name", () => {
        expect(cookieValue("", NAME)).toBeNull();
        expect(cookieValue("theme=dark; flag", NAME)).toBeNull();
        expect(cookieValue(`X${NAME}=de`, NAME)).toBeNull();
    });

    it("takes the first of two cookies with the name", () => {
        expect(cookieValue(`${NAME}=de; ${NAME}=pt`, NAME)).toBe("de");
    });
});

describe("localeToCarry", () => {
    it("carries a stored choice the cookie does not hold yet", () => {
        expect(localeToCarry("", "de", LOCALES, NAME)).toBe("de");
        expect(localeToCarry("theme=dark", "pt", LOCALES, NAME)).toBe("pt");
    });

    it("leaves a cookie that already names a language alone, even a different one", () => {
        expect(localeToCarry(`${NAME}=de`, "de", LOCALES, NAME)).toBeNull();
        expect(localeToCarry(`${NAME}=pt`, "de", LOCALES, NAME)).toBeNull();
    });

    it("replaces a cookie naming no language the site speaks", () => {
        expect(localeToCarry(`${NAME}=xx`, "de", LOCALES, NAME)).toBe("de");
        expect(localeToCarry(`${NAME}=`, "de", LOCALES, NAME)).toBe("de");
    });

    it("carries nothing without a stored choice the site can use", () => {
        expect(localeToCarry("", null, LOCALES, NAME)).toBeNull();
        expect(localeToCarry("", "xx", LOCALES, NAME)).toBeNull();
        expect(localeToCarry("", "", LOCALES, NAME)).toBeNull();
    });
});
