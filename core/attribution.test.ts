// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { attributionFor, licenseDir, licenseInfo, sourceInfo } from "./attribution";

describe("licenseInfo", () => {
    it("resolves CC0 as a public-domain dedication needing no attribution", () => {
        const info = licenseInfo("CC0-1.0");
        expect(info).toMatchObject({
            id: "CC0-1.0",
            publicDomain: true,
            requiresAttribution: false,
        });
        expect(info?.url).toContain("creativecommons.org/publicdomain/zero/1.0");
    });

    it("flags the CC-BY family as requiring attribution and not public domain", () => {
        for (const id of [
            "CC-BY-4.0",
            "CC-BY-SA-4.0",
            "CC-BY-NC-4.0",
            "CC-BY-ND-4.0",
            "CC-BY-NC-SA-4.0",
        ]) {
            const info = licenseInfo(id);
            expect(info, id).not.toBeNull();
            expect(info?.requiresAttribution, id).toBe(true);
            expect(info?.publicDomain, id).toBe(false);
            expect(info?.url, id).toContain("creativecommons.org/licenses/");
        }
    });

    it("matches the licence allowlist offered by the submission form", () => {
        // The score-submission issue form's dropdown must stay in lockstep with
        // the licences the app can render a badge for.
        const offered = [
            "CC0-1.0",
            "CC-BY-4.0",
            "CC-BY-SA-4.0",
            "CC-BY-NC-4.0",
            "CC-BY-ND-4.0",
            "CC-BY-NC-SA-4.0",
        ];
        for (const id of offered) {
            expect(licenseInfo(id), id).not.toBeNull();
        }
    });

    it("marks the NonCommercial variants as not permitting commercial use", () => {
        // The single source of truth a future paid tier reads to exclude a piece.
        expect(licenseInfo("CC-BY-NC-4.0")?.commercialUse).toBe(false);
        expect(licenseInfo("CC-BY-NC-SA-4.0")?.commercialUse).toBe(false);
        for (const id of ["CC0-1.0", "CC-BY-4.0", "CC-BY-SA-4.0"]) {
            expect(licenseInfo(id)?.commercialUse, id).toBe(true);
        }
    });

    it("marks the NoDerivatives variant as not permitting derivatives", () => {
        // The catalogue adds fingering and grading, so ND pieces are ineligible; every
        // other licence allows the derivative editing that makes them.
        expect(licenseInfo("CC-BY-ND-4.0")?.allowsDerivatives).toBe(false);
        for (const id of [
            "CC0-1.0",
            "CC-BY-4.0",
            "CC-BY-SA-4.0",
            "CC-BY-NC-4.0",
            "CC-BY-NC-SA-4.0",
        ]) {
            expect(licenseInfo(id)?.allowsDerivatives, id).toBe(true);
        }
    });

    it("returns null for an unknown or missing id", () => {
        expect(licenseInfo("MIT")).toBeNull();
        expect(licenseInfo("")).toBeNull();
        expect(licenseInfo(undefined)).toBeNull();
    });
});

describe("sourceInfo", () => {
    it("resolves the PDMX source to a label and provenance link", () => {
        expect(sourceInfo("pdmx")).toMatchObject({ id: "pdmx", label: "PDMX" });
        expect(sourceInfo("pdmx")?.url).toMatch(/^https:\/\//);
    });

    it("carries an editor credit for a source whose licence needs one", () => {
        expect(sourceInfo("cpdl")).toMatchObject({
            id: "cpdl",
            label: "CPDL",
            credit: "the CPDL editors",
        });
        // CC0 sources need no separate credit.
        expect(sourceInfo("pdmx")?.credit).toBeUndefined();
    });

    it("returns null for an unknown or missing source", () => {
        expect(sourceInfo("imslp")).toBeNull();
        expect(sourceInfo(undefined)).toBeNull();
    });
});

describe("attributionFor", () => {
    it("derives composer, licence, and source together", () => {
        const attribution = attributionFor({
            composer: "Trad.",
            license: "CC0-1.0",
            source: "pdmx",
        });
        expect(attribution.composer).toBe("Trad.");
        expect(attribution.license?.id).toBe("CC0-1.0");
        expect(attribution.source?.label).toBe("PDMX");
    });

    it("omits licence and source when absent, keeping an empty composer", () => {
        const attribution = attributionFor({});
        expect(attribution).toEqual({ composer: "", license: null, source: null });
    });
});

describe("licenseDir", () => {
    it("maps an SPDX id to its lowercased storage directory", () => {
        expect(licenseDir("CC0-1.0")).toBe("cc0-1.0");
        expect(licenseDir("CC-BY-4.0")).toBe("cc-by-4.0");
        expect(licenseDir("CC-BY-SA-3.0")).toBe("cc-by-sa-3.0");
        expect(licenseDir("CC-BY-NC-SA-4.0")).toBe("cc-by-nc-sa-4.0");
    });

    it("falls back to CC0 for an absent licence, so a file always has a home", () => {
        expect(licenseDir(undefined)).toBe("cc0-1.0");
        expect(licenseDir("")).toBe("cc0-1.0");
    });
});

describe("a licence or source the tables do not own", () => {
    // Every one of these resolves up the prototype chain to a truthy value. Callers read
    // truthy as "known", so any of them would render a badge with no label and no link,
    // and drop the licence from the burnt-in video credit.
    const INHERITED = [
        "constructor",
        "toString",
        "valueOf",
        "hasOwnProperty",
        "isPrototypeOf",
        "propertyIsEnumerable",
        "toLocaleString",
        "__proto__",
        "__defineGetter__",
        "__lookupGetter__",
    ];

    it.each(INHERITED)("reads %s as an unknown licence", (id) => {
        expect(licenseInfo(id)).toBeNull();
    });

    it.each(INHERITED)("reads %s as an unknown source", (id) => {
        expect(sourceInfo(id)).toBeNull();
    });

    it("leaves a piece carrying one with no licence to display", () => {
        const attribution = attributionFor({ composer: "Anon.", license: "constructor" });
        expect(attribution.license).toBeNull();
        expect(attribution.source).toBeNull();
    });

    it("still resolves every real licence and source", () => {
        for (const id of [
            "CC0-1.0",
            "CC-BY-4.0",
            "CC-BY-3.0",
            "CC-BY-2.5",
            "CC-BY-SA-4.0",
            "CC-BY-SA-3.0",
            "CC-BY-SA-2.5",
            "CC-BY-NC-4.0",
            "CC-BY-ND-4.0",
            "CC-BY-NC-SA-4.0",
        ]) {
            expect(licenseInfo(id), id).not.toBeNull();
        }
        for (const id of ["pdmx", "openscore-lieder", "mutopia", "cpdl"]) {
            expect(sourceInfo(id), id).not.toBeNull();
        }
    });
});

describe("the source list matches what the catalogue may admit", () => {
    it("offers no source whose corpus the licence gate refuses", () => {
        // The catalogue admits only commercially usable, derivative-friendly pieces, so a
        // NonCommercial corpus can never reach a reader — listing one would credit an
        // editor for material this catalogue does not carry.
        for (const id of ["kern", "bach-chorales", "asap", "dcml"]) {
            expect(sourceInfo(id), id).toBeNull();
        }
    });
});
