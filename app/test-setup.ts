// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { afterEach, vi } from "vitest";
import { baseLocale, overwriteGetLocale } from "./paraglide/runtime.js";

// Component and route tests render outside the /:locale route, so there is no URL
// prefix for the url strategy to read. Pin the locale to the base so localized
// links (LocalizedLink) and messages resolve deterministically.
overwriteGetLocale(() => baseLocale);

// stubGlobal mutates globalThis and is NOT undone by restoreAllMocks, so a stubbed
// fetch/matchMedia would otherwise leak to whatever test runs next in the worker and
// flake an assertion on it (it did — a stubbed fetch leaked across the combined coverage
// run and broke a later fetch check). One global cleanup keeps every test isolated.
afterEach(() => {
    vi.unstubAllGlobals();
});
