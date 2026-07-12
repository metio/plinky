// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// Curated composer credits for pieces the corpora label only "Traditional" or
// "Anonymous": the sources carry no origin data, so each entry here is
// hand-researched — the tune's real composer where one is documented, or the
// tradition it comes from with its earliest known publication. Keyed by song id
// (a notes-only fingerprint), so re-imports and metadata churn never detach an
// entry. Applied by dev/enrich-credits.mjs to the manifest AND the .mxl's own
// metadata; only pieces someone verified belong here — an unresearched
// "Traditional" stays plain "Traditional" rather than gaining invented history.
export const CREDIT_OVERRIDES = {
    // Documented composers hiding behind a "Traditional" label.
    u3FyQod2WQFM: "Franz Xaver Gruber (1818)",
    hlUFdUqEEkcJ: "Joseph Parry (1875)",
    yQxQmdvW71zY: "Quirino Mendoza y Cortés (1882)",
    aZSWdZeRKnuA: "Mildred J. Hill & Patty S. Hill (1893) — “Good Morning to All”",

    // Traditions with a documented origin.
    ARc0pONVwLU4: "Traditional — English ballad, first registered 1580",
    "4WbX6ARMeAIm": "Traditional — Welsh air “Nos Galan” (16th c.)",
    c0OPnnRQgue3: "Traditional — Welsh march, first published 1794",
    KiG6eTXk1r0l: "Traditional — Welsh lullaby, first printed 1794",
    EhxD8o4X18DP: "Traditional — Irish jig (18th c.)",
    TywrTJgCgfBT: "Traditional — German folk song (18th c.)",
    Lym8lYIj52n9: "Traditional — French carol (15th c.)",
    tCjF3Sn7DpFx: "Traditional — Provençal carol “La Marche des Rois” (18th c.)",
    nVyLSJWhBhER: "Traditional — French-Canadian, first published 1879",
    pwhwiOvdnR0K: "Traditional — Irish “Londonderry Air”, first published 1855",
    VuTPIs71sC2d: "Traditional — Irish (19th c.)",
    "1RGKOBImC9WS": "Traditional — Irish ballad (17th–18th c.)",
    cfJHYn9OTFGB: "Traditional — Irish ballad (19th c.)",
    q6b9Re1ClpMD: "Traditional — English carol, words 18th c.",
    "38bkMfVfQgZZ": "Traditional — North American folk song (1870s–80s)",
    FrZIQUoilhRt: "Traditional — Appalachian fiddle tune (19th c.)",
    hCTp08284WNo: "Traditional — American spiritual (early 19th c.)",
    mU87RXSEPGai: "Traditional — American spiritual",
    "0TXjEKH1QaLy": "Traditional — American nursery rhyme, first published 1910",
    YccZLOQz7eF0: "Traditional — singing game of German origin (19th c.)",
    v8KncKyxj1px: "Traditional — American round, first published 1852",
    "6SCeCjHV2U3b": "Traditional — sea shanty (19th c.)",
    pMfyrI9CPM6t: "Traditional — Georgia Sea Islands work song",
    dnQ4dwPejx1x: "Traditional — Venetian air (19th c.)",
};
