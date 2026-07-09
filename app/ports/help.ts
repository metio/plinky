// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { HelpItem } from "../../core/help";

// The seam for the help page's content: fetch every published help item, with each
// item's text and alt resolved to the given language (falling back to English).
// Empty on no content, no configured project, or a failed fetch — help never
// throws into the page. The Sanity adapter implements it in production; an
// in-memory fake backs tests and local preview.
export type HelpSource = {
    fetchItems(lang: string): Promise<HelpItem[]>;
};
