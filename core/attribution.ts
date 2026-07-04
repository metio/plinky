// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Provenance for a catalogue piece: which licence it carries and where it came
// from. Surfacing this is both courtesy and obligation — a CC-BY/CC-BY-SA piece
// may only be redistributed *with* visible credit, so the attribution a piece
// needs is computed here once and shown wherever the piece is played.

export type LicenseInfo = {
    id: string;
    // Short human label, e.g. "CC BY-SA 4.0".
    label: string;
    // The licence deed the badge links to.
    url: string;
    // CC-BY family (incl. NC/ND/SA variants) require crediting the creator; CC0
    // and public-domain dedications do not.
    requiresAttribution: boolean;
    // A public-domain dedication rather than a permissions licence — shown as
    // "Public domain" rather than a bare licence code.
    publicDomain: boolean;
    // False for the NonCommercial (NC) variants: a paid tier must exclude these
    // pieces. The single source of truth for that gate — no separate manifest flag.
    commercialUse: boolean;
};

const DEED = "https://creativecommons.org/";

// The Creative Commons licences the catalogue accepts. The submission form's
// dropdown mirrors this set; anything outside it renders without a badge.
const LICENSES: Record<string, Omit<LicenseInfo, "id">> = {
    "CC0-1.0": {
        label: "CC0 1.0",
        url: `${DEED}publicdomain/zero/1.0/`,
        requiresAttribution: false,
        publicDomain: true,
        commercialUse: true,
    },
    "CC-BY-4.0": {
        label: "CC BY 4.0",
        url: `${DEED}licenses/by/4.0/`,
        requiresAttribution: true,
        publicDomain: false,
        commercialUse: true,
    },
    "CC-BY-3.0": {
        label: "CC BY 3.0",
        url: `${DEED}licenses/by/3.0/`,
        requiresAttribution: true,
        publicDomain: false,
        commercialUse: true,
    },
    "CC-BY-2.5": {
        label: "CC BY 2.5",
        url: `${DEED}licenses/by/2.5/`,
        requiresAttribution: true,
        publicDomain: false,
        commercialUse: true,
    },
    "CC-BY-SA-4.0": {
        label: "CC BY-SA 4.0",
        url: `${DEED}licenses/by-sa/4.0/`,
        requiresAttribution: true,
        publicDomain: false,
        commercialUse: true,
    },
    "CC-BY-SA-3.0": {
        label: "CC BY-SA 3.0",
        url: `${DEED}licenses/by-sa/3.0/`,
        requiresAttribution: true,
        publicDomain: false,
        commercialUse: true,
    },
    "CC-BY-SA-2.5": {
        label: "CC BY-SA 2.5",
        url: `${DEED}licenses/by-sa/2.5/`,
        requiresAttribution: true,
        publicDomain: false,
        commercialUse: true,
    },
    "CC-BY-NC-4.0": {
        label: "CC BY-NC 4.0",
        url: `${DEED}licenses/by-nc/4.0/`,
        requiresAttribution: true,
        publicDomain: false,
        commercialUse: false,
    },
    "CC-BY-ND-4.0": {
        label: "CC BY-ND 4.0",
        url: `${DEED}licenses/by-nd/4.0/`,
        requiresAttribution: true,
        publicDomain: false,
        commercialUse: true,
    },
    "CC-BY-NC-SA-4.0": {
        label: "CC BY-NC-SA 4.0",
        url: `${DEED}licenses/by-nc-sa/4.0/`,
        requiresAttribution: true,
        publicDomain: false,
        commercialUse: false,
    },
};

export type SourceInfo = {
    id: string;
    label: string;
    url: string;
    // The person to credit for the engraving, when the source's licence requires
    // attribution to someone other than the composer (e.g. a modern editor).
    credit?: string;
};

// Where catalogue pieces are sourced from. A song carries a `source` id; the
// label and provenance link are looked up here so the data stays compact.
const SOURCES: Record<string, Omit<SourceInfo, "id">> = {
    pdmx: { label: "PDMX", url: "https://github.com/pnlong/PDMX" },
    "openscore-lieder": {
        label: "OpenScore Lieder",
        url: "https://github.com/OpenScore/Lieder",
    },
    // The KernScores keyboard corpora, engraved by Craig Stuart Sapp and licensed
    // CC-BY-NC-SA — so the editor is credited and the pieces are non-commercial.
    kern: {
        label: "KernScores",
        url: "https://github.com/craigsapp",
        credit: "Craig Stuart Sapp",
    },
    // Bach's 370 four-part chorales, reduced to a two-staff piano grand staff — same
    // KernScores editor and CC-BY-NC-SA licence as the other kern corpora.
    "bach-chorales": {
        label: "KernScores",
        url: "https://github.com/craigsapp/bach-370-chorales",
        credit: "Craig Stuart Sapp",
    },
    // Public-domain solo-keyboard pieces from the Mutopia Project (CC0, no credit
    // required), converted from their LilyPond sources.
    mutopia: { label: "Mutopia Project", url: "https://www.mutopiaproject.org" },
    // Solo-piano classical scores from the ASAP dataset (CC-BY-NC-SA — non-commercial,
    // and the project is credited).
    asap: {
        label: "ASAP Dataset",
        url: "https://github.com/fosfrancesco/asap-dataset",
        credit: "the ASAP Dataset authors",
    },
    // Solo-piano corpora from DCMLab (Digital and Cognitive Musicology Lab, EPFL),
    // CC-BY-NC-SA — non-commercial, and the corpus editors are credited.
    dcml: {
        label: "DCMLab",
        url: "https://github.com/DCMLab",
        credit: "the DCMLab corpus editors",
    },
    // Public-domain choral editions from CPDL (ChoralWiki), reduced to piano. Only the
    // CC0/CC-BY/CC-BY-SA/PD editions are harvested; the CC variants credit the editor.
    cpdl: {
        label: "CPDL",
        url: "https://www.cpdl.org",
        credit: "the CPDL editors",
    },
};

// The default source for catalogue songs: the whole shipped catalogue is imported
// from PDMX, so a song without an explicit `source` is from there.
export const DEFAULT_SONG_SOURCE = "pdmx";

// Catalogue .mxl are stored grouped by licence — public/songs/<licence-dir>/<id>.mxl —
// so REUSE annotates each group with one static glob while the id itself stays a pure
// content fingerprint (no licence baked in). The dir is the SPDX id lowercased.
export function licenseDir(license: string | undefined): string {
    return (license || "cc0-1.0").toLowerCase();
}

export function licenseInfo(id: string | undefined): LicenseInfo | null {
    if (!id) {
        return null;
    }
    const deed = LICENSES[id];
    return deed ? { id, ...deed } : null;
}

export function sourceInfo(id: string | undefined): SourceInfo | null {
    if (!id) {
        return null;
    }
    const source = SOURCES[id];
    return source ? { id, ...source } : null;
}

export type Attribution = {
    composer: string;
    license: LicenseInfo | null;
    source: SourceInfo | null;
};

// The provenance to display for a piece: its composer, the resolved licence, and
// the resolved source. License/source are null when unknown (e.g. a bundled demo
// or a generated exercise), letting the UI omit them.
export function attributionFor(piece: {
    composer?: string;
    license?: string;
    source?: string;
}): Attribution {
    return {
        composer: piece.composer ?? "",
        license: licenseInfo(piece.license),
        source: sourceInfo(piece.source),
    };
}
