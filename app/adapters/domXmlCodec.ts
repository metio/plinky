// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { XmlCodec } from "../../core/xml";

// The browser implementation of the XML seam. DOMParser never throws on bad
// input — it embeds a <parsererror> element instead — so the malformed-input
// check lives here once, and every consumer of the codec gets null for a
// document that did not parse.
export const domXmlCodec: XmlCodec = {
    parse(xml) {
        try {
            const doc = new DOMParser().parseFromString(xml, "application/xml");
            return doc.getElementsByTagName("parsererror").length > 0 ? null : doc;
        } catch {
            return null;
        }
    },
    serialize(doc) {
        return new XMLSerializer().serializeToString(doc);
    },
};
