// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { type Grid, type Level, shareText, svgCard } from "../../core/shareCard";
import { ShareButtons } from "./shareButtons";

// On-card cell colours, matched to the share emoji (🟩 / 🟨 / 🟧 / 🟥 / ⬜).
const CELL: Record<Level, string> = {
    best: "bg-green-500",
    good: "bg-yellow-500",
    ok: "bg-orange-500",
    weak: "bg-red-500",
    none: "bg-gray-300 dark:bg-gray-700",
};

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
            <ShareButtons
                text={shareText(boast, grid)}
                imageSvg={svgCard(grid, heading)}
                imageText={boast}
            />
        </figure>
    );
}
