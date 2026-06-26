// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { useEffect, useRef, useState } from "react";
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
    rowLabels,
    boast,
    heading,
}: {
    grid: Grid;
    caption: string;
    gridLabel: string;
    // One label per grid row, naming the dimension each row scores so the on-page
    // card connects its rows to the metrics above. Left out of the shared text and
    // image, which stay a bare Wordle-style grid.
    rowLabels: string[];
    boast: string;
    heading: string;
}) {
    const [copied, setCopied] = useState(false);
    // The "Copied!" label reverts after a moment; the timer is held so it can be
    // cleared on unmount, since the run summary can be navigated away within it.
    const copyTimer = useRef(0);
    useEffect(() => () => window.clearTimeout(copyTimer.current), []);
    const text = shareText(boast, grid);

    return (
        <figure className="space-y-2">
            <figcaption className="text-sm text-gray-500 dark:text-gray-400">{caption}</figcaption>
            <div role="img" aria-label={gridLabel} className="w-max space-y-1">
                {grid.map((row, r) => (
                    <div key={rowLabels[r] ?? r} className="flex items-center gap-2">
                        <span className="w-16 text-right text-xs text-gray-500 dark:text-gray-400">
                            {rowLabels[r]}
                        </span>
                        <div className="flex gap-1">
                            {row.map((level, c) => (
                                <span
                                    // biome-ignore lint/suspicious/noArrayIndexKey: a row is a fixed-length band that never reorders, so the column position is a stable identity
                                    key={c}
                                    className={`h-7 w-7 rounded ${CELL[level]}`}
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onClick={() => {
                        navigator.clipboard?.writeText(text).catch(() => {});
                        setCopied(true);
                        window.clearTimeout(copyTimer.current);
                        copyTimer.current = window.setTimeout(() => setCopied(false), 2000);
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
