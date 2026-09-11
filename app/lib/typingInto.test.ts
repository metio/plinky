// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { typingInto } from "./typingInto";

const input = (type: string) => {
    const el = document.createElement("input");
    el.type = type;
    return el;
};

describe("typingInto", () => {
    it("takes a key with no target as nobody's typing", () => {
        expect(typingInto(null)).toBe(false);
    });

    it("leaves a key to a text area, a select and every field that takes text", () => {
        expect(typingInto(document.createElement("textarea"))).toBe(true);
        expect(typingInto(document.createElement("select"))).toBe(true);
        for (const type of ["text", "search", "number", "email", "password", "url"]) {
            expect(typingInto(input(type))).toBe(true);
        }
    });

    it("lets a page shortcut have a key pressed on a control no key types into", () => {
        for (const type of ["button", "checkbox", "radio", "range", "reset", "submit"]) {
            expect(typingInto(input(type))).toBe(false);
        }
        expect(typingInto(document.createElement("button"))).toBe(false);
        expect(typingInto(document.createElement("div"))).toBe(false);
        expect(typingInto(window)).toBe(false);
    });
});
