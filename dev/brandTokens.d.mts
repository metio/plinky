// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Types for dev/brandTokens.mjs, which stays plain JavaScript because the brand and icon
// builds run it under bare Node.

// A colour token's value, read from app.css (or the built stylesheet), following any
// `var(...)` reference to the value it names.
export function tokenValue(css: string, built: string, name: string): string;
