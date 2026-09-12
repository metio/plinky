// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { PAGE_NAMES, unlocalizedPath } from "./pageNames";

const segment = fc.stringMatching(/^[a-z0-9-]{1,12}$/);
const tail = fc.array(segment, { minLength: 1, maxLength: 4 });
const slash = fc.constantFrom("", "/");
const page = fc.constantFrom(...PAGE_NAMES);
const notPage = segment.filter((one) => !PAGE_NAMES.has(one));

describe("unlocalizedPath properties", () => {
    it("never drops a first segment that names a page", () => {
        fc.assert(
            fc.property(page, tail, slash, (first, rest, end) => {
                const path = `/${[first, ...rest].join("/")}${end}`;
                expect(unlocalizedPath(path)).toBe(path);
            }),
        );
    });

    it("drops exactly the first segment when it names no page and a page follows", () => {
        fc.assert(
            fc.property(notPage, tail, slash, (first, rest, end) => {
                const after = `/${rest.join("/")}${end}`;
                expect(unlocalizedPath(`/${first}${after}`)).toBe(after);
            }),
        );
    });

    it("always answers with a suffix of the address, starting at a slash", () => {
        fc.assert(
            fc.property(fc.oneof(page, notPage), fc.array(segment), slash, (first, rest, end) => {
                const path = `/${[first, ...rest].join("/")}${end}`;
                const out = unlocalizedPath(path);
                expect(path.endsWith(out)).toBe(true);
                expect(out.startsWith("/")).toBe(true);
            }),
        );
    });
});
