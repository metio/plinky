// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { DOMParser } from "linkedom";
import type { XmlCodec } from "../core/xml.ts";

// The XmlCodec for the Node import tooling: linkedom stands in for the browser's
// DOMParser so core's notation functions (difficulty grading, transposition) run
// under tsx without installing a DOM global. The import scripts only parse; a
// linkedom document serializes through its own toString, so serialize is provided
// for parity with the browser adapter without pulling in a separate serializer.
export const linkedomXmlCodec: XmlCodec = {
    parse(xml) {
        try {
            // linkedom's Document exposes the query surface core uses; the DOM-lib
            // types differ nominally, so bridge them at this single boundary.
            // linkedom parses application/xml but does not list it in the mime union its
            // types accept, so the argument is widened at the same boundary the return is.
            return new DOMParser().parseFromString(
                xml,
                "application/xml" as "text/xml",
            ) as unknown as Document;
        } catch {
            return null;
        }
    },
    serialize(doc) {
        return String(doc as unknown as { toString(): string });
    },
};
