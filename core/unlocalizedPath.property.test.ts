// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { LANGUAGE_SHAPED, unlocalizedPath } from "./unlocalizedPath";

const segment = fc.stringMatching(/^[a-z0-9-]{1,12}$/);
const tail = fc.array(segment, { minLength: 1, maxLength: 4 });
const slash = fc.constantFrom("", "/");
const language = fc.stringMatching(/^[a-zA-Z]{2}(?:[-_][a-zA-Z]{2,4})?$/);
const notLanguage = segment.filter((one) => !LANGUAGE_SHAPED.test(one));

describe("unlocalizedPath properties", () => {
    it("never drops a first segment that is not written like a language", () => {
        fc.assert(
            fc.property(notLanguage, tail, slash, (first, rest, end) => {
                const path = `/${[first, ...rest].join("/")}${end}`;
                expect(unlocalizedPath(path)).toBe(path);
            }),
        );
    });

    it("drops exactly a language-shaped first segment when a page follows", () => {
        fc.assert(
            fc.property(language, tail, slash, (first, rest, end) => {
                const after = `/${rest.join("/")}${end}`;
                expect(unlocalizedPath(`/${first}${after}`)).toBe(after);
            }),
        );
    });

    it("always answers with a suffix of the address, starting at a slash", () => {
        fc.assert(
            fc.property(
                fc.oneof(language, notLanguage),
                fc.array(segment),
                slash,
                (first, rest, end) => {
                    const path = `/${[first, ...rest].join("/")}${end}`;
                    const out = unlocalizedPath(path);
                    expect(path.endsWith(out)).toBe(true);
                    expect(out.startsWith("/")).toBe(true);
                },
            ),
        );
    });
});
