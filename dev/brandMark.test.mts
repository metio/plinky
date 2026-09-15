// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The forms in brand/mark only place one drawing. `npm run mark -- --check` keeps the files
// current with their generator; these pin what the forms promise about that drawing.
const read = (name: string) => readFileSync(`brand/mark/${name}`, "utf8");
const tile = read("tile.svg");
// The drawing: everything the tile draws after its ground and its glow.
const art = tile.slice(
    tile.lastIndexOf('fill="url(#pg)"/>') + 'fill="url(#pg)"/>'.length,
    tile.indexOf("</svg>"),
);

describe("the vector mark", () => {
    it("draws the keys, the plink and its strike point", () => {
        expect(art).toContain('fill="#fdfdff"');
        expect(art).toContain('fill="#a836fe"');
    });

    it("sets the keys alone exactly as the tile draws them, with no ground and no glow", () => {
        const keys = read("keys.svg");
        expect(keys).toContain(art);
        expect(keys).not.toContain('fill="#3200af"');
        expect(keys).not.toContain('fill="url(#pg)"');
        expect(keys).not.toContain('<circle cx="50" cy="50"');
    });

    it("frames the tile in white, an eleventh of its width all round", () => {
        const framed = read("tile-framed.svg");
        expect(framed).toContain('viewBox="0 0 118.18 118.18"');
        expect(framed).toContain('<rect width="118.18" height="118.18" rx="31.09" fill="#fff"/>');
        expect(framed).toContain(
            `<g transform="translate(9.09 9.09)"><rect width="100" height="100" rx="22"`,
        );
        expect(framed).toContain(art);
    });

    it("sets the framed tile in the lockup for an indigo ground", () => {
        expect(read("lockup-indigo.svg")).toContain('rx="31.09" fill="#fff"');
        expect(read("lockup-light.svg")).not.toContain('fill="#fff"/><g');
    });

    it("carries the licence in every file", () => {
        for (const name of readdirSync("brand/mark").filter((file) => file.endsWith(".svg"))) {
            expect(read(name), name).toMatch(
                /^<!--\nSPDX-FileCopyrightText: The Plinky Authors\nSPDX-License-Identifier: AGPL-3\.0-or-later\n-->/,
            );
        }
    });
});
