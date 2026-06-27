// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// A self-contained HTML page wrapping just the rendered score's SVG, for the print
// window. Isolating the staff from the rest of the app gives a clean printout (or
// "Save as PDF" from the browser's print dialog) without the controls and chrome.
export function buildPrintDocument(svg: string, title: string): string {
    const safeTitle = title.replace(/[<>&]/g, "");
    return `<!doctype html><html><head><meta charset="utf-8"><title>${safeTitle}</title><style>html,body{margin:0;padding:16px;background:#fff}svg{width:100%;height:auto}@media print{body{padding:0}}</style></head><body>${svg}</body></html>`;
}

// A title reduced to a safe, lowercase file stem for a download — spaces and
// punctuation collapse to single hyphens, so "Für Elise!" becomes "f-r-elise".
export function fileStem(title: string): string {
    const stem = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return stem || "score";
}
