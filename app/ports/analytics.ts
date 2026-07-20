// SPDX-FileCopyrightText: The Plinky Authors
// SPDX-License-Identifier: 0BSD

// The analytics capability: turn anonymous usage analytics on or off. The real
// adapter loads Google Analytics on the first opt-in and stops sending when off; a
// fake records the calls. Nothing loads or is sent until `setConsent(true)`, which
// only ever follows a deliberate consent — the first-visit banner or the Settings
// toggle. Never default-on.
export type Analytics = {
    setConsent(on: boolean): void;
};
