// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { Hotspot, TempoPoint } from "../lib/tempo";

const WIDTH = 600;
const HEIGHT = 180;
const PAD = { left: 36, right: 12, top: 12, bottom: 20 };

// A hand-rolled SVG line of bpm over the course of the phrase, with the player's
// median drawn as a reference and slow stretches shaded behind the curve.
export function TempoGraph({
    points,
    median,
    hotspots,
}: {
    points: TempoPoint[];
    median: number;
    hotspots: Hotspot[];
}) {
    if (points.length === 0) {
        return null;
    }

    const indices = points.map((point) => point.index);
    const bpms = points.map((point) => point.bpm);
    const minX = Math.min(...indices);
    const maxX = Math.max(...indices);
    const yPad = Math.max(5, (Math.max(...bpms) - Math.min(...bpms)) * 0.15);
    const yLo = Math.min(...bpms, median) - yPad;
    const yHi = Math.max(...bpms, median) + yPad;

    const xFor = (index: number) =>
        PAD.left + ((index - minX) / Math.max(1, maxX - minX)) * (WIDTH - PAD.left - PAD.right);
    const yFor = (bpm: number) =>
        PAD.top + (1 - (bpm - yLo) / Math.max(1, yHi - yLo)) * (HEIGHT - PAD.top - PAD.bottom);

    const curve = points
        .map(
            (point, i) =>
                `${i === 0 ? "M" : "L"}${xFor(point.index).toFixed(1)},${yFor(point.bpm).toFixed(1)}`,
        )
        .join(" ");
    const step = (WIDTH - PAD.left - PAD.right) / Math.max(1, maxX - minX);

    return (
        <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="w-full"
            role="img"
            aria-label="Tempo over time"
        >
            {hotspots.map((hotspot) => (
                <rect
                    key={`${hotspot.startIndex}-${hotspot.endIndex}`}
                    x={xFor(hotspot.startIndex) - step / 2}
                    y={PAD.top}
                    width={xFor(hotspot.endIndex) - xFor(hotspot.startIndex) + step}
                    height={HEIGHT - PAD.top - PAD.bottom}
                    fill="#fee2e2"
                />
            ))}

            <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={yFor(median)}
                y2={yFor(median)}
                stroke="#9ca3af"
                strokeDasharray="4 4"
            />
            <text x={PAD.left} y={yFor(median) - 4} fill="#9ca3af" fontSize="10">
                median {Math.round(median)}
            </text>

            <text x={4} y={yFor(yHi) + 9} fill="#9ca3af" fontSize="10">
                {Math.round(yHi)}
            </text>
            <text x={4} y={yFor(yLo)} fill="#9ca3af" fontSize="10">
                {Math.round(yLo)}
            </text>

            <path d={curve} fill="none" stroke="#4f46e5" strokeWidth="2" />
            {points.map((point) => (
                <circle
                    key={point.index}
                    cx={xFor(point.index)}
                    cy={yFor(point.bpm)}
                    r="2.5"
                    fill="#4f46e5"
                />
            ))}
        </svg>
    );
}
