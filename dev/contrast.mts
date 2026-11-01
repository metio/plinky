// SPDX-FileCopyrightText: The Klimpi Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// WCAG contrast between colours as app.css and Tailwind's palette write them, so a gate
// can measure a pairing of tokens without building the site and asking a browser.
//
// Colours are held as linear-light sRGB, which is what relative luminance is defined on.
// Tailwind's palette is written in oklch, and a few steps (the saturated indigos and
// fuchsias) sit just outside sRGB; they are clipped per channel, which is close to what a
// browser paints on an sRGB display and never flatters a pairing by more than a rounding.

export type Rgb = readonly [number, number, number];

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toEncoded = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const clip = (c: number) => Math.min(1, Math.max(0, c));

function fromOklch(lightness: number, chroma: number, hue: number): Rgb {
    const a = chroma * Math.cos((hue * Math.PI) / 180);
    const b = chroma * Math.sin((hue * Math.PI) / 180);
    const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
    return [
        clip(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
        clip(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
        clip(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    ];
}

// A literal colour: `#rgb`, `#rrggbb`, or `oklch(L% C H)`. Anything else is a value this
// module cannot measure, and saying so beats guessing a colour for it.
export function parseColour(value: string): Rgb {
    const text = value.trim();
    const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text);
    if (hex) {
        const digits = hex[1]!.length === 3 ? [...hex[1]!].map((d) => d + d).join("") : hex[1]!;
        return [0, 2, 4].map((i) =>
            toLinear(Number.parseInt(digits.slice(i, i + 2), 16) / 255),
        ) as unknown as Rgb;
    }
    const oklch = /^oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)$/.exec(text);
    if (oklch) {
        return fromOklch(Number(oklch[1]) / 100, Number(oklch[2]), Number(oklch[3]));
    }
    throw new Error(`cannot measure the colour "${value}"`);
}

export function luminance([r, g, b]: Rgb): number {
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// A colour in Oklab, which is built so that an equal step anywhere in it is an equal step
// to the eye — unlike sRGB, where the same numeric move is a different amount of green and
// of blue.
function oklab([r, g, b]: Rgb): Rgb {
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [
        0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
        1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
        0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    ];
}

// How far apart two colours look. Contrast answers whether ink is readable on a ground;
// this answers whether two colours side by side are the same colour, which is a different
// question — two fills can differ enormously in contrast against the page and still be
// indistinguishable from each other. Hue alone cannot answer it either: a few degrees
// apart is plenty when the lightness differs and nothing when it does not.
export function distance(one: Rgb, other: Rgb): number {
    const [a, b] = [oklab(one), oklab(other)];
    return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export function contrast(one: Rgb, other: Rgb): number {
    const [light, dark] = [luminance(one), luminance(other)].sort((x, y) => y - x) as [
        number,
        number,
    ];
    return (light + 0.05) / (dark + 0.05);
}

// `top` painted at `alpha` over `under`. Browsers blend in encoded sRGB, not linear light,
// so the mix is taken there; blending linear values would paint a translucent bar lighter
// than the screen shows it.
export function over(top: Rgb, alpha: number, under: Rgb): Rgb {
    return top.map((channel, i) =>
        toLinear(toEncoded(channel) * alpha + toEncoded(under[i]!) * (1 - alpha)),
    ) as unknown as Rgb;
}
