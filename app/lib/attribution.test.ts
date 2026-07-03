// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { describe, expect, it } from "vitest";
import { attributionFor, licenseInfo, sourceInfo } from "./attribution";

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

    it("carries an engraver credit for a source whose licence needs one", () => {
        expect(sourceInfo("kern")).toMatchObject({
            id: "kern",
            label: "KernScores",
            credit: "Craig Stuart Sapp",
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
