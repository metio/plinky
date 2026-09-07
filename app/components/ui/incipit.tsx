// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { decodeIncipit, type Incipit, INCIPIT_NOTES } from "../../../core/incipit";
import { drawIncipit, headColor } from "../../../core/incipitDraw";

// One staff space, in pixels. Every other measurement is a multiple of it, so the mark
// rescales by changing this one number and nothing drifts out of proportion. A title
// carries it at full size; a list row wants it small enough not to become the row.
export const INCIPIT_TITLE_SPACE = 6;
export const INCIPIT_ROW_SPACE = 4;

// A piece's opening bar as a small staff fragment — the way a thematic catalogue names
// a work. Presentational and pure: it takes a read incipit and draws it, inheriting its
// colour from the text around it, so a caller can hand it any size and any theme. The
// geometry is core's (drawIncipit), shared with the SVG a piece's social card is painted
// from, so the mark on a page and the mark on its card are one shape.
//
// `label` is what a screen reader hears. The mark carries nothing a reader cannot get
// from the title beside it, so it is described rather than transcribed.
export function IncipitMark({
    incipit,
    label,
    colored = false,
    space = INCIPIT_TITLE_SPACE,
    className = "",
}: {
    incipit: Incipit;
    label: string;
    // Colour each head by its note name, the way the score itself does when a reader
    // has that aid switched on. Off, the mark is ink like any other printed thing.
    colored?: boolean;
    space?: number;
    className?: string;
}) {
    const drawing = drawIncipit(incipit, space);
    const { width, height, hairline, stroke } = drawing;

    return (
        <svg
            viewBox={`0 0 ${width} ${height}`}
            width={width}
            height={height}
            role="img"
            aria-label={label}
            className={className}
        >
            <g stroke="currentColor" strokeWidth={hairline} opacity={0.5}>
                {drawing.staff.map((line) => (
                    <line key={line.y1} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} />
                ))}
            </g>
            {drawing.heads.map((head) => {
                const fill = colored ? headColor(head.letter) : "currentColor";
                return (
                    <g key={head.x}>
                        {head.ledgers.map((line) => (
                            <line
                                key={line.y1}
                                x1={line.x1}
                                y1={line.y1}
                                x2={line.x2}
                                y2={line.y2}
                                stroke="currentColor"
                                strokeWidth={hairline}
                            />
                        ))}
                        {head.accidental && (
                            <g
                                stroke="currentColor"
                                strokeWidth={stroke}
                                fill="none"
                                strokeLinecap="round"
                            >
                                {head.accidental.lines.map((line) => (
                                    <line
                                        key={`${line.x1},${line.y1}`}
                                        x1={line.x1}
                                        y1={line.y1}
                                        x2={line.x2}
                                        y2={line.y2}
                                    />
                                ))}
                                {head.accidental.paths.map((d) => (
                                    <path key={d} d={d} />
                                ))}
                            </g>
                        )}
                        <ellipse
                            cx={head.x}
                            cy={head.y}
                            rx={head.rx}
                            ry={head.ry}
                            transform={`rotate(-18 ${head.x} ${head.y})`}
                            fill={head.hollow ? "none" : fill}
                            stroke={head.hollow ? fill : "none"}
                            strokeWidth={stroke}
                        />
                        {head.stem && (
                            <line
                                x1={head.stem.x1}
                                y1={head.stem.y1}
                                x2={head.stem.x2}
                                y2={head.stem.y2}
                                stroke="currentColor"
                                strokeWidth={stroke}
                            />
                        )}
                    </g>
                );
            })}
        </svg>
    );
}

// The mark as the catalogue carries it — one short string baked into the manifest, so a
// list can draw a piece without fetching its notation.
//
// The slot a row's mark occupies, whether or not the piece has one: wide enough for a
// full-length mark at row size. A list where only some pieces are drawn would otherwise
// start each title at a different place, which reads as a mistake rather than as a piece
// whose opening is not on file.
const SLOT_WIDTH = 2 * INCIPIT_ROW_SPACE + INCIPIT_NOTES * 2.5 * INCIPIT_ROW_SPACE;

export function BakedIncipit({
    mark,
    label,
    colored = false,
    className = "",
}: {
    mark: string | undefined;
    label: string;
    // Colour each head by its note name, as IncipitMark does. "Baked" is about the data,
    // not the drawing: the manifest ships a compact string, this decodes it, and the same
    // SVG is drawn on the client — so a baked mark can be coloured exactly like any other.
    colored?: boolean;
    className?: string;
}) {
    const incipit = mark ? decodeIncipit(mark) : null;
    return (
        <span
            className="flex shrink-0 items-center"
            style={{ minWidth: `${SLOT_WIDTH}px` }}
            aria-hidden={incipit ? undefined : "true"}
        >
            {incipit && (
                <IncipitMark
                    incipit={incipit}
                    label={label}
                    colored={colored}
                    space={INCIPIT_ROW_SPACE}
                    className={className}
                />
            )}
        </span>
    );
}
