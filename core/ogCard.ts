// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Incipit } from "./incipit";
import { incipitSvg } from "./incipitDraw";

// The card a link to a piece unfurls as: its name, who wrote it, and its opening bar as
// the thematic catalogues name a work — where every piece used to unfurl as the site's
// own card, three thousand links with one picture between them.
//
// Language-neutral on purpose: one image per piece, not one per language. A title and a
// composer's name are the same in every language the site speaks, and the mark is music.
// Painted by a headless browser from this markup (dev/gen-og.mts), the same way the site's
// own card is; this is the part that can be read without one.

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

export type CardPalette = {
    paper: string;
    ink: string;
    muted: string;
    accent: string;
};

export type CardFonts = {
    // CSS for the display face and the body face, each a full `font-family` value.
    display: string;
    body: string;
};

export type PieceCard = {
    title: string;
    composer: string;
    incipit: Incipit | null;
};

const escapeHtml = (value: string) =>
    value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

// A title is set in one of two sizes: the ordinary one, or a smaller one once the title
// runs long enough that two lines at full size would not hold it. Read off the length
// rather than measured, since nothing here has a layout engine.
export function titleSize(title: string): number {
    if (title.length <= 28) {
        return 76;
    }
    if (title.length <= 56) {
        return 58;
    }
    return 44;
}

// The whole card as HTML, sized exactly to the image it becomes. `mark` is the site's
// icon as a data URI, so the render does not depend on where the browser thinks its
// document lives; `host` names the site in the corner.
export function pieceCardHtml(
    card: PieceCard,
    {
        palette,
        fonts,
        mark,
        host,
    }: { palette: CardPalette; fonts: CardFonts; mark: string; host: string },
): string {
    const staff = card.incipit ? incipitSvg(card.incipit, { space: 22, ink: palette.accent }) : "";
    return (
        `<div style="width:${CARD_WIDTH}px;height:${CARD_HEIGHT}px;background:${palette.paper};display:flex;flex-direction:column;justify-content:space-between;padding:56px 64px;box-sizing:border-box;position:relative;overflow:hidden">` +
        `<div style="position:absolute;left:0;top:0;bottom:0;width:18px;background:${palette.accent}"></div>` +
        `<div style="display:flex;flex-direction:column;gap:18px;min-width:0">` +
        `<div style="${fonts.display};font-size:${titleSize(card.title)}px;line-height:1.1;color:${palette.ink};letter-spacing:-0.01em;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word">${escapeHtml(card.title)}</div>` +
        (card.composer
            ? `<div style="${fonts.body};font-size:34px;color:${palette.muted};line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(card.composer)}</div>`
            : "") +
        `</div>` +
        `<div style="display:flex;align-items:flex-end;justify-content:space-between;gap:32px">` +
        `<div style="display:flex;align-items:center;min-height:200px">${staff}</div>` +
        `<div style="display:flex;align-items:center;gap:16px;flex:none"><img src="${mark}" alt="" style="width:72px;height:72px;display:block"><span style="${fonts.body};font-size:28px;color:${palette.muted}">${escapeHtml(host)}</span></div>` +
        `</div></div>`
    );
}
