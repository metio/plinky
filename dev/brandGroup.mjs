// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The group every social image on an indigo or dark ground sets: the framed mark, the name,
// the tagline and its small line. One size — the framed mark's height — decides the rest, so
// the name always reads second to the mark and the tagline third, and the brand kit
// (`npm run brand`) and the site's own link card (`npm run icons`) cannot set it two ways.
//
// A wide picture sets the words beside the mark, a square or tall one under it. `measure`
// caps the words' width where a platform's crop is narrower than one line of the tagline.
// Set it to the widest line the words then break into: the column keeps the whole measure
// however narrow its lines, and a column wider than its lines pulls the group off centre.
//
// The mark arrives as a function of its size rather than as a picture, so the layout here
// stays out of the question of how the mark is dressed — framed, plain, raster or vector.

// A picture from a file as { src, aspect }: a data URI and its width over its height. An SVG
// carries its proportions in its viewBox; anything else is square, which every form of the
// mark is.
export function markImage(bytes, type = "image/svg+xml") {
    const [, width, height] =
        (type === "image/svg+xml" && bytes.toString().match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/)) ||
        [];
    return {
        src: `data:${type};base64,${Buffer.from(bytes).toString("base64")}`,
        aspect: width ? Number(width) / Number(height) : 1,
    };
}

// A picture at a given height; the width follows from its own proportions.
export function picture({ src, aspect }, height) {
    return `<img src="${src}" alt="" style="height:${height}px;width:${Math.round(height * aspect)}px;flex:none;display:block">`;
}

// How much wider the white frame makes the mark: an eleventh of the artwork on each side.
const FRAMED = 13 / 11;

// The mark on a white plate, for an indigo ground its own tile would otherwise vanish into.
// The size given is the plate's outer edge, so a layout chooses one number and the frame's
// cost is the frame's business. The plate's radius is its own; the artwork is never clipped,
// because a radius applied to it is a guess at its own curve and one slightly tight leaves a
// sliver of ground showing all the way round.
export function framedMark(art, paper) {
    return (size) => {
        const inner = Math.round(size / FRAMED);
        const pad = Math.round((size - inner) / 2);
        return `<div style="width:${size}px;height:${size}px;background:${paper};border-radius:26%;padding:${pad}px;flex:none;display:block">${picture(art, inner)}</div>`;
    };
}

export function markGroup({
    mark,
    name,
    size,
    wide,
    ink,
    display,
    ui,
    tagline,
    line,
    title = Math.round(size * (wide ? 0.19 : 0.21)),
    small = Math.round(title * 0.46),
    measure,
}) {
    const nameHeight = Math.round(size * (wide ? 0.4 : 0.42));
    const align = wide ? "flex-start" : "center";
    return `
<div style="display:flex;flex-direction:${wide ? "row" : "column"};align-items:center;gap:${Math.round(size * (wide ? 0.17 : 0.14))}px">
  ${mark(size)}
  <div style="display:flex;flex-direction:column;align-items:${align};text-align:${wide ? "left" : "center"};${measure ? `max-width:${measure}px` : ""}">
    ${picture(name, nameHeight)}
    <div style="${display};font-size:${title}px;color:${ink};line-height:1.12;letter-spacing:-0.01em;text-wrap:balance;margin-top:${Math.round(size * 0.05)}px">${tagline}</div>
    <div style="${ui};font-size:${small}px;color:${ink};opacity:.8;line-height:1.3;margin-top:${Math.round(title * 0.3)}px">${line}</div>
  </div>
</div>`;
}
