// SPDX-FileCopyrightText: The Klimpi Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { framedMark, markImage, picture } from "./brandGroup.mjs";

// Every picture in the brand kit is sized from its artwork's aspect: a layout names a
// height and the width follows. Get the aspect wrong and nothing fails — the kit renders,
// the gates pass, and the mark is simply the wrong shape in every file that sets it. That
// is how the lockup came to be squashed to a third of its width in the README banner, with
// the letters run together, for as long as it took somebody to look at the picture.
//
// So the two shapes the kit actually ships are pinned here: the square icon and the wide
// lockup.

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path: string) => readFileSync(join(root, path));
const png = (path: string) => markImage(read(path), "image/png");

describe("the artwork's proportions", () => {
    it("reads a PNG's own width and height, not a guess", () => {
        const lockup = png("brand/klimpi-mark.png");
        // 1024 x 339: the wordmark, three times as wide as it is tall.
        expect(lockup.aspect).toBeGreaterThan(2.9);
        expect(lockup.aspect).toBeLessThan(3.2);
    });

    it("reads the square masters as square", () => {
        for (const file of ["brand/klimpi-icon.png", "brand/klimpi-keys.png"]) {
            expect(png(file).aspect).toBeCloseTo(1, 5);
        }
    });

    it("reads an SVG from its viewBox", () => {
        const name = markImage(read("brand/name-white.svg"));
        expect(name.aspect).toBeGreaterThan(2);
    });

    it("falls back to a square only for bytes it cannot measure", () => {
        expect(markImage(Buffer.from("not a png at all"), "image/png").aspect).toBe(1);
    });
});

describe("a picture", () => {
    it("takes its width from the height it is given and its own aspect", () => {
        const wide = picture({ src: "x", aspect: 3 }, 100);
        expect(wide).toContain("height:100px");
        expect(wide).toContain("width:300px");
    });
});

describe("the white plate", () => {
    const square = framedMark({ src: "x", aspect: 1 }, "#fff");
    const wide = framedMark({ src: "x", aspect: 3 }, "#fff");

    it("is exactly the size a square mark asks for", () => {
        // Layouts position plates against this number, and a plate a pixel off its asked-for
        // size moves every picture that sets one.
        expect(square(300)).toContain("width:300px;height:300px");
        expect(square(150)).toContain("width:150px;height:150px");
    });

    it("grows sideways for artwork wider than it is tall, instead of cropping it", () => {
        const plate = wide(300);
        const width = Number(/width:(\d+)px/.exec(plate)?.[1]);
        expect(width).toBeGreaterThan(300 * 2.5);
        // And the artwork inside still fits within it, frame included.
        const inner = Number(/height:(\d+)px;width:(\d+)px/.exec(plate)?.[2]);
        expect(inner).toBeLessThan(width);
    });

    it("keeps one corner at any width, rather than an ellipse", () => {
        expect(square(300)).toContain("border-radius:26%");
        expect(wide(300)).toContain("border-radius:78px");
    });
});
