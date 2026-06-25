// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useState } from "react";
import { SITE_URL } from "../lib/site";
import { type Grid, type Level, shareText, svgCard } from "../lib/shareCard";
import { m } from "../paraglide/messages.js";

// On-card cell colours, matched to the share emoji (🟩 / 🟨 / ⬜).
const CELL: Record<Level, string> = {
    strong: "bg-green-500",
    medium: "bg-amber-500",
    weak: "bg-gray-300 dark:bg-gray-700",
};

const LINK =
    "rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300";

// Rasterises the pure SVG card to a PNG and either shares it as a file (mobile)
// or downloads it. The card is self-contained, so the canvas stays untainted and
// can be exported.
async function saveImage(grid: Grid, heading: string, boast: string): Promise<void> {
    const svg = svgCard(grid, heading);
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    try {
        const image = new Image();
        image.src = url;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = 1080;
        canvas.height = 1350;
        canvas.getContext("2d")?.drawImage(image, 0, 0);
        const png = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, "image/png"),
        );
        if (!png) {
            return;
        }
        const file = new File([png], "plinky.png", { type: "image/png" });
        if (navigator.canShare?.({ files: [file] })) {
            await navigator.share({ files: [file], text: boast });
            return;
        }
        const link = URL.createObjectURL(png);
        const anchor = document.createElement("a");
        anchor.href = link;
        anchor.download = "plinky.png";
        anchor.click();
        URL.revokeObjectURL(link);
    } finally {
        URL.revokeObjectURL(url);
    }
}

// A Wordle-style grid (Accuracy / Timing / Flow as rows) with no numbers, plus
// buttons to post the emoji grid or save it as an image. The shape is the share —
// humans pass around patterns, not scores. The same card backs both a single run
// (six moments) and the lifetime fingerprint (recent days), so its labels and the
// boast it composes come from the caller.
export function ShareCard({
    grid,
    caption,
    gridLabel,
    boast,
    heading,
}: {
    grid: Grid;
    caption: string;
    gridLabel: string;
    boast: string;
    heading: string;
}) {
    const [copied, setCopied] = useState(false);
    const text = shareText(boast, grid, SITE_URL);
    const columns = grid[0]?.length ?? 0;

    return (
        <figure className="space-y-2">
            <figcaption className="text-sm text-gray-500 dark:text-gray-400">{caption}</figcaption>
            <div
                role="img"
                aria-label={gridLabel}
                className="grid w-max gap-1"
                style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
            >
                {grid.flatMap((row, r) =>
                    row.map((level, c) => (
                        <span
                            // biome-ignore lint/suspicious/noArrayIndexKey: the grid is a fixed 3×6 that never reorders, so the row/column position is a stable identity
                            key={`${r}-${c}`}
                            className={`h-7 w-7 rounded ${CELL[level]}`}
                        />
                    )),
                )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onClick={() => {
                        navigator.clipboard?.writeText(text).catch(() => {});
                        setCopied(true);
                        window.setTimeout(() => setCopied(false), 2000);
                    }}
                    className={LINK}
                >
                    {copied ? m.share_copied() : m.share_copy()}
                </button>
                <button
                    type="button"
                    // A cancelled share or a failed rasterise rejects; saving the card
                    // is best-effort, so swallow it rather than crash the run summary.
                    onClick={() => saveImage(grid, heading, boast).catch(() => {})}
                    className={LINK}
                >
                    {m.share_image()}
                </button>
                <a
                    href={`https://x.com/intent/post?text=${encodeURIComponent(text)}`}
                    target="_blank"
                    rel="noreferrer"
                    className={LINK}
                >
                    X
                </a>
                <a
                    href={`https://bsky.app/intent/compose?text=${encodeURIComponent(text)}`}
                    target="_blank"
                    rel="noreferrer"
                    className={LINK}
                >
                    Bluesky
                </a>
            </div>
        </figure>
    );
}
