// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// A milestone share card: a branded 1080×1350 portrait announcing an achievement —
// a grade reached, a long streak — to rasterise to PNG and share to a feed. Pure
// markup so it can be tested and rasterised in the browser without a DOM. No emoji in
// the SVG: system emoji rasterise unreliably through canvas, so the emoji rides in
// the share *text* instead, where the platform renders it.

export type MilestoneCard = {
    // The achievement, large and central — "Grade 5", "100-day streak".
    title: string;
    // A supporting stat under it — "Skill 1840". Optional.
    detail?: string;
};

function escapeXml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

export function svgMilestone({ title, detail }: MilestoneCard): string {
    const width = 1080;
    const height = 1350;
    const detailText = detail
        ? `<text x="${width / 2}" y="800" fill="#a5b4fc" font-family="system-ui,sans-serif" font-size="56" text-anchor="middle">${escapeXml(detail)}</text>`
        : "";
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\
<rect width="${width}" height="${height}" fill="#0f172a"/>\
<defs><linearGradient id="brand" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6366f1"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient></defs>\
<rect x="0" y="0" width="${width}" height="14" fill="url(#brand)"/>\
<text x="${width / 2}" y="150" fill="#94a3b8" font-family="system-ui,sans-serif" font-size="48" font-weight="600" text-anchor="middle">Plinky</text>\
<text x="${width / 2}" y="660" fill="#f8fafc" font-family="system-ui,sans-serif" font-size="160" font-weight="800" text-anchor="middle">${escapeXml(title)}</text>\
${detailText}\
<text x="${width / 2}" y="1270" fill="#94a3b8" font-family="system-ui,sans-serif" font-size="40" text-anchor="middle">plinky.fun</text>\
</svg>`;
}
