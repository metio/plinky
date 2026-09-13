// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DOT } from "../core/wordmark.ts";

// The dot over the name's i is drawn from two places: the header reads it as a token, and the
// canvas, the thumbnails and the outlined lockups take core/wordmark's DOT. They are one colour
// only while these agree.
describe("the dot's pink", () => {
    it("is the same in the stylesheet as in core/wordmark, in both themes", () => {
        const css = readFileSync(new URL("../app/app.css", import.meta.url), "utf8");
        const values = [...css.matchAll(/--color-brand-dot:\s*([^;]+);/g)].map(([, value]) =>
            value?.trim().toLowerCase(),
        );
        expect(values.length).toBeGreaterThanOrEqual(2);
        for (const value of values) expect(value).toBe(DOT);
    });
});
