// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { createContext, type ReactNode, useContext } from "react";
import { getLocale } from "../../paraglide/runtime.js";
import { LocalizedLink as Link } from "./localizedLink";

// The one list layout: a margin, the name in the display face, one line, and optionally
// something at the end of the line and a body beneath it. A lesson, a tool, a group of
// settings, a figure on the Stats page and a result at the end of a run are all this row.
//
// No box. A row has no border, no corner and no ground of its own; a hairline between it and
// the row before it is all that separates the two, the way entries are ruled off in a
// printed index. The rule falls only between rows: none above the first, none below the
// last, so a single row stands clear of rules altogether and a list under a section heading
// takes the heading's own rule as its top edge. What holds a row apart is the margin: the
// column of drawings, icons or figures down the left edge that the names line up against.
//
// Rows inside a `Folio` share one margin, as wide as the widest thing in it, so a column
// of figures stays right-aligned however many digits one of them has. A row standing on its
// own (a section of Settings) takes the standard margin.

const InList = createContext(false);

// The margin a row takes on its own, and the least a list's margin shrinks to.
const OWN_COLUMNS = "grid-cols-[3.75rem_minmax(0,1fr)] sm:grid-cols-[5.25rem_minmax(0,1fr)]";
const LIST_COLUMNS =
    "grid-cols-[minmax(3.75rem,auto)_minmax(0,1fr)] sm:grid-cols-[minmax(5.25rem,auto)_minmax(0,1fr)]";

// The gutter between the margin and the name.
const GUTTER = "gap-x-3.5 sm:gap-x-5";

// A drawing sized to fill the margin, and a line icon sized to sit in it.
export const folioDrawingClasses = "h-auto w-15 sm:w-21";
export const folioIconClasses = "h-8 w-8 text-accent";

export function Folio({
    label,
    className = "",
    children,
}: {
    // A name for the list, where the heading above it does not already give one.
    label?: string;
    className?: string;
    children: ReactNode;
}) {
    return (
        // content-start, here and on each row: a list set beside something taller (the
        // lesson index) must not stretch its rows and spread their contents apart.
        <ul
            aria-label={label}
            className={`grid content-start ${LIST_COLUMNS} ${GUTTER} ${className}`}
        >
            <InList.Provider value={true}>{children}</InList.Provider>
        </ul>
    );
}

type Size = "normal" | "compact";

const PAD: Record<Size, string> = { normal: "py-4", compact: "py-2.5" };
// A row with a body beneath its line: a normal row opens up on a wide screen, and a compact
// one keeps its padding and sets the body close under the line, so a list of them (the
// grade ladder, a take's exports) stays a list rather than a stack of panels.
const BODY_PAD: Record<Size, string> = { normal: "sm:py-6", compact: "" };
const BODY_GAP: Record<Size, string> = { normal: "mt-3", compact: "mt-1.5" };
const NAME: Record<Size, string> = {
    normal: "text-lg sm:text-xl",
    compact: "text-base",
};

