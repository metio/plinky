// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Types for dev/promo/collections.mjs — see dev/promo/pieces.d.mts for why these exist.

import type { PromoPiece } from "./pieces.d.mts";

export type PromoCollection = {
    id: string;
    name: string;
    // How many pieces of the work the catalogue holds, postable or not.
    held: number;
    pieces: PromoPiece[];
};

export function folderForCollection(set: { id: string }): string;
export function collections(): PromoCollection[];
export function collectionPieces(): PromoPiece[];
