// SPDX-FileCopyrightText: The Plinky Authors
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
