// SPDX-FileCopyrightText: The Klimpi Authors
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
    return {
        src: `data:${type};base64,${Buffer.from(bytes).toString("base64")}`,
        aspect: aspectOf(bytes, type),
    };
}

// The artwork's own proportions, read out of the file. A picture whose width is then
// computed from its height is the same shape it was drawn in; the fallback of 1 below is
// a square, which silently squashes anything that is not one — the lockup is 1024 by 339,
// and as a square it came out at a third of its width with the letters run together.
function aspectOf(bytes, type) {
    if (type === "image/svg+xml") {
        const [, width, height] = bytes.toString().match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/) ?? [];
        return width ? Number(width) / Number(height) : 1;
    }
    // A PNG carries its size in the IHDR chunk, as two big-endian uint32 at bytes 16 and
    // 20, right after the eight-byte signature and the chunk's own length and name.
    const PNG = "\x89PNG\r\n\x1a\n";
    if (bytes.length > 24 && bytes.subarray(0, 8).toString("binary") === PNG) {
        const width = bytes.readUInt32BE(16);
        const height = bytes.readUInt32BE(20);
        if (width > 0 && height > 0) {
            return width / height;
        }
    }
    return 1;
}

// A picture at a given height; the width follows from its own proportions.
export function picture({ src, aspect }, height) {
    return `<img src="${src}" alt="" style="height:${height}px;width:${Math.round(height * aspect)}px;flex:none;display:block">`;
}

// How much wider the white frame makes the mark: an eleventh of the artwork on each side.
const FRAMED = 13 / 11;

// The mark on a white plate, for a brand-coloured ground its own tile would otherwise
// vanish into. The size given is the plate's outer HEIGHT, so a layout chooses one number
// and the frame's cost is the frame's business. The plate's radius is its own; the artwork
// is never clipped, because a radius applied to it is a guess at its own curve and one
// slightly tight leaves a sliver of ground showing all the way round.
//
// The plate takes the artwork's proportions. For the square icon that is the square it
// always was; for the lockup, which is three times as wide as it is tall, a square plate
// framed the "Kl" and left the rest of the name outside it on the ground.
export function framedMark(art, paper) {
    return (size) => {
        const inner = Math.round(size / FRAMED);
        const pad = Math.round((size - inner) / 2);
        // The artwork plus its frame on each side, written as the asked-for size plus
        // whatever the artwork is wider than tall. A square mark then keeps exactly the
        // size it was given — computing `inner * aspect + pad * 2` instead rounds its way
        // to a pixel either side of it, which moved every social image that sets one.
        const width = size + Math.round(inner * (art.aspect - 1));
        // A percentage border-radius resolves per axis, so on a wide plate 26% is 26% of
        // its width across and of its height down — a stretched ellipse rather than the
        // corner the square plate has. Off the height in pixels it is the same corner at
        // any width. A square keeps the percentage it always had: the two agree to within
        // a rounding, and that rounding is a pixel on every social image that sets one.
        const radius = art.aspect === 1 ? "26%" : `${Math.round(size * 0.26)}px`;
        return `<div style="width:${width}px;height:${size}px;background:${paper};border-radius:${radius};padding:${pad}px;flex:none;display:block">${picture(art, inner)}</div>`;
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
    // The small line is set in a face half the tagline's size, so the measure that breaks
    // the tagline where it should breaks the small line mid-phrase. It takes its own when
    // a layout has the room; where it does not, it keeps the column's.
    lineMeasure = measure,
}) {
    const nameHeight = Math.round(size * (wide ? 0.4 : 0.42));
    const align = wide ? "flex-start" : "center";
    return `
<div style="display:flex;flex-direction:${wide ? "row" : "column"};align-items:center;gap:${Math.round(size * (wide ? 0.17 : 0.14))}px">
  ${mark(size)}
  <div style="display:flex;flex-direction:column;align-items:${align};text-align:${wide ? "left" : "center"}">
    ${picture(name, nameHeight)}
    <div style="${display};font-size:${title}px;color:${ink};line-height:1.12;letter-spacing:-0.01em;text-wrap:balance;${measure ? `max-width:${measure}px` : ""};margin-top:${Math.round(size * 0.05)}px">${tagline}</div>
    <div style="${ui};font-size:${small}px;color:${ink};opacity:.8;line-height:1.3;${lineMeasure ? `max-width:${lineMeasure}px` : ""};margin-top:${Math.round(title * 0.3)}px">${line}</div>
  </div>
</div>`;
}
