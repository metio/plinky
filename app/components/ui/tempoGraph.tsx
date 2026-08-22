// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { maxOf, minOf } from "../../../core/stats";
import type { Hotspot, TempoPoint } from "../../../core/tempo";
import { m } from "../../paraglide/messages.js";

const WIDTH = 600;
const HEIGHT = 180;
const PAD = { left: 36, right: 12, top: 12, bottom: 20 };

export type TempoSeries = { label: string; points: TempoPoint[]; color: string };

// A hand-rolled SVG line of bpm over the course of the phrase, with the player's
// median drawn as a reference and slow stretches shaded behind the curve. When
// per-hand series are given, each hand's tempo is drawn as its own line.
export function TempoGraph({
    points,
    median,
    hotspots,
    series,
    dotColor,
    medianLabel = (bpm) => m.tempo_graph_median({ bpm }),
}: {
    points: TempoPoint[];
    median: number;
    hotspots: Hotspot[];
    series?: TempoSeries[];
    // What each note's dot is worth, where the caller grades notes individually. The line
    // keeps its own colour — it is one curve and shading it per note would read as several —
    // and only the dots carry the verdict.
    dotColor?: (index: number) => string | null;
    // What the dashed reference line IS. It is the player's own median at the end of a
    // graded run, and the tempo they chose on the rhythm trainer — calling the second one a
    // median would be telling the reader the wrong thing about their own playing.
    medianLabel?: (bpm: number) => string;
}) {
    if (points.length === 0) {
        return null;
    }

    const lines: TempoSeries[] =
        series && series.length > 1 ? series : [{ label: "", points, color: "#4f46e5" }];

    const allBpms = [median, ...lines.flatMap((line) => line.points.map((point) => point.bpm))];
    const bpmLo = minOf(allBpms, median);
    const bpmHi = maxOf(allBpms, median);
    const yPad = Math.max(5, (bpmHi - bpmLo) * 0.15);
    const yLo = bpmLo - yPad;
    const yHi = bpmHi + yPad;
    const yFor = (bpm: number) =>
        PAD.top + (1 - (bpm - yLo) / Math.max(1, yHi - yLo)) * (HEIGHT - PAD.top - PAD.bottom);

    // Each line is normalized across its own note range, so two hands of
    // different lengths still span the full width.
    const xForLine = (linePoints: TempoPoint[]) => {
        const indices = linePoints.map((point) => point.index);
        const lo = minOf(indices, 0);
        const hi = maxOf(indices, 0);
        return (index: number) =>
            PAD.left + ((index - lo) / Math.max(1, hi - lo)) * (WIDTH - PAD.left - PAD.right);
    };

    // Hotspot shading uses the combined timeline behind the curves.
    const combinedIndices = points.map((point) => point.index);
    const minX = minOf(combinedIndices, 0);
    const maxX = maxOf(combinedIndices, 0);
    const xCombined = (index: number) =>
        PAD.left + ((index - minX) / Math.max(1, maxX - minX)) * (WIDTH - PAD.left - PAD.right);
    const step = (WIDTH - PAD.left - PAD.right) / Math.max(1, maxX - minX);

    return (
        <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="w-full"
            role="img"
            aria-label={m.tempo_graph_label()}
        >
            {hotspots.map((hotspot) => {
                // Pad the band a half-step beyond its end notes, but keep it inside
                // the plot area so a hotspot on the first or last note doesn't bleed
                // into the axis gutter or past the viewBox edge.
                const left = Math.max(PAD.left, xCombined(hotspot.startIndex) - step / 2);
                const right = Math.min(WIDTH - PAD.right, xCombined(hotspot.endIndex) + step / 2);
                return (
                    <rect
                        key={`${hotspot.startIndex}-${hotspot.endIndex}`}
                        x={left}
                        y={PAD.top}
                        width={Math.max(0, right - left)}
                        height={HEIGHT - PAD.top - PAD.bottom}
                        className="fill-danger-surface"
                    />
                );
            })}

            <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={yFor(median)}
                y2={yFor(median)}
                stroke="#9ca3af"
                strokeDasharray="4 4"
            />
            <text x={PAD.left} y={yFor(median) - 4} fill="#9ca3af" fontSize="10">
                {medianLabel(Math.round(median))}
            </text>

            <text x={4} y={yFor(yHi) + 9} fill="#9ca3af" fontSize="10">
                {Math.round(yHi)}
            </text>
            <text x={4} y={yFor(yLo)} fill="#9ca3af" fontSize="10">
                {Math.round(yLo)}
            </text>

            {lines.map((line) => {
                const xFor = xForLine(line.points);
                const curve = line.points
                    .map(
                        (point, i) =>
                            `${i === 0 ? "M" : "L"}${xFor(point.index).toFixed(1)},${yFor(point.bpm).toFixed(1)}`,
                    )
                    .join(" ");
                return (
                    <g key={line.label || "combined"}>
                        <path d={curve} fill="none" stroke={line.color} strokeWidth="2" />
                        {line.points.map((point) => {
                            const graded = dotColor?.(point.index) ?? null;
                            return (
                                <circle
                                    key={point.index}
                                    cx={xFor(point.index)}
                                    cy={yFor(point.bpm)}
                                    // A graded dot is drawn larger: it is carrying a reading
                                    // rather than just marking where the line bends.
                                    r={graded ? 3.5 : 2.5}
                                    fill={graded ?? line.color}
                                />
                            );
                        })}
                    </g>
                );
            })}

            {series && series.length > 1 && (
                <g>
                    {series.map((line, i) => (
                        <text
                            key={line.label}
                            x={WIDTH - PAD.right - 80}
                            y={PAD.top + 12 + i * 14}
                            fill={line.color}
                            fontSize="11"
                        >
                            ■ {line.label}
                        </text>
                    ))}
                </g>
            )}
        </svg>
    );
}
