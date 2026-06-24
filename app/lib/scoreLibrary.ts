// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The curated public-domain MusicXML scores, bundled from the scores/ directory.
// Title and composer come from each file's own metadata, so no sidecar is needed.
// (User-imported scores will layer on top of this in local storage later.)
export type Score = {
    id: string;
    title: string;
    composer: string;
    xml: string;
};

const files = import.meta.glob("../../scores/*.musicxml", {
    query: "?raw",
    import: "default",
    eager: true,
}) as Record<string, string>;

function readMeta(xml: string): { title: string; composer: string } {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    const title =
        doc.querySelector("work-title")?.textContent?.trim() ||
        doc.querySelector("movement-title")?.textContent?.trim() ||
        "Untitled";
    const composer = doc.querySelector('creator[type="composer"]')?.textContent?.trim() || "";
    return { title, composer };
}

export function loadScores(): Score[] {
    return Object.entries(files)
        .map(([path, xml]) => {
            const id = (path.split("/").pop() ?? path).replace(/\.musicxml$/, "");
            return { id, ...readMeta(xml), xml };
        })
        .sort((a, b) => a.title.localeCompare(b.title));
}
