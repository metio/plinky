// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { BoardArtist } from "../../core/board";

// The seam for the board page's content: fetch every published artist, with each
// entry's blurb and alt resolved to the given language (falling back to English).
// Empty on no content, no configured project, or a failed fetch — the board never
// throws into the page. The Sanity adapter implements it in production; an
// in-memory fake backs tests and local preview.
export type BoardSource = {
    fetchArtists(lang: string): Promise<BoardArtist[]>;
};
