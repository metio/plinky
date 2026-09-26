// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

export type Shade = "light" | "dark" | "black";

export type TokenBlock = {
    selector: string;
    kind: Shade;
    palette: string | null;
    weight: number;
    order: number;
    tokens: Map<string, string>;
};

export type TokenLayers = {
    light: Map<string, string>;
    dark: Map<string, string>;
    black: Map<string, string>;
    palettes: Map<string, { light: Map<string, string> | null; dark: Map<string, string> | null }>;
    blocks: TokenBlock[];
};

export function tokenLayers(css: string): TokenLayers;
export function tokenValueIn(
    layers: TokenLayers,
    palette: string | null,
    shade: Shade,
    name: string,
): string | undefined;
export function paletteGaps(layers: TokenLayers): string[];
