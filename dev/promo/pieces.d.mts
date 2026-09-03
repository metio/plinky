// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Types for dev/promo/pieces.mjs. The module stays plain JavaScript because the whole promo
// pipeline is driven by plain Node scripts; these exist so the pieces of it that are worth
// testing can be imported from a .mts test.

export type PromoPiece = {
    id: string;
    title: string;
    composer: string;
    // Set where a title cannot tell two pieces apart, and folded into the folder name.
    variant?: string;
};

export const PIECES: PromoPiece[];
export function folderFor(piece: PromoPiece): string;
export function folderForComposer(composer: string): string;
export function slug(title: string): string;
