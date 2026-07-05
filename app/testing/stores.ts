// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { browserStore } from "../adapters/browserStore";
import { createMasteryStore } from "../stores/masteryStore";
import { createPrefsStore } from "../stores/prefsStore";

// Handles onto the real browser storage for the BROWSER test project, whose whole
// point is exercising the genuine integration (real chromium, real localStorage,
// real OSMD) against the default services. jsdom component tests should not use
// these — they get an isolated injected world from renderWithServices instead.
// One instance per family — reads always re-check the backing store, so a
// component's own store instance sees these writes on its next render.
export const testPrefsStore = createPrefsStore(browserStore);
export const testMasteryStore = createMasteryStore(browserStore);
