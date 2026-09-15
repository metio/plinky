// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The group every social image on an indigo or dark ground sets: the framed tile, the name,
// the tagline and its small line. One size — the framed tile's height — decides the rest, so
// the name always reads second to the mark and the tagline third, and the brand kit
// (`npm run brand`) and the site's own link card (`npm run icons`) cannot set it two ways.
//
// A wide picture sets the words beside the tile, a square or tall one under it. `measure`
// caps the words' width where a platform's crop is narrower than one line of the tagline.
// Set it to the widest line the words then break into: the column keeps the whole measure
// however narrow its lines, and a column wider than its lines pulls the group off centre.

// A mark from brand/mark as { src, aspect }: a data URI and its width over its height.
export function markImage(svg) {
    const [, width, height] = svg.toString().match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/) ?? [];
    return {
        src: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
        aspect: Number(width) / Number(height),
    };
}

const picture = ({ src, aspect }, height) =>
    `<img src="${src}" alt="" style="height:${height}px;width:${Math.round(height * aspect)}px;flex:none;display:block">`;

export function markGroup({
    tile,
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
  ${picture(tile, size)}
  <div style="display:flex;flex-direction:column;align-items:${align};text-align:${wide ? "left" : "center"};${measure ? `max-width:${measure}px` : ""}">
    ${picture(name, nameHeight)}
    <div style="${display};font-size:${title}px;color:${ink};line-height:1.12;letter-spacing:-0.01em;text-wrap:balance;margin-top:${Math.round(size * 0.05)}px">${tagline}</div>
    <div style="${ui};font-size:${small}px;color:${ink};opacity:.8;line-height:1.3;margin-top:${Math.round(title * 0.3)}px">${line}</div>
  </div>
</div>`;
}
