// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { decodeIncipit } from "./incipit";
import { CARD_HEIGHT, CARD_WIDTH, pieceCardHtml, titleSize } from "./ogCard";

const OPTIONS = {
    palette: { paper: "#fff", ink: "#111", muted: "#666", accent: "#4915d2" },
    fonts: { display: "font-family:Fredoka", body: "font-family:Inter" },
    mark: "data:image/png;base64,AAAA",
    host: "plinky.fun",
};

describe("pieceCardHtml", () => {
    it("names the piece, its composer and the site, sized to the image", () => {
        const html = pieceCardHtml(
            {
                title: "Ode to Joy",
                composer: "Ludwig van Beethoven",
                incipit: decodeIncipit("G35q35q36q37q"),
            },
            OPTIONS,
        );
        expect(html).toContain(`width:${CARD_WIDTH}px;height:${CARD_HEIGHT}px`);
        expect(html).toContain(">Ode to Joy</div>");
        expect(html).toContain(">Ludwig van Beethoven</div>");
        expect(html).toContain(">plinky.fun</span>");
        expect(html).toContain('<img src="data:image/png;base64,AAAA"');
        // The opening bar, in the accent.
        expect(html).toContain("<svg ");
        expect(html).toContain('fill="#4915d2"');
    });

    it("leaves out what a piece lacks", () => {
        const html = pieceCardHtml({ title: "Greensleeves", composer: "", incipit: null }, OPTIONS);
        expect(html).not.toContain("<svg");
        expect(html.match(/font-family:Inter/g)).toHaveLength(1);
    });

    it("escapes a title that brings markup with it", () => {
        const html = pieceCardHtml(
            { title: 'Nocturne <Op. 9> "No. 2"', composer: "A & B", incipit: null },
            OPTIONS,
        );
        expect(html).toContain("Nocturne &lt;Op. 9&gt; &quot;No. 2&quot;");
        expect(html).toContain("A &amp; B");
    });
});

describe("titleSize", () => {
    it("sets a long title smaller so two lines hold it", () => {
        expect(titleSize("Ode to Joy")).toBeGreaterThan(titleSize("A".repeat(40)));
        expect(titleSize("A".repeat(40))).toBeGreaterThan(titleSize("A".repeat(90)));
    });
});
