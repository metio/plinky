// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// A self-contained HTML page wrapping just the rendered score's SVG, for the print
// window. Isolating the staff from the rest of the app gives a clean printout (or
// "Save as PDF" from the browser's print dialog) without the controls and chrome.
export function buildPrintDocument(svg: string, title: string): string {
    const safeTitle = title.replace(/[<>&]/g, "");
    return `<!doctype html><html><head><meta charset="utf-8"><title>${safeTitle}</title><style>html,body{margin:0;padding:16px;background:#fff}svg{width:100%;height:auto}@media print{body{padding:0}}</style></head><body>${svg}</body></html>`;
}

// Print the standalone page through a hidden iframe instead of a pop-up window.
// Mobile browsers and pop-up blockers routinely refuse window.open, which would
// otherwise leave Print doing nothing; an iframe needs no new window, so the staff
// still reaches the browser's print dialog. The frame removes itself once printing
// finishes (or after a safety delay, in case afterprint never fires).
export function printViaIframe(html: string): void {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.position = "fixed";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.visibility = "hidden";
    document.body.appendChild(iframe);
    const frameWindow = iframe.contentWindow;
    if (!frameWindow) {
        iframe.remove();
        return;
    }
    frameWindow.document.open();
    frameWindow.document.write(html);
    frameWindow.document.close();
    const cleanup = () => iframe.remove();
    frameWindow.addEventListener("afterprint", cleanup);
    window.setTimeout(cleanup, 10_000);
    frameWindow.focus();
    frameWindow.print();
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
