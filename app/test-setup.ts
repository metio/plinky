// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { configure } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { baseLocale, overwriteGetLocale } from "./paraglide/runtime.js";

// Components that load a score render after async work (OSMD under a real browser, a
// catalogue fetch), which can run long on a loaded machine. Give every findBy/waitFor a
// generous default poll window so a slow-but-correct render is waited out rather than
// failing a 1s default — the cure for the render flake, polling not retrying.
configure({ asyncUtilTimeout: 30_000 });

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
