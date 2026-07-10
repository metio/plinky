// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { BoardArtist } from "../../core/board";
import type { BoardSource } from "../ports/board";

// An in-memory BoardSource that resolves to a fixed list, or to nothing by default.
// Production wires the Sanity adapter; this backs component tests (inject it through
// the services provider) and local preview where no content service should be
// reached. The language is ignored — a test supplies the artists it wants to assert.
export function fakeBoard(artists: BoardArtist[] = []): BoardSource {
    return { fetchArtists: async () => artists };
}
