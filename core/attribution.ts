// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

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
    // False for the NoDerivatives (ND) variant: the catalogue adds fingering and
    // grading (a derivative), so a no-derivatives licence can't be admitted. Combined
    // with commercialUse, this decides whether a piece is eligible for the catalogue.
    allowsDerivatives: boolean;
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
        allowsDerivatives: true,
    },
    "CC-BY-4.0": {
        label: "CC BY 4.0",
        url: `${DEED}licenses/by/4.0/`,
        requiresAttribution: true,
        publicDomain: false,
        commercialUse: true,
        allowsDerivatives: true,
    },
    "CC-BY-3.0": {
        label: "CC BY 3.0",
        url: `${DEED}licenses/by/3.0/`,
        requiresAttribution: true,
        publicDomain: false,
        commercialUse: true,
        allowsDerivatives: true,
    },
    "CC-BY-2.5": {
        label: "CC BY 2.5",
        url: `${DEED}licenses/by/2.5/`,
        requiresAttribution: true,
        publicDomain: false,
        commercialUse: true,
        allowsDerivatives: true,
    },
    "CC-BY-SA-4.0": {
        label: "CC BY-SA 4.0",
        url: `${DEED}licenses/by-sa/4.0/`,
        requiresAttribution: true,
        publicDomain: false,
        commercialUse: true,
        allowsDerivatives: true,
    },
    "CC-BY-SA-3.0": {
        label: "CC BY-SA 3.0",
        url: `${DEED}licenses/by-sa/3.0/`,
        requiresAttribution: true,
        publicDomain: false,
        commercialUse: true,
        allowsDerivatives: true,
    },
    "CC-BY-SA-2.5": {
        label: "CC BY-SA 2.5",
        url: `${DEED}licenses/by-sa/2.5/`,
        requiresAttribution: true,
        publicDomain: false,
        commercialUse: true,
        allowsDerivatives: true,
    },
    "CC-BY-NC-4.0": {
        label: "CC BY-NC 4.0",
        url: `${DEED}licenses/by-nc/4.0/`,
        requiresAttribution: true,
        publicDomain: false,
        commercialUse: false,
        allowsDerivatives: true,
    },
    "CC-BY-ND-4.0": {
        label: "CC BY-ND 4.0",
        url: `${DEED}licenses/by-nd/4.0/`,
        requiresAttribution: true,
        publicDomain: false,
        commercialUse: true,
        allowsDerivatives: false,
    },
    "CC-BY-NC-SA-4.0": {
        label: "CC BY-NC-SA 4.0",
        url: `${DEED}licenses/by-nc-sa/4.0/`,
        requiresAttribution: true,
        publicDomain: false,
        commercialUse: false,
        allowsDerivatives: true,
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
    // The demos that ship inside the app: our own transcriptions of music long out of
    // copyright, dedicated to the public domain. They are credited like everything else —
    // a catalogue that names its sources cannot leave its own two pieces anonymous.
    plinky: { label: "Plinky", url: "https://github.com/metio/plinky/tree/main/scores" },
    pdmx: { label: "PDMX", url: "https://github.com/pnlong/PDMX" },
    "openscore-lieder": {
        label: "OpenScore Lieder",
        url: "https://github.com/OpenScore/Lieder",
    },
    // Public-domain solo-keyboard pieces from the Mutopia Project (CC0, no credit
    // required), converted from their LilyPond sources.
    mutopia: { label: "Mutopia Project", url: "https://www.mutopiaproject.org" },
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

// Both lookups ask whether the table OWNS the key rather than whether indexing it
// yields something. A piece's licence and source are plain strings that reach here from
// a restored backup or a shared score pack, and a handful of strings — "constructor",
// "toString", "valueOf" — resolve up the prototype chain to a truthy value with none of
// the fields a licence has. Every caller reads truthy as "this licence is known", so the
// badge would render an empty link and the video credit would drop the licence line
// entirely: a piece redistributed without the credit its licence requires, which is the
// one outcome this module exists to prevent. An unrecognised licence must read as
// unknown, and unknown is null.

export function licenseInfo(id: string | undefined): LicenseInfo | null {
    if (!id || !Object.hasOwn(LICENSES, id)) {
        return null;
    }
    return { id, ...LICENSES[id]! };
}

export function sourceInfo(id: string | undefined): SourceInfo | null {
    if (!id || !Object.hasOwn(SOURCES, id)) {
        return null;
    }
    return { id, ...SOURCES[id]! };
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
