// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { HelpItem } from "../../core/help";

// The seam for the help page's content: fetch every help item, with each item's text
// resolved to the given language (falling back to English). The local adapter serves
// the content bundled with the app, so it never throws into the page; an in-memory fake
// backs component tests.
export type HelpSource = {
    fetchItems(lang: string): Promise<HelpItem[]>;
};
