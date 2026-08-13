// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { decodeIncipit, type Incipit, layoutIncipit } from "../../../core/incipit";
import { BOOMWHACKER_SET } from "../../../core/pitchColor";

// One staff space, in pixels. Every other measurement is a multiple of it, so the mark
// rescales by changing this one number and nothing drifts out of proportion. A title
// carries it at full size; a list row wants it small enough not to become the row.
export const INCIPIT_TITLE_SPACE = 6;
export const INCIPIT_ROW_SPACE = 4;

// Sharps and flats are drawn rather than typed: the musical symbols are missing from
// plenty of the fonts that might paint this, and a glyph that silently falls back would
// put a box where an accidental belongs.
function Accidental({
    x,
    y,
    alter,
    space: SPACE,
}: {
    x: number;
    y: number;
    alter: number;
    space: number;
}) {
    const STROKE = 0.15 * SPACE;
    if (alter > 0) {
        return (
            <g stroke="currentColor" strokeWidth={STROKE} fill="none" strokeLinecap="round">
                <line
                    x1={x - 0.24 * SPACE}
                    y1={y - 0.9 * SPACE}
                    x2={x - 0.24 * SPACE}
                    y2={y + 0.7 * SPACE}
                />
                <line
                    x1={x + 0.24 * SPACE}
                    y1={y - 1 * SPACE}
                    x2={x + 0.24 * SPACE}
                    y2={y + 0.6 * SPACE}
                />
                <line
                    x1={x - 0.5 * SPACE}
                    y1={y - 0.2 * SPACE}
                    x2={x + 0.5 * SPACE}
                    y2={y - 0.34 * SPACE}
                />
                <line
                    x1={x - 0.5 * SPACE}
                    y1={y + 0.28 * SPACE}
                    x2={x + 0.5 * SPACE}
                    y2={y + 0.14 * SPACE}
                />
            </g>
        );
    }
    return (
        <g stroke="currentColor" strokeWidth={STROKE} fill="none" strokeLinecap="round">
            <line
                x1={x - 0.2 * SPACE}
                y1={y - 1.3 * SPACE}
                x2={x - 0.2 * SPACE}
                y2={y + 0.6 * SPACE}
            />
            <path
                d={`M ${x - 0.2 * SPACE} ${y + 0.1 * SPACE} q ${0.85 * SPACE} ${-0.65 * SPACE} ${0.6 * SPACE} ${0.15 * SPACE} q ${-0.18 * SPACE} ${0.48 * SPACE} ${-0.6 * SPACE} ${0.35 * SPACE}`}
            />
        </g>
    );
}

// A piece's opening bar as a small staff fragment — the way a thematic catalogue names
// a work. Presentational and pure: it takes a read incipit and draws it, inheriting its
// colour from the text around it, so a caller can hand it any size and any theme.
//
// `label` is what a screen reader hears. The mark carries nothing a reader cannot get
// from the title beside it, so it is described rather than transcribed.
export function IncipitMark({
    incipit,
    label,
    colored = false,
    space: SPACE = INCIPIT_TITLE_SPACE,
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
    const SLOT = 2.5 * SPACE; // one notehead to the next
    const MARGIN = 3 * SPACE; // room above and below for ledger lines
    const STAFF = 4 * SPACE;
    const EDGE = SPACE; // the staff runs a little past the outer notes
    const HEAD_RX = 0.62 * SPACE;
    const HEAD_RY = 0.46 * SPACE;
    const STEM = 3.2 * SPACE;
    const HAIRLINE = 0.11 * SPACE;
    const STROKE = 0.15 * SPACE;
    const glyphs = layoutIncipit(incipit);
    const width = 2 * EDGE + glyphs.length * SLOT;
    const height = STAFF + 2 * MARGIN;
    // The bottom staff line, measured down from the top of the drawing.
    const baseline = MARGIN + STAFF;
    const yOf = (staffY: number) => baseline - staffY * SPACE;

    return (
        <svg
            viewBox={`0 0 ${width} ${height}`}
            width={width}
            height={height}
            role="img"
            aria-label={label}
            className={className}
        >
            <g stroke="currentColor" strokeWidth={HAIRLINE} opacity={0.5}>
                {[0, 1, 2, 3, 4].map((line) => (
                    <line key={line} x1={0} y1={yOf(line)} x2={width} y2={yOf(line)} />
                ))}
            </g>
            {glyphs.map((glyph) => {
                const x = EDGE + glyph.slot * SLOT + SLOT / 2;
                const y = yOf(glyph.y);
                // The seven note names in order are the first seven entries of the set
                // the score itself is coloured from, so a mark and its piece agree.
                const fill = colored
                    ? (BOOMWHACKER_SET[glyph.letter] ?? "currentColor")
                    : "currentColor";
                // Stems turn at the middle line, the way an engraver sets them: up from
                // the low half of the staff, down from the high.
                const up = glyph.y < 2;
                const stemX = up ? x + HEAD_RX : x - HEAD_RX;
                return (
                    <g key={glyph.slot}>
                        {glyph.ledgers.map((line) => (
                            <line
                                key={line}
                                x1={x - 1.1 * SPACE}
                                y1={yOf(line)}
                                x2={x + 1.1 * SPACE}
                                y2={yOf(line)}
                                stroke="currentColor"
                                strokeWidth={HAIRLINE}
                            />
                        ))}
                        {glyph.alter !== 0 && (
                            <Accidental
                                x={x - 1.3 * SPACE}
                                y={y}
                                alter={glyph.alter}
                                space={SPACE}
                            />
                        )}
                        <ellipse
                            cx={x}
                            cy={y}
                            rx={HEAD_RX}
                            ry={HEAD_RY}
                            transform={`rotate(-18 ${x} ${y})`}
                            fill={glyph.hollow ? "none" : fill}
                            stroke={glyph.hollow ? fill : "none"}
                            strokeWidth={STROKE}
                        />
                        {glyph.stem && (
                            <line
                                x1={stemX}
                                y1={y}
                                x2={stemX}
                                y2={up ? y - STEM : y + STEM}
                                stroke="currentColor"
                                strokeWidth={STROKE}
                            />
                        )}
                    </g>
                );
            })}
        </svg>
    );
}

// The mark as the catalogue carries it — one short string baked into the manifest, so a
// list can draw a piece without fetching its notation. Nothing at all when a piece has
// no mark, which keeps a row that cannot have one looking deliberate rather than broken.
export function BakedIncipit({
    mark,
    label,
    className = "",
}: {
    mark: string | undefined;
    label: string;
    className?: string;
}) {
    const incipit = mark ? decodeIncipit(mark) : null;
    if (!incipit) {
        return null;
    }
    return (
        <IncipitMark
            incipit={incipit}
            label={label}
            space={INCIPIT_ROW_SPACE}
            className={className}
        />
    );
}
