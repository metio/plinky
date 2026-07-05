// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { browserStore } from "../adapters/browserStore";
import { createMasteryStore } from "../stores/masteryStore";
import { createPrefsStore } from "../stores/prefsStore";

// Test-side handles onto the same backing localStorage the components under test
// read through their default services, so seeding and asserting share one source
// of truth. One instance per family — reads always re-check the backing store, so
// a component's own store instance sees these writes on its next render.
export const testPrefsStore = createPrefsStore(browserStore);
export const testMasteryStore = createMasteryStore(browserStore);
