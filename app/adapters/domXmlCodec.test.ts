// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD
// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { domXmlCodec } from "./domXmlCodec";

describe("domXmlCodec", () => {
    it("parses well-formed XML into a queryable document", () => {
        const doc = domXmlCodec.parse(
            `<?xml version="1.0"?><score-partwise><work><work-title>Twinkle</work-title></work></score-partwise>`,
        );
        expect(doc?.querySelector("work-title")?.textContent).toBe("Twinkle");
    });

    it("returns null for malformed XML — DOMParser embeds a parsererror instead of throwing", () => {
        expect(domXmlCodec.parse("<unclosed")).toBeNull();
        expect(domXmlCodec.parse("<a><b></a>")).toBeNull();
        expect(domXmlCodec.parse("not xml at all")).toBeNull();
    });

    it("returns null for the empty string rather than a phantom document", () => {
        expect(domXmlCodec.parse("")).toBeNull();
    });

    it("round-trips a document through serialize", () => {
        const xml = `<score-partwise><part id="P1"/></score-partwise>`;
        const doc = domXmlCodec.parse(xml);
        expect(doc).not.toBeNull();
        expect(domXmlCodec.serialize(doc as Document)).toContain('<part id="P1"/>');
    });
});
