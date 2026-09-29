// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
    attributionFor,
    DEFAULT_SONG_SOURCE,
    licenseDir,
    licenseInfo,
    sourceInfo,
} from "./attribution";

// What a piece may be redistributed under, and who must be credited when it is. A
// CC-BY or CC-BY-SA score may only be shown with visible credit, so a licence that
// reads as unknown is a piece shown without the credit its licence requires — and an
// NC flag set wrongly is a piece a paid tier must not carry.
//
// The flags are what the rest of the app decides on, and the licence id already says
// what they should be: the strings "-NC-" and "-ND-" are the licence's own statement
// about commercial use and derivatives. Pinning the flags to the id is what keeps a
// hand-typed table row from quietly admitting a piece the catalogue may not carry.

// Every licence the catalogue accepts, read out of the table rather than listed again.
const KNOWN = [
    "CC0-1.0",
    "CC-BY-4.0",
    "CC-BY-3.0",
    "CC-BY-2.5",
    "CC-BY-SA-4.0",
    "CC-BY-SA-3.0",
    "CC-BY-SA-2.5",
    "CC-BY-NC-4.0",
    "CC-BY-ND-4.0",
].filter((id) => licenseInfo(id) !== null);

// Strings that resolve up the prototype chain to something truthy with none of a
// licence's fields — the shape a restored backup or a shared score pack can carry.
const HAZARDS = ["constructor", "toString", "valueOf", "hasOwnProperty", "__proto__"];

describe("the licences the catalogue accepts", () => {
    it("knows the ones it ships, and nothing else", () => {
        expect(KNOWN.length).toBeGreaterThan(0);
        fc.assert(
            fc.property(fc.string({ maxLength: 20 }), (id) => {
                fc.pre(!KNOWN.includes(id));

                expect(licenseInfo(id)).toBeNull();
            }),
        );
        for (const hazard of HAZARDS) {
            // Truthy-but-wrong is the dangerous answer: every caller reads truthy as
            // "this licence is known" and would render a badge with no licence behind it.
            expect(licenseInfo(hazard)).toBeNull();
            expect(sourceInfo(hazard)).toBeNull();
        }
        expect(licenseInfo(undefined)).toBeNull();
        expect(sourceInfo(undefined)).toBeNull();
    });

    it("says what the licence id itself says", () => {
        for (const id of KNOWN) {
            const license = licenseInfo(id);
            if (!license) {
                throw new Error(`${id} is not in the table`);
            }

            expect(license.id).toBe(id);
            expect(license.label.trim()).not.toBe("");
            expect(license.name.trim()).not.toBe("");
            expect(license.url).toMatch(/^https:\/\/creativecommons\.org\//);
            // NonCommercial and NoDerivatives are written into the id, and the flags
            // the app gates on must agree with it.
            expect(license.commercialUse).toBe(!id.includes("-NC"));
            expect(license.allowsDerivatives).toBe(!id.includes("-ND"));
            // A BY licence asks for credit; a public-domain dedication does not, and
            // nothing can be both.
            expect(license.requiresAttribution).toBe(id.startsWith("CC-BY"));
            expect(license.publicDomain).toBe(!id.startsWith("CC-BY"));
            expect(license.publicDomain && license.requiresAttribution).toBe(false);
        }
    });

    it("files a piece under a directory name that is safe in a path", () => {
        fc.assert(
            fc.property(fc.constantFrom(...KNOWN), (id) => {
                const dir = licenseDir(id);

                expect(dir).toBe(id.toLowerCase());
                expect(dir).toMatch(/^[a-z0-9.-]+$/);
                expect(licenseDir(id)).toBe(dir);
            }),
        );
    });
});

describe("the provenance shown for a piece", () => {
    const arbPiece = fc.record(
        {
            composer: fc.oneof(fc.string({ maxLength: 20 }), fc.constant(undefined)),
            license: fc.oneof(fc.constantFrom(...KNOWN, ...HAZARDS), fc.constant(undefined)),
            source: fc.oneof(
                fc.constantFrom(DEFAULT_SONG_SOURCE, "cpdl", "nope", ...HAZARDS),
                fc.constant(undefined),
            ),
            credit: fc.oneof(fc.string({ maxLength: 20 }), fc.constant(undefined)),
        },
        { requiredKeys: [] },
    );

    it("resolves whatever a piece carries, and never invents a licence", () => {
        fc.assert(
            fc.property(arbPiece, (piece) => {
                const attribution = attributionFor(piece);

                expect(typeof attribution.composer).toBe("string");
                expect(attribution.license).toEqual(licenseInfo(piece.license));
                if (attribution.license) {
                    expect(KNOWN).toContain(attribution.license.id);
                }
                if (attribution.source) {
                    expect(attribution.source.label.trim()).not.toBe("");
                }
            }),
        );
    });

    it("lets the edition's own credit stand in for the source's", () => {
        fc.assert(
            fc.property(arbPiece, (piece) => {
                const { source } = attributionFor(piece);

                if (source === null) {
                    // No source resolved, so there is no edition to credit: a credit
                    // riding alone would name the engraver of nothing.
                    return;
                }
                // A source credits its editors as a body where the edition names
                // nobody; where the piece names someone, that is who engraved it.
                expect(source.credit).toBe(piece.credit ?? sourceInfo(piece.source)?.credit);
            }),
        );
    });
});
