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

    it("carries the licence in every file", () => {
        for (const name of readdirSync("brand/mark").filter((file) => file.endsWith(".svg"))) {
            expect(read(name), name).toMatch(
                /^<!--\nSPDX-FileCopyrightText: The Plinky Authors\nSPDX-License-Identifier: AGPL-3\.0-or-later\n-->/,
            );
        }
    });
});
