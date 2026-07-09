// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import type { HelpItem } from "../../core/help";
import type { HelpSource } from "../ports/help";

// An in-memory HelpSource that resolves to a fixed list, or to nothing by default.
// Production wires the Sanity adapter; this backs component tests (inject it through
// the services provider) and local preview where no content service should be
// reached. The language is ignored — a test supplies the items it wants to assert.
export function fakeHelp(items: HelpItem[] = []): HelpSource {
    return { fetchItems: async () => items };
}