export function FolioRow({
    margin,
    name,
    heading,
    line,
    trailing,
    to,
    as,
    id,
    current,
    size = "normal",
    className = "",
    children,
}: {
    // A drawing, a figure or a line icon. Left off, the row's words start at the margin's
    // edge — only for a list nested inside another row's body, whose margin is already
    // the page's.
    margin?: ReactNode;
    // What the row is called. Left off only where the margin says it all and the body
    // is the reading of it — a run's letter beside its scores — and then the body sits
    // beside the margin rather than beneath a name.
    name?: ReactNode;
    // The heading level the name is, where the row heads a section of the page.
    heading?: "h2" | "h3" | "h4";
    // The one line under the name.
    line?: ReactNode;
    // An action or a disclosure at the end of the line.
    trailing?: ReactNode;
    // Where the whole row goes. A row that goes somewhere is one link, margin and all, so
    // the target is the full width rather than the name alone.
    to?: string;
    // The element the row is. A list item inside a Folio, otherwise a div.
    as?: "li" | "div" | "section" | "article";
    id?: string;
    // The row that says "you are here" in a list of places, such as the grade you are at.
    current?: boolean;
    size?: Size;
    className?: string;
    // What the row holds beneath its line: the controls of a group of settings, a
    // lesson's example. On a phone it takes the full width, margin included, because a
    // keyboard or a row of choices needs every pixel the screen has.
    children?: ReactNode;
}) {
    const inList = useContext(InList);
    const As = as ?? (inList ? "li" : "div");
    const columns = inList ? "col-span-2 grid-cols-subgrid" : OWN_COLUMNS;
    // A rule over a row only where another row stands directly before it, inside a list or
    // among standalone rows alike: the marker, not the element, is what names a row.
    const rule = "border-line [[data-folio-row]+&]:border-t";
    const bare = name === undefined && line === undefined && trailing === undefined;
    const grid = `grid content-start ${columns} ${GUTTER} ${PAD[size]} ${children && !bare ? BODY_PAD[size] : ""}`;
    const Name = heading ?? "span";
    // Inside a link a paragraph is not allowed to stand, so the line is a span there.
    const Line = to ? "span" : "p";
    const beside = margin === undefined ? "col-span-2" : "col-start-2";

    const head = (
        <>
            {margin !== undefined && (
                <div className="col-start-1 row-start-1 flex items-center justify-center self-center">
                    {margin}
                </div>
            )}
            {!bare && (
                <div className={`${beside} row-start-1 flex min-w-0 items-center gap-3`}>
                    <div className="min-w-0 flex-1">
                        {name !== undefined && (
                            <Name
                                className={`block font-display font-medium leading-tight break-words text-ink ${NAME[size]} ${to ? "group-hover:text-accent-strong" : ""}`}
                            >
                                {name}
                            </Name>
                        )}
                        {line !== undefined && (
                            <Line className="mt-0.5 block text-sm leading-snug text-body">
                                {line}
                            </Line>
                        )}
                    </div>
                    {trailing !== undefined && <div className="shrink-0">{trailing}</div>}
                </div>
            )}
        </>
    );

    if (to !== undefined) {
        return (
            <As
                id={id}
                data-folio-row=""
                aria-current={current || undefined}
                className={`${inList ? "col-span-2 grid grid-cols-subgrid" : ""} ${rule} ${className}`}
            >
                <Link to={to} className={`group ${grid}`}>
                    {head}
                </Link>
            </As>
        );
    }

    const body = bare
        ? `row-start-1 self-center ${beside}`
        : `row-start-2 ${BODY_GAP[size]} ${margin === undefined ? "col-span-2" : "col-span-2 sm:col-span-1 sm:col-start-2"}`;
    return (
        <As
            id={id}
            data-folio-row=""
            aria-current={current || undefined}
            className={`${grid} ${rule} ${className}`}
        >
            {head}
            {children !== undefined && (
                <div className={`min-w-0 space-y-3 ${body}`}>{children}</div>
            )}
        </As>
    );
}

const FIGURE_TONE = {
    accent: "text-accent-strong",
    ink: "text-ink",
    muted: "text-muted",
} as const;

// A number in the margin: days practised, a grade, a session's length. Written the way the
// reader's language writes numbers; a figure already spelled out (a duration) is shown as
// it is, a size down so it still fits the margin.
export function FolioFigure({
    value,
    tone = "accent",
}: {
    value: number | string;
    tone?: keyof typeof FIGURE_TONE;
}) {
    const spelled = typeof value === "string";
    return (
        <span
            className={`block w-full pr-1 text-right font-display font-medium leading-none tabular-nums whitespace-nowrap ${
                spelled ? "text-xl sm:text-2xl" : "text-3xl sm:text-4xl"
            } ${FIGURE_TONE[tone]}`}
        >
            {spelled ? value : value.toLocaleString(getLocale())}
        </span>
    );
}
