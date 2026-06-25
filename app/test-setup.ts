// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

import { baseLocale, overwriteGetLocale } from "./paraglide/runtime.js";

// Component and route tests render outside the /:locale route, so there is no URL
// prefix for the url strategy to read. Pin the locale to the base so localized
// links (LocalizedLink) and messages resolve deterministically.
overwriteGetLocale(() => baseLocale);
